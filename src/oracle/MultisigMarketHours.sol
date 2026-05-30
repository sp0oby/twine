// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IMarketHoursOracle} from "../interfaces/IMarketHoursOracle.sol";

/// @title MultisigMarketHours
/// @notice Production {IMarketHoursOracle} implementation: a multisig-updated open/closed flag.
/// @dev PROJECT_SPEC.md §6.1 fallback: if a real NYSE market-status feed is unavailable on the target
///      chain, governance (a multisig) flips this flag on weekly NYSE open/close and on US market
///      holidays. Off-chain monitoring observes `MarketStatusUpdated` and stale `lastUpdate`.
contract MultisigMarketHours is IMarketHoursOracle, Ownable {
    /// @notice Whether the equity market is currently open.
    bool public open;
    /// @notice Block timestamp of the last `setOpen` call (monitoring + freshness checks).
    uint64 public lastUpdate;

    event MarketStatusUpdated(bool open, uint64 at);

    constructor(address initialOwner, bool initiallyOpen) Ownable(initialOwner) {
        open = initiallyOpen;
        lastUpdate = uint64(block.timestamp);
        emit MarketStatusUpdated(initiallyOpen, lastUpdate);
    }

    /// @notice Update the open/closed flag.
    function setOpen(bool _open) external onlyOwner {
        open = _open;
        lastUpdate = uint64(block.timestamp);
        emit MarketStatusUpdated(_open, lastUpdate);
    }

    /// @inheritdoc IMarketHoursOracle
    function isMarketOpen() external view returns (bool) {
        return open;
    }
}
