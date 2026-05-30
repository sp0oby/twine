// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";

import {TwineHook} from "../src/TwineHook.sol";
import {TwineGovernor} from "../src/TwineGovernor.sol";
import {TwinePositionManager} from "../src/TwinePositionManager.sol";
import {TwineUnderwritingVault} from "../src/TwineUnderwritingVault.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {IMarketHoursOracle} from "../src/interfaces/IMarketHoursOracle.sol";

/// @notice Authorizes and initializes a Twine pool, deploys its underwriting vault, and wires the
///         hook drawdown + PM fee routing for it.
/// @dev The broadcaster MUST be the owner of {TwineGovernor} and {TwinePositionManager} (the v1
///      multisig). For testnet single-signer runs, set `MULTISIG=DEPLOYER_ADDRESS` so the same key
///      that ran `Deploy.s.sol` runs this.
///
///      Required env:
///        DEPLOYER_PRIVATE_KEY
///        POOL_MANAGER, HOOK, GOVERNOR, POSITION_MANAGER, STRAND
///        TOKEN0, TOKEN1                — sorted (currency0 address < currency1 address)
///        ORACLE0, ORACLE1              — IPriceOracle for each leg (1e18-normalized USD)
///        MARKET_HOURS                  — IMarketHoursOracle (use address(0) for crypto/crypto pairs)
///        REBALANCER, BUYBACK_SINK      — treasury / keeper addresses
///        SQRT_PRICE_X96                — initial pool price (Q64.96)
///      Optional env (defaults per PROJECT_SPEC.md §3, §7.3):
///        TICK_SPACING (60), K_SCALED (40000), BASE_FEE_BPS (30), TOLERANCE_BPS (500),
///        HARD_THRESHOLD_BPS (1500), DRAWDOWN_BPS (2000), VAULT_FEE_BPS (2000), BUYBACK_BPS (1000)
contract CreatePool is Script {
    struct PoolConfig {
        address token0;
        address token1;
        IPriceOracle oracle0;
        IPriceOracle oracle1;
        IMarketHoursOracle marketHours;
        address rebalancer;
        address buybackSink;
        uint160 sqrtPriceX96;
        int24 tickSpacing;
        uint32 kScaled;
        uint16 baseFeeBps;
        uint16 toleranceBps;
        uint16 hardThresholdBps;
        uint16 drawdownBps;
        uint16 vaultFeeBps;
        uint16 buybackBps;
    }

    function run() external returns (PoolKey memory key, address vault) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER"));
        TwineHook hook = TwineHook(vm.envAddress("HOOK"));
        TwineGovernor governor = TwineGovernor(vm.envAddress("GOVERNOR"));
        TwinePositionManager pm = TwinePositionManager(vm.envAddress("POSITION_MANAGER"));
        address strand = vm.envAddress("STRAND");

        PoolConfig memory c = _loadConfig();
        require(c.token0 < c.token1, "CreatePool: token0 must sort below token1");

        vm.startBroadcast(pk);

        // 1. per-pool underwriting vault (token0/1 = the pool's tokens for fee rewards)
        vault = address(new TwineUnderwritingVault(strand, address(hook), c.token0, c.token1, c.rebalancer));

        // 2. build the pool key (dynamic fee, with the hook)
        key = PoolKey({
            currency0: Currency.wrap(c.token0),
            currency1: Currency.wrap(c.token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: c.tickSpacing,
            hooks: IHooks(address(hook))
        });

        // 3. governance authorizes the pool BEFORE initialize (beforeInitialize requires config)
        governor.authorizePool(
            key,
            TwineHook.AuthParams({
                oracle0: c.oracle0,
                oracle1: c.oracle1,
                marketHours: c.marketHours,
                kScaled: c.kScaled,
                baseFeeBps: c.baseFeeBps,
                toleranceBps: c.toleranceBps,
                hardThresholdBps: c.hardThresholdBps
            })
        );

        // 4. initialize the pool in the PoolManager
        poolManager.initialize(key, c.sqrtPriceX96);

        // 5. wire the vault into the hook (drawdown on structural break) and into the PM (fee routing)
        governor.setVault(key, vault, c.drawdownBps);
        pm.setFeeConfig(key, vault, c.vaultFeeBps, c.buybackSink, c.buybackBps);

        vm.stopBroadcast();

        console2.log("Vault         ", vault);
        console2.log("Pool currency0", c.token0);
        console2.log("Pool currency1", c.token1);
    }

    function _loadConfig() internal view returns (PoolConfig memory c) {
        c.token0 = vm.envAddress("TOKEN0");
        c.token1 = vm.envAddress("TOKEN1");
        c.oracle0 = IPriceOracle(vm.envAddress("ORACLE0"));
        c.oracle1 = IPriceOracle(vm.envAddress("ORACLE1"));
        c.marketHours = IMarketHoursOracle(vm.envOr("MARKET_HOURS", address(0)));
        c.rebalancer = vm.envAddress("REBALANCER");
        c.buybackSink = vm.envAddress("BUYBACK_SINK");
        c.sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));
        c.tickSpacing = int24(int256(vm.envOr("TICK_SPACING", uint256(60))));
        c.kScaled = uint32(vm.envOr("K_SCALED", uint256(40_000)));
        c.baseFeeBps = uint16(vm.envOr("BASE_FEE_BPS", uint256(30)));
        c.toleranceBps = uint16(vm.envOr("TOLERANCE_BPS", uint256(500)));
        c.hardThresholdBps = uint16(vm.envOr("HARD_THRESHOLD_BPS", uint256(1500)));
        c.drawdownBps = uint16(vm.envOr("DRAWDOWN_BPS", uint256(2000)));
        c.vaultFeeBps = uint16(vm.envOr("VAULT_FEE_BPS", uint256(2000)));
        c.buybackBps = uint16(vm.envOr("BUYBACK_BPS", uint256(1000)));
    }
}
