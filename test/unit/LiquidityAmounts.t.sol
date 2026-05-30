// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {LiquidityAmounts} from "../../src/lib/LiquidityAmounts.sol";

contract LiquidityAmountsHarness {
    function forAmount0(uint160 a, uint160 b, uint256 amount0) external pure returns (uint128) {
        return LiquidityAmounts.getLiquidityForAmount0(a, b, amount0);
    }

    function forAmount1(uint160 a, uint160 b, uint256 amount1) external pure returns (uint128) {
        return LiquidityAmounts.getLiquidityForAmount1(a, b, amount1);
    }

    function forAmounts(uint160 p, uint160 a, uint160 b, uint256 amount0, uint256 amount1)
        external
        pure
        returns (uint128)
    {
        return LiquidityAmounts.getLiquidityForAmounts(p, a, b, amount0, amount1);
    }
}

contract LiquidityAmountsTest is Test {
    uint160 constant Q96 = uint160(1 << 96);
    uint160 constant TWO_Q96 = uint160(2 << 96);

    LiquidityAmountsHarness h;

    function setUp() public {
        h = new LiquidityAmountsHarness();
    }

    function test_forAmount1_knownValue() public pure {
        // L1 = amount1 * Q96 / (sqrtB - sqrtA); range [Q96, 2Q96] -> denominator Q96 -> L1 == amount1
        assertEq(LiquidityAmounts.getLiquidityForAmount1(Q96, TWO_Q96, 5e18), 5e18);
    }

    function test_forAmount0_knownValue() public pure {
        // intermediate = Q96*2Q96/Q96 = 2Q96; L0 = amount0 * 2Q96 / Q96 = 2 * amount0
        assertEq(LiquidityAmounts.getLiquidityForAmount0(Q96, TWO_Q96, 5e18), 10e18);
    }

    function test_forAmount0_swapsUnorderedBounds() public pure {
        // passing bounds reversed must give the same result
        assertEq(
            LiquidityAmounts.getLiquidityForAmount0(TWO_Q96, Q96, 5e18),
            LiquidityAmounts.getLiquidityForAmount0(Q96, TWO_Q96, 5e18)
        );
    }

    function test_forAmounts_priceBelowRange_usesAmount0() public pure {
        // p <= sqrtA -> all token0
        uint128 l = LiquidityAmounts.getLiquidityForAmounts(Q96 - 1, Q96, TWO_Q96, 5e18, 0);
        assertEq(l, LiquidityAmounts.getLiquidityForAmount0(Q96, TWO_Q96, 5e18));
    }

    function test_forAmounts_priceAboveRange_usesAmount1() public pure {
        // p >= sqrtB -> all token1
        uint128 l = LiquidityAmounts.getLiquidityForAmounts(TWO_Q96 + 1, Q96, TWO_Q96, 0, 5e18);
        assertEq(l, LiquidityAmounts.getLiquidityForAmount1(Q96, TWO_Q96, 5e18));
    }

    function test_forAmounts_priceInRange_usesMin() public pure {
        // mid-range -> min(L0, L1); with these inputs L1 (small amount1) binds
        uint160 mid = uint160(uint256(Q96) * 3 / 2);
        uint128 l = LiquidityAmounts.getLiquidityForAmounts(mid, Q96, TWO_Q96, 100e18, 1e18);
        uint128 l0 = LiquidityAmounts.getLiquidityForAmount0(mid, TWO_Q96, 100e18);
        uint128 l1 = LiquidityAmounts.getLiquidityForAmount1(Q96, mid, 1e18);
        assertEq(l, l0 < l1 ? l0 : l1);
    }

    function test_forAmounts_swapsUnorderedBounds() public pure {
        uint160 mid = uint160(uint256(Q96) * 3 / 2);
        assertEq(
            LiquidityAmounts.getLiquidityForAmounts(mid, TWO_Q96, Q96, 100e18, 1e18),
            LiquidityAmounts.getLiquidityForAmounts(mid, Q96, TWO_Q96, 100e18, 1e18)
        );
    }

    function test_forAmount1_swapsUnorderedBounds() public pure {
        assertEq(
            LiquidityAmounts.getLiquidityForAmount1(TWO_Q96, Q96, 5e18),
            LiquidityAmounts.getLiquidityForAmount1(Q96, TWO_Q96, 5e18)
        );
    }

    function test_forAmounts_priceInRange_amount0Binds() public pure {
        // large amount1, small amount0 -> L0 binds (the other side of the min ternary)
        uint160 mid = uint160(uint256(Q96) * 3 / 2);
        uint128 l = LiquidityAmounts.getLiquidityForAmounts(mid, Q96, TWO_Q96, 1e18, 100e18);
        uint128 l0 = LiquidityAmounts.getLiquidityForAmount0(mid, TWO_Q96, 1e18);
        uint128 l1 = LiquidityAmounts.getLiquidityForAmount1(Q96, mid, 100e18);
        assertEq(l, l0 < l1 ? l0 : l1);
        assertEq(l, l0); // confirm L0 is the binding side here
    }

    function testRevert_forAmount1_overflowUint128() public {
        // amount1 large enough that L1 exceeds uint128 max -> Overflow
        vm.expectRevert(LiquidityAmounts.Overflow.selector);
        h.forAmount1(Q96, TWO_Q96, uint256(type(uint128).max) + 1);
    }
}
