// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";

import {TwineHook} from "../src/TwineHook.sol";
import {TwinePositionManager} from "../src/TwinePositionManager.sol";
import {TwineGovernor} from "../src/TwineGovernor.sol";
import {TwineUnderwritingVault} from "../src/TwineUnderwritingVault.sol";
import {STRAND} from "../src/STRAND.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockPriceOracle} from "../src/mocks/MockPriceOracle.sol";
import {MultisigMarketHours} from "../src/oracle/MultisigMarketHours.sol";

import {HookMiner} from "./lib/HookMiner.sol";

/// @notice One-shot testnet bootstrap: deploys mock tokens + oracles + the full Twine system,
///         authorizes and initializes a single MSTRX/cbBTC pool, and writes the resulting
///         addresses to `frontend/lib/deployments/<chain>.json` so the dashboard can pick them up.
/// @dev Reads optional `MULTISIG_ADDRESS` from env. When set, all Ownable contracts (STRAND,
///      TwineGovernor, TwinePositionManager, MultisigMarketHours) plus the vault's `rebalancer`
///      land on the multisig directly — no post-deploy transfer required. When unset, falls back
///      to the deployer address (useful for fast iteration). The buyback sink stays on the
///      deployer in both modes; switch it via `TwinePositionManager.setFeeConfig` post-deploy.
contract DeployTestnet is Script {
    using PoolIdLibrary for PoolKey;

    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336; // 1 << 96

    struct Deployed {
        address token0;
        address token1;
        address oracle0;
        address oracle1;
        address marketHours;
        address strand;
        address hook;
        address pm;
        address governor;
        address vault;
        bytes32 poolId;
    }

    function run() external returns (Deployed memory dep) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address multisig = _envOr("MULTISIG_ADDRESS", deployer);
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER"));

        console2.log("Chain id   ", block.chainid);
        console2.log("Deployer   ", deployer);
        console2.log("Multisig   ", multisig);
        console2.log("PoolManager", address(poolManager));

        vm.startBroadcast(pk);
        _deployMocks(deployer, multisig, dep);
        _deployCore(deployer, multisig, poolManager, dep);
        _createPool(deployer, multisig, poolManager, dep);
        vm.stopBroadcast();

        _logAndPersist(dep, address(poolManager));
    }

    function _envOr(string memory key, address fallback_) internal view returns (address) {
        try vm.envAddress(key) returns (address v) {
            return v;
        } catch {
            return fallback_;
        }
    }

    function _deployMocks(address deployer, address multisig, Deployed memory dep) internal {
        MockERC20 ta = new MockERC20("Twine Mock MSTRX", "tMSTRX", 18);
        MockERC20 tb = new MockERC20("Twine Mock cbBTC", "tcbBTC", 18);
        // sort by address so currency0 < currency1
        if (address(ta) < address(tb)) {
            dep.token0 = address(ta);
            dep.token1 = address(tb);
        } else {
            dep.token0 = address(tb);
            dep.token1 = address(ta);
        }
        dep.oracle0 = address(new MockPriceOracle(1e18));
        dep.oracle1 = address(new MockPriceOracle(1e18));
        // Market-hours flag is multisig-controlled (Safe flips it on NYSE open/close + holidays).
        dep.marketHours = address(new MultisigMarketHours(multisig, true));
        MockERC20(dep.token0).mint(deployer, 1e25);
        MockERC20(dep.token1).mint(deployer, 1e25);
    }

    function _deployCore(address deployer, address multisig, IPoolManager poolManager, Deployed memory dep) internal {
        // STRAND mint authority lives with the multisig from genesis (no script wiring needed).
        dep.strand = address(new STRAND(multisig));

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
        );
        // Hook governor starts as the deployer so this script can wire pools below; we hand it
        // to the TwineGovernor contract a few lines down. TwineGovernor and PM start owned by
        // the deployer so the script can call setVault / setFeeConfig; ownership is handed to
        // the multisig at the end of run() once wiring is complete.
        bytes memory hookInit = abi.encodePacked(type(TwineHook).creationCode, abi.encode(poolManager, deployer));
        (address mined, bytes32 salt) = HookMiner.find(flags, hookInit);
        dep.hook = HookMiner.deploy(salt, hookInit);
        require(dep.hook == mined, "DeployTestnet: hook mine mismatch");

        dep.pm = address(new TwinePositionManager(poolManager, deployer));
        dep.governor = address(new TwineGovernor(dep.hook, deployer));
        TwineHook(dep.hook).setGovernor(dep.governor);
    }

    function _createPool(address deployer, address multisig, IPoolManager poolManager, Deployed memory dep) internal {
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(dep.token0),
            currency1: Currency.wrap(dep.token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(dep.hook)
        });
        dep.poolId = PoolId.unwrap(key.toId());

        TwineGovernor(dep.governor)
            .authorizePool(
                key,
                TwineHook.AuthParams({
                oracle0: MockPriceOracle(dep.oracle0),
                oracle1: MockPriceOracle(dep.oracle1),
                marketHours: MultisigMarketHours(dep.marketHours),
                kScaled: 40_000,
                baseFeeBps: 30,
                toleranceBps: 500,
                hardThresholdBps: 1500
            })
            );
        poolManager.initialize(key, SQRT_PRICE_1_1);

        // Vault rebalancer is immutable; set it to the multisig at construction so seized STRAND
        // on a structural-break drawdown lands in multisig custody.
        dep.vault = address(new TwineUnderwritingVault(dep.strand, dep.hook, dep.token0, dep.token1, multisig));
        TwineGovernor(dep.governor).setVault(key, dep.vault, 2000);
        // Buyback sink → multisig; multisig later runs the off-chain market-buy-and-burn.
        TwinePositionManager(dep.pm).setFeeConfig(key, dep.vault, 2000, multisig, 1000);

        // Ownership handoff: deployer keeps no privileges after the script finishes.
        if (multisig != deployer) {
            TwineGovernor(dep.governor).transferOwnership(multisig);
            TwinePositionManager(dep.pm).setOwner(multisig);
        }
    }

    function _logAndPersist(Deployed memory dep, address poolManagerAddr) internal {
        console2.log("");
        console2.log("=== Twine Testnet Deployment ===");
        console2.log("token0       ", dep.token0);
        console2.log("token1       ", dep.token1);
        console2.log("oracle0      ", dep.oracle0);
        console2.log("oracle1      ", dep.oracle1);
        console2.log("marketHours  ", dep.marketHours);
        console2.log("strand       ", dep.strand);
        console2.log("hook         ", dep.hook);
        console2.log("pm           ", dep.pm);
        console2.log("governor     ", dep.governor);
        console2.log("vault        ", dep.vault);

        string memory chainName = block.chainid == 84532 ? "base-sepolia" : block.chainid == 8453 ? "base" : "unknown";
        string memory path = string.concat("frontend/lib/deployments/", chainName, ".json");

        string memory body = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "poolManager": "',
            vm.toString(poolManagerAddr),
            '",\n',
            '  "hook": "',
            vm.toString(dep.hook),
            '",\n',
            '  "positionManager": "',
            vm.toString(dep.pm),
            '",\n',
            '  "governor": "',
            vm.toString(dep.governor),
            '",\n',
            '  "strand": "',
            vm.toString(dep.strand),
            '",\n',
            '  "vault": "',
            vm.toString(dep.vault),
            '",\n'
        );
        body = string.concat(
            body,
            '  "token0": "',
            vm.toString(dep.token0),
            '",\n',
            '  "token1": "',
            vm.toString(dep.token1),
            '",\n',
            '  "oracle0": "',
            vm.toString(dep.oracle0),
            '",\n',
            '  "oracle1": "',
            vm.toString(dep.oracle1),
            '",\n',
            '  "marketHours": "',
            vm.toString(dep.marketHours),
            '",\n',
            '  "poolId": "',
            vm.toString(dep.poolId),
            '",\n',
            '  "tickSpacing": 60,\n',
            '  "baseFeeBps": 30,\n',
            '  "toleranceBps": 500,\n',
            '  "hardThresholdBps": 1500,\n',
            '  "drawdownBps": 2000,\n',
            '  "vaultFeeBps": 2000,\n',
            '  "buybackBps": 1000\n',
            "}\n"
        );

        vm.writeFile(path, body);
        console2.log("Wrote deployment to", path);
    }
}
