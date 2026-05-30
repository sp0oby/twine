// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {STRAND} from "../../src/STRAND.sol";
import {TwineUnderwritingVault} from "../../src/TwineUnderwritingVault.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

/// @notice Tests for the underwriting vault. This test contract plays the role of the hook (so it
///         can call `drawdown`) and the fee router (so it can call `depositRewards`).
contract TwineUnderwritingVaultTest is Test {
    STRAND strand;
    MockERC20 token0;
    MockERC20 token1;
    TwineUnderwritingVault vault;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address rebalancer = makeAddr("rebalancer");

    function setUp() public {
        strand = new STRAND(address(this));
        token0 = new MockERC20("Token0", "T0", 18);
        token1 = new MockERC20("Token1", "T1", 18);
        // this contract is both the hook (drawdown caller) and the reward funder
        vault = new TwineUnderwritingVault(address(strand), address(this), address(token0), address(token1), rebalancer);

        strand.mint(alice, 1_000e18);
        strand.mint(bob, 1_000e18);
        token0.mint(address(this), 1_000e18);
        token1.mint(address(this), 1_000e18);
        token0.approve(address(vault), type(uint256).max);
        token1.approve(address(vault), type(uint256).max);

        vm.prank(alice);
        strand.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        strand.approve(address(vault), type(uint256).max);
    }

    function _stake(address who, uint256 amount) internal {
        vm.prank(who);
        vault.stake(amount);
    }

    // -----------------------------------------------------------------
    // staking
    // -----------------------------------------------------------------

    function test_stake_accounting() public {
        _stake(alice, 100e18);
        assertEq(vault.sharesOf(alice), 100e18);
        assertEq(vault.totalShares(), 100e18);
        assertEq(vault.totalStaked(), 100e18);
        assertEq(strand.balanceOf(address(vault)), 100e18);
    }

    function testRevert_stake_zero() public {
        vm.prank(alice);
        vm.expectRevert(TwineUnderwritingVault.ZeroAmount.selector);
        vault.stake(0);
    }

    // -----------------------------------------------------------------
    // fee rewards
    // -----------------------------------------------------------------

    function test_rewards_distributedProRata() public {
        _stake(alice, 100e18);
        _stake(bob, 100e18);
        vault.depositRewards(100e18, 40e18); // 50/50 split between two equal stakers

        (uint256 ap0, uint256 ap1) = vault.pendingRewards(alice);
        assertEq(ap0, 50e18);
        assertEq(ap1, 20e18);

        uint256 a0 = token0.balanceOf(alice);
        vm.prank(alice);
        (uint256 c0, uint256 c1) = vault.claim();
        assertEq(c0, 50e18);
        assertEq(c1, 20e18);
        assertEq(token0.balanceOf(alice) - a0, 50e18);
    }

    function test_rewards_token1Only() public {
        _stake(alice, 100e18);
        vault.depositRewards(0, 30e18); // fees can arrive in a single token
        (uint256 p0, uint256 p1) = vault.pendingRewards(alice);
        assertEq(p0, 0);
        assertEq(p1, 30e18);
    }

    function testRevert_depositRewards_noStakers() public {
        vm.expectRevert(TwineUnderwritingVault.NoStakers.selector);
        vault.depositRewards(1e18, 0);
    }

    /// @notice A staker who joins after fees accrued does not dilute earlier stakers' rewards.
    function test_rewards_lateStakerNoDilution() public {
        _stake(alice, 100e18);
        vault.depositRewards(100e18, 0); // all to alice
        _stake(bob, 100e18); // bob joins after

        (uint256 ap0,) = vault.pendingRewards(alice);
        (uint256 bp0,) = vault.pendingRewards(bob);
        assertEq(ap0, 100e18);
        assertEq(bp0, 0);
    }

    // -----------------------------------------------------------------
    // drawdown haircut
    // -----------------------------------------------------------------

    function test_drawdown_proRataHaircut() public {
        _stake(alice, 100e18);
        _stake(bob, 100e18);

        uint256 seized = vault.drawdown(2500); // 25% of 200 = 50
        assertEq(seized, 50e18);
        assertEq(vault.totalStaked(), 150e18);
        assertEq(strand.balanceOf(rebalancer), 50e18);

        // alice redeems: 100 shares * 150 / 200 = 75 STRAND (took her pro-rata haircut)
        vm.prank(alice);
        vault.requestUnstake(100e18);
        skip(vault.COOLDOWN());
        uint256 a = strand.balanceOf(alice);
        vm.prank(alice);
        uint256 out = vault.unstake();
        assertEq(out, 75e18);
        assertEq(strand.balanceOf(alice) - a, 75e18);
    }

    function testRevert_drawdown_notHook() public {
        _stake(alice, 100e18);
        vm.prank(alice);
        vm.expectRevert(TwineUnderwritingVault.NotHook.selector);
        vault.drawdown(1000);
    }

    function testRevert_drawdown_bpsTooHigh() public {
        _stake(alice, 100e18);
        vm.expectRevert(TwineUnderwritingVault.InvalidBps.selector);
        vault.drawdown(10_001);
    }

    /// @notice A full drawdown seizes exactly the staked balance and never more.
    function test_drawdown_neverOverBalance() public {
        _stake(alice, 100e18);
        _stake(bob, 60e18);
        uint256 seized = vault.drawdown(10_000); // 100%
        assertEq(seized, 160e18);
        assertEq(vault.totalStaked(), 0);
        assertEq(strand.balanceOf(address(vault)), 0);
        // a further drawdown seizes nothing
        assertEq(vault.drawdown(5000), 0);
    }

    // -----------------------------------------------------------------
    // cooldown
    // -----------------------------------------------------------------

    function test_cooldown_enforced() public {
        _stake(alice, 100e18);
        vm.prank(alice);
        vault.requestUnstake(100e18);

        vm.prank(alice);
        vm.expectRevert(TwineUnderwritingVault.CooldownActive.selector);
        vault.unstake();

        skip(vault.COOLDOWN());
        vm.prank(alice);
        assertEq(vault.unstake(), 100e18);
    }

    /// @notice A staker mid-cooldown still absorbs a drawdown — they cannot dodge the haircut by exiting.
    function test_pendingUnstaker_stillTakesHaircut() public {
        _stake(alice, 100e18);
        _stake(bob, 100e18);

        vm.prank(alice);
        vault.requestUnstake(100e18); // alice queues her exit

        vault.drawdown(2500); // break happens during her cooldown

        skip(vault.COOLDOWN());
        vm.prank(alice);
        assertEq(vault.unstake(), 75e18); // still took the 25% haircut
    }

    function testRevert_unstake_noPending() public {
        _stake(alice, 100e18);
        vm.prank(alice);
        vm.expectRevert(TwineUnderwritingVault.NoPendingUnstake.selector);
        vault.unstake();
    }

    function testRevert_requestUnstake_alreadyPending() public {
        _stake(alice, 100e18);
        vm.startPrank(alice);
        vault.requestUnstake(50e18);
        vm.expectRevert(TwineUnderwritingVault.UnstakeAlreadyPending.selector);
        vault.requestUnstake(10e18);
        vm.stopPrank();
    }

    function testRevert_requestUnstake_tooMany() public {
        _stake(alice, 100e18);
        vm.prank(alice);
        vm.expectRevert(TwineUnderwritingVault.InsufficientShares.selector);
        vault.requestUnstake(101e18);
    }
}
