// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IMarketHoursOracle} from "../interfaces/IMarketHoursOracle.sol";

/// @title MockMarketHours
/// @notice Test-only {IMarketHoursOracle} with a settable open/closed flag.
contract MockMarketHours is IMarketHoursOracle {
    bool public open;

    constructor(bool _open) {
        open = _open;
    }

    function setOpen(bool _open) external {
        open = _open;
    }

    /// @inheritdoc IMarketHoursOracle
    function isMarketOpen() external view returns (bool) {
        return open;
    }
}
