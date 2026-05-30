// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title IPriceOracle
/// @notice Minimal price source for one asset leg of a Twine pool.
/// @dev Implementations MUST return a price normalized to 1e18 (WAD) and MUST revert
///      (rather than return a stale or invalid value) when the underlying feed is unhealthy.
///      Returning a bad price silently is a critical failure mode for the hook.
interface IPriceOracle {
    /// @notice Latest USD price of the asset, normalized to 1e18.
    /// @dev Reverts if the price is non-positive or stale beyond the implementation's threshold.
    /// @return priceWad The price in 1e18 fixed-point.
    function getPrice() external view returns (uint256 priceWad);
}
