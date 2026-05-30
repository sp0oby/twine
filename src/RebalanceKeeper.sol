// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {PoolKey} from "v4-core/src/types/PoolKey.sol";

import {TwineHook} from "./TwineHook.sol";
import {TwinePositionManager} from "./TwinePositionManager.sol";

/// @title RebalanceKeeper
/// @notice Permissionless entry point that keeps a Twine pool's protocol state fresh
///         (PROJECT_SPEC.md §5.1, §8.1).
/// @dev A thin convenience wrapper — anyone may call {keep} to:
///        1. Force a structural-break check on the hook (so a drift past the hard threshold triggers
///           the drawdown even when no swap has occurred since the oracle moved).
///        2. Poke the position manager's fee realization, routing the protocol cuts (vault rewards
///           and buyback sink) and refreshing the per-share fee accumulator.
///      Holds no funds and has no privileges — both calls are themselves permissionless and gated by
///      the hook / PM as appropriate.
contract RebalanceKeeper {
    /// @notice The hook this keeper services.
    TwineHook public immutable hook;
    /// @notice The position manager this keeper services.
    TwinePositionManager public immutable pm;

    error ZeroAddress();

    constructor(TwineHook _hook, TwinePositionManager _pm) {
        if (address(_hook) == address(0) || address(_pm) == address(0)) revert ZeroAddress();
        hook = _hook;
        pm = _pm;
    }

    /// @notice Refresh a pool's protocol state: detect any structural break and realize pool fees.
    /// @dev Reverts only if an oracle is stale; all other "no-op" conditions silently pass through.
    function keep(PoolKey calldata key) external {
        hook.checkStructuralBreak(key);
        pm.collectFees(key, address(this));
    }
}
