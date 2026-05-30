// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SpreadMath} from "../../src/lib/SpreadMath.sol";

/// @dev External wrapper so revert-path tests have a real external call frame for vm.expectRevert
///      (internal library calls inline into the test contract, defeating expectRevert).
contract SpreadMathHarness {
    function fairPrice(uint256 a, uint256 b) external pure returns (uint256) {
        return SpreadMath.fairPrice(a, b);
    }

    function poolPrice(uint160 s, uint8 d0, uint8 d1) external pure returns (uint256) {
        return SpreadMath.poolPrice(s, d0, d1);
    }

    function computeDrift(uint256 p, uint256 f) external pure returns (int256) {
        return SpreadMath.computeDrift(p, f);
    }
}

contract SpreadMathTest is Test {
    uint256 constant WAD = 1e18;
    uint256 constant BPS = 10_000;

    SpreadMathHarness h;

    function setUp() public {
        h = new SpreadMathHarness();
    }

    // -----------------------------------------------------------------
    // fairPrice
    // -----------------------------------------------------------------

    function test_fairPrice_equalPrices() public pure {
        // both legs $100 -> fair price 1.0
        assertEq(SpreadMath.fairPrice(100e18, 100e18), 1e18);
    }

    function test_fairPrice_mstrxOverCbbtc() public pure {
        // token0 = MSTRX @ $400, token1 = cbBTC @ $100k -> 0.004 cbBTC per MSTRX
        assertEq(SpreadMath.fairPrice(400e18, 100_000e18), 0.004e18);
    }

    function testRevert_fairPrice_zeroPrice0() public {
        vm.expectRevert(SpreadMath.NonPositivePrice.selector);
        h.fairPrice(0, 100e18);
    }

    function testRevert_fairPrice_zeroPrice1() public {
        vm.expectRevert(SpreadMath.NonPositivePrice.selector);
        h.fairPrice(100e18, 0);
    }

    function testFuzz_fairPrice_matchesRatio(uint256 p0, uint256 p1) public pure {
        p0 = bound(p0, 1, 1e30);
        p1 = bound(p1, 1, 1e30);
        assertEq(SpreadMath.fairPrice(p0, p1), p0 * WAD / p1);
    }

    // -----------------------------------------------------------------
    // poolPrice
    // -----------------------------------------------------------------

    function test_poolPrice_unitSqrtEqualDecimals() public pure {
        // sqrtPriceX96 = 2^96 -> raw price 1; equal decimals -> human price 1.0
        assertEq(SpreadMath.poolPrice(uint160(1) << 96, 18, 18), 1e18);
    }

    function test_poolPrice_doubleSqrt() public pure {
        // sqrtPriceX96 = 2^97 -> raw price 4
        assertEq(SpreadMath.poolPrice(uint160(1) << 97, 18, 18), 4e18);
    }

    function test_poolPrice_decimalAdjustment() public pure {
        // raw price 1, token0 18 dec, token1 6 dec -> human price 1e12 (in WAD: 1e30)
        assertEq(SpreadMath.poolPrice(uint160(1) << 96, 18, 6), 1e30);
    }

    function testRevert_poolPrice_zeroSqrt() public {
        vm.expectRevert(SpreadMath.NonPositivePrice.selector);
        h.poolPrice(0, 18, 18);
    }

    function testFuzz_poolPrice_noOverflow(uint160 sqrtPriceX96, uint8 dec0, uint8 dec1) public pure {
        // bound to Uniswap's valid sqrt-price domain and realistic decimals
        sqrtPriceX96 = uint160(bound(sqrtPriceX96, 4295128739, 1461446703485210103287273052203988822378723970342));
        dec0 = uint8(bound(dec0, 0, 18));
        dec1 = uint8(bound(dec1, 0, 18));
        SpreadMath.poolPrice(sqrtPriceX96, dec0, dec1); // must not revert
    }

    // -----------------------------------------------------------------
    // computeDrift
    // -----------------------------------------------------------------

    function test_computeDrift_atPeg() public pure {
        assertEq(SpreadMath.computeDrift(1e18, 1e18), int256(0));
    }

    function test_computeDrift_poolAbove() public pure {
        // pool 5% above fair -> +500 bps
        assertEq(SpreadMath.computeDrift(1.05e18, 1e18), int256(500));
    }

    function test_computeDrift_poolBelow() public pure {
        // pool 50% below fair -> -5000 bps
        assertEq(SpreadMath.computeDrift(1e18, 2e18), int256(-5000));
    }

    function test_computeDrift_poolZero() public pure {
        // pool price 0 -> -100% = -10000 bps (lower bound)
        assertEq(SpreadMath.computeDrift(0, 1e18), int256(-10_000));
    }

    function test_computeDrift_clampsPositiveToIntMax() public pure {
        // pathological: huge pool vs tiny fair -> magnitude clamped to int256 max
        assertEq(SpreadMath.computeDrift(1e73, 1), type(int256).max);
    }

    function testRevert_computeDrift_zeroFair() public {
        vm.expectRevert(SpreadMath.ZeroFairPrice.selector);
        h.computeDrift(1e18, 0);
    }

    function testFuzz_computeDrift_signMatchesOrder(uint256 pool, uint256 fair) public pure {
        pool = bound(pool, 0, 1e40);
        fair = bound(fair, 1, 1e40);
        int256 d = SpreadMath.computeDrift(pool, fair);
        // Sign is non-strict: tiny pool/fair gaps round the magnitude down to 0 bps.
        if (pool >= fair) assertGe(d, 0);
        else assertLe(d, 0);
        // negative branch is bounded below by -100%
        assertGe(d, int256(-10_000));
    }

    // -----------------------------------------------------------------
    // asymmetricFee
    // -----------------------------------------------------------------

    // base=30bps, drift=+500bps (5%), k=4.0 (kScaled=40_000)
    function test_asymmetricFee_adversarialPremium() public pure {
        assertEq(SpreadMath.asymmetricFee(30, int256(500), 40_000, false), 36);
    }

    function test_asymmetricFee_correctiveDiscount() public pure {
        assertEq(SpreadMath.asymmetricFee(30, int256(500), 40_000, true), 24);
    }

    function test_asymmetricFee_correctiveFloorsAtZero() public pure {
        // adj = 4 * 100% = 400% > 100% -> corrective multiplier floored to 0
        assertEq(SpreadMath.asymmetricFee(30, int256(10_000), 40_000, true), 0);
    }

    function test_asymmetricFee_clampsToCap() public pure {
        // adversarial at 100% drift would be 150 bps -> clamped to MAX_FEE_CAP_BPS (100)
        assertEq(SpreadMath.asymmetricFee(30, int256(10_000), 40_000, false), SpreadMath.MAX_FEE_CAP_BPS);
    }

    function test_asymmetricFee_zeroDriftEqualsBase() public pure {
        assertEq(SpreadMath.asymmetricFee(30, int256(0), 40_000, false), 30);
        assertEq(SpreadMath.asymmetricFee(30, int256(0), 40_000, true), 30);
    }

    function testFuzz_asymmetricFee_neverExceedsCap(uint256 baseFeeBps, int256 driftBps, uint256 kScaled, bool corr)
        public
        pure
    {
        baseFeeBps = bound(baseFeeBps, 0, 1_000_000);
        kScaled = bound(kScaled, 0, 1_000_000);
        driftBps = bound(driftBps, -100_000, 100_000);
        assertLe(SpreadMath.asymmetricFee(baseFeeBps, driftBps, kScaled, corr), SpreadMath.MAX_FEE_CAP_BPS);
    }

    // fee depends only on |drift| for a fixed direction
    function testFuzz_asymmetricFee_signSymmetric(uint256 baseFeeBps, int256 driftBps, uint256 kScaled, bool corr)
        public
        pure
    {
        baseFeeBps = bound(baseFeeBps, 0, 100);
        kScaled = bound(kScaled, 0, 100_000);
        driftBps = bound(driftBps, -50_000, 50_000);
        uint256 pos = SpreadMath.asymmetricFee(baseFeeBps, _absInt(driftBps), kScaled, corr);
        uint256 neg = SpreadMath.asymmetricFee(baseFeeBps, -_absInt(driftBps), kScaled, corr);
        assertEq(pos, neg);
    }

    // adversarial fee always >= corrective fee for the same |drift|
    function testFuzz_asymmetricFee_adversarialGeCorrective(uint256 baseFeeBps, int256 driftBps, uint256 kScaled)
        public
        pure
    {
        baseFeeBps = bound(baseFeeBps, 0, 100);
        kScaled = bound(kScaled, 0, 100_000);
        driftBps = bound(driftBps, -50_000, 50_000);
        uint256 adv = SpreadMath.asymmetricFee(baseFeeBps, driftBps, kScaled, false);
        uint256 corr = SpreadMath.asymmetricFee(baseFeeBps, driftBps, kScaled, true);
        assertGe(adv, corr);
    }

    // adversarial fee is monotonically non-decreasing in |drift| (until the cap)
    function testFuzz_asymmetricFee_adversarialMonotonic(uint256 baseFeeBps, uint256 d1, uint256 d2, uint256 kScaled)
        public
        pure
    {
        baseFeeBps = bound(baseFeeBps, 1, 50);
        kScaled = bound(kScaled, 0, 80_000);
        d1 = bound(d1, 0, 20_000);
        d2 = bound(d2, d1, 20_000); // d2 >= d1
        uint256 f1 = SpreadMath.asymmetricFee(baseFeeBps, int256(d1), kScaled, false);
        uint256 f2 = SpreadMath.asymmetricFee(baseFeeBps, int256(d2), kScaled, false);
        assertGe(f2, f1);
    }

    // -----------------------------------------------------------------
    // isInBand / isStructuralBreak (boundary behavior)
    // -----------------------------------------------------------------

    function test_isInBand_boundaryInclusive() public pure {
        assertTrue(SpreadMath.isInBand(int256(500), 500)); // exactly at tolerance -> in band
        assertTrue(SpreadMath.isInBand(int256(-500), 500));
        assertFalse(SpreadMath.isInBand(int256(501), 500)); // one bps over -> out
    }

    function test_isStructuralBreak_boundaryInclusive() public pure {
        assertTrue(SpreadMath.isStructuralBreak(int256(1500), 1500)); // exactly at threshold -> break
        assertTrue(SpreadMath.isStructuralBreak(int256(-1500), 1500));
        assertFalse(SpreadMath.isStructuralBreak(int256(1499), 1500)); // one bps under -> not broken
    }

    // -----------------------------------------------------------------
    // helpers
    // -----------------------------------------------------------------

    function _absInt(int256 x) private pure returns (int256) {
        return x >= 0 ? x : -x;
    }
}
