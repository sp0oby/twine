// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @title MockPriceOracle
/// @notice Test-only {IPriceOracle} with a settable WAD price and a toggleable stale flag.
/// @dev Lets hook tests exercise drift, staleness-revert, and structural-break paths deterministically.
contract MockPriceOracle is IPriceOracle {
    uint256 public priceWad;
    bool public stale;

    /// @notice Thrown when the mock is configured to simulate a stale feed.
    error MockStale();

    constructor(uint256 _priceWad) {
        priceWad = _priceWad;
    }

    function setPrice(uint256 _priceWad) external {
        priceWad = _priceWad;
    }

    function setStale(bool _stale) external {
        stale = _stale;
    }

    /// @inheritdoc IPriceOracle
    function getPrice() external view returns (uint256) {
        if (stale) revert MockStale();
        return priceWad;
    }
}
