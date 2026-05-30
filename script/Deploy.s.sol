// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";

import {TwineHook} from "../src/TwineHook.sol";
import {TwinePositionManager} from "../src/TwinePositionManager.sol";
import {TwineGovernor} from "../src/TwineGovernor.sol";
import {STRAND} from "../src/STRAND.sol";

import {HookMiner} from "./lib/HookMiner.sol";

/// @notice Deploys the Twine core: STRAND, TwineHook (CREATE2-mined to encode permissions),
///         TwinePositionManager, TwineGovernor — and hands the hook's governor role to the governor.
/// @dev Env required:
///        POOL_MANAGER             — v4 PoolManager on the target chain
///        DEPLOYER_PRIVATE_KEY     — the broadcaster
///        MULTISIG (optional)      — owner of STRAND/PM and owner of TwineGovernor; defaults to deployer
///      Per-pool wiring (vault, fee config, oracles) is `CreatePool.s.sol`.
contract Deploy is Script {
    struct Deployment {
        address strand;
        address hook;
        address positionManager;
        address governor;
    }

    function run() external returns (Deployment memory dep) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address multisig = vm.envOr("MULTISIG", deployer);
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER"));

        vm.startBroadcast(pk);
        dep = deployTwine(poolManager, deployer, multisig);
        vm.stopBroadcast();

        console2.log("STRAND              ", dep.strand);
        console2.log("TwineHook           ", dep.hook);
        console2.log("TwinePositionManager", dep.positionManager);
        console2.log("TwineGovernor       ", dep.governor);
    }

    /// @dev Deploy logic, separated so a test (or another script) can drive it without broadcast.
    function deployTwine(IPoolManager poolManager, address deployer, address multisig)
        public
        returns (Deployment memory dep)
    {
        // 1. STRAND owned by the multisig from day one
        STRAND strand = new STRAND(multisig);

        // 2. Mine a CREATE2 salt producing an address with the right permission bits, then deploy
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
        );
        bytes memory hookInit = abi.encodePacked(type(TwineHook).creationCode, abi.encode(poolManager, deployer));
        (address minedHook, bytes32 salt) = HookMiner.find(flags, hookInit);
        address deployed = HookMiner.deploy(salt, hookInit);
        if (deployed != minedHook) revert HookMiner.AddressMismatch(minedHook, deployed);
        TwineHook hook = TwineHook(deployed);

        // 3. PM owned by multisig; per-pool fee routing configured later via setFeeConfig
        TwinePositionManager pm = new TwinePositionManager(poolManager, multisig);

        // 4. Governor (Ownable, owner = multisig) takes over the hook's governance role
        TwineGovernor governor = new TwineGovernor(address(hook), multisig);
        hook.setGovernor(address(governor));

        dep = Deployment({
            strand: address(strand), hook: address(hook), positionManager: address(pm), governor: address(governor)
        });
    }
}
