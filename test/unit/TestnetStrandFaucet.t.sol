// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

import {STRAND} from "../../src/STRAND.sol";
import {TestnetStrandFaucet} from "../../src/testnet/TestnetStrandFaucet.sol";

contract TestnetStrandFaucetTest is Test {
    STRAND strand;
    TestnetStrandFaucet faucet;
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    function setUp() public {
        strand = new STRAND(address(this));
        faucet = new TestnetStrandFaucet(address(strand));
        strand.mint(address(faucet), 100_000e18);
    }

    function test_claim_transfersDropAndStartsCooldown() public {
        uint256 before = strand.balanceOf(ALICE);
        vm.prank(ALICE);
        faucet.claim();
        assertEq(strand.balanceOf(ALICE), before + faucet.DROP_AMOUNT());
        assertEq(faucet.lastClaim(ALICE), block.timestamp);
    }

    function test_claim_distinctAddressesIndependent() public {
        vm.prank(ALICE);
        faucet.claim();
        vm.prank(BOB);
        faucet.claim();
        assertEq(strand.balanceOf(ALICE), faucet.DROP_AMOUNT());
        assertEq(strand.balanceOf(BOB), faucet.DROP_AMOUNT());
    }

    function testRevert_claim_cooldownActive() public {
        vm.prank(ALICE);
        faucet.claim();
        vm.warp(block.timestamp + faucet.COOLDOWN() - 1);
        vm.prank(ALICE);
        vm.expectRevert(abi.encodeWithSelector(TestnetStrandFaucet.CooldownActive.selector, block.timestamp + 1));
        faucet.claim();
    }

    function test_claim_allowedExactlyAtCooldownEnd() public {
        vm.prank(ALICE);
        faucet.claim();
        vm.warp(block.timestamp + faucet.COOLDOWN());
        vm.prank(ALICE);
        faucet.claim();
        assertEq(strand.balanceOf(ALICE), faucet.DROP_AMOUNT() * 2);
    }

    function testRevert_claim_faucetEmpty() public {
        // Drain the faucet by burning its balance via repeated claims.
        // Cleaner: deploy a fresh faucet with no funding.
        TestnetStrandFaucet empty = new TestnetStrandFaucet(address(strand));
        vm.prank(ALICE);
        vm.expectRevert(TestnetStrandFaucet.InsufficientFaucetBalance.selector);
        empty.claim();
    }

    function testRevert_constructor_zeroAddress() public {
        vm.expectRevert(TestnetStrandFaucet.ZeroAddress.selector);
        new TestnetStrandFaucet(address(0));
    }

    function test_nextClaimAt_returnsZeroForNewUser() public view {
        assertEq(faucet.nextClaimAt(ALICE), 0);
    }

    function test_nextClaimAt_returnsCooldownEndAfterClaim() public {
        vm.prank(ALICE);
        faucet.claim();
        assertEq(faucet.nextClaimAt(ALICE), block.timestamp + faucet.COOLDOWN());
    }

    function test_remaining_reflectsBalance() public {
        assertEq(faucet.remaining(), 100_000e18);
        vm.prank(ALICE);
        faucet.claim();
        assertEq(faucet.remaining(), 100_000e18 - faucet.DROP_AMOUNT());
    }
}
