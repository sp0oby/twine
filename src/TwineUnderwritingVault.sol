// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.26;

import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

import {IUnderwritingVault} from "./interfaces/IUnderwritingVault.sol";

/// @title TwineUnderwritingVault
/// @notice Per-pool insurance vault. STRAND stakers underwrite structural-break risk: on a break
///         the bound hook seizes a fraction of staked STRAND (a pro-rata haircut) to fund a
///         rebalance. In return, stakers earn a share of the pool's swap fees (PROJECT_SPEC.md §3.5, §7).
/// @dev Staking uses a shares-over-assets model: `assets = shares * totalStaked / totalShares`. A
///      drawdown reduces `totalStaked` (not shares), so every staker's redemption value drops pro-rata
///      — the haircut. Fee rewards (token0/token1) are tracked in a separate per-share accumulator and
///      are unaffected by drawdowns. Unstaking requires a {COOLDOWN}; requested shares remain staked
///      (and exposed to drawdown) during the cooldown so stakers cannot dodge a haircut by exiting.
contract TwineUnderwritingVault is IUnderwritingVault, ReentrancyGuard {
    uint256 private constant BPS = 10_000;
    uint256 private constant ACC_PRECISION = 1e18;

    /// @notice Cooldown between requesting and completing an unstake.
    uint256 public constant COOLDOWN = 7 days;

    /// @notice The staked asset.
    address public immutable strand;
    /// @notice The only address allowed to trigger a drawdown.
    address public immutable hook;
    /// @notice Pool reward tokens (the pool's two legs).
    address public immutable token0;
    address public immutable token1;
    /// @notice Recipient of seized STRAND on a drawdown (treasury / rebalancer).
    address public immutable rebalancer;

    /// @notice Total staking shares outstanding.
    uint256 public totalShares;
    /// @notice STRAND currently backing those shares (reduced by drawdowns).
    uint256 public totalStaked;
    mapping(address => uint256) public sharesOf;

    struct PendingUnstake {
        uint256 shares;
        uint256 releaseAt;
    }

    mapping(address => PendingUnstake) public pendingUnstake;

    /// @notice Accumulated reward per share (token0/token1), scaled by {ACC_PRECISION}.
    uint256 public accReward0;
    uint256 public accReward1;
    mapping(address => uint256) public rewardDebt0;
    mapping(address => uint256) public rewardDebt1;

    event Staked(address indexed user, uint256 amount, uint256 shares);
    event UnstakeRequested(address indexed user, uint256 shares, uint256 releaseAt);
    event Unstaked(address indexed user, uint256 shares, uint256 amount);
    event RewardsDeposited(uint256 amount0, uint256 amount1);
    event RewardsClaimed(address indexed user, uint256 amount0, uint256 amount1);
    event Drawdown(uint256 seized, uint256 totalStakedAfter);

    error NotHook();
    error ZeroAmount();
    error InvalidBps();
    error NoStakers();
    error InsufficientShares();
    error UnstakeAlreadyPending();
    error NoPendingUnstake();
    error CooldownActive();

    modifier onlyHook() {
        if (msg.sender != hook) revert NotHook();
        _;
    }

    constructor(address strand_, address hook_, address token0_, address token1_, address rebalancer_) {
        strand = strand_;
        hook = hook_;
        token0 = token0_;
        token1 = token1_;
        rebalancer = rebalancer_;
    }

    // --------------------------------------------------------------------
    // Staking
    // --------------------------------------------------------------------

    /// @notice Stake STRAND and receive vault shares.
    function stake(uint256 amount) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();
        _harvest(msg.sender);

        shares = totalShares == 0 ? amount : FixedPointMathLib.fullMulDiv(amount, totalShares, totalStaked);
        SafeTransferLib.safeTransferFrom(strand, msg.sender, address(this), amount);

        sharesOf[msg.sender] += shares;
        totalShares += shares;
        totalStaked += amount;
        _checkpoint(msg.sender);

        emit Staked(msg.sender, amount, shares);
    }

    /// @notice Begin unstaking `shares`. The shares stay staked (and exposed to drawdown) until the
    ///         cooldown elapses and {unstake} is called.
    function requestUnstake(uint256 shares) external {
        if (shares == 0) revert ZeroAmount();
        if (shares > sharesOf[msg.sender]) revert InsufficientShares();
        if (pendingUnstake[msg.sender].shares != 0) revert UnstakeAlreadyPending();

        uint256 releaseAt = block.timestamp + COOLDOWN;
        pendingUnstake[msg.sender] = PendingUnstake({shares: shares, releaseAt: releaseAt});
        emit UnstakeRequested(msg.sender, shares, releaseAt);
    }

    /// @notice Complete a pending unstake after the cooldown, redeeming shares for STRAND at the
    ///         current (post-drawdown) per-share value.
    function unstake() external nonReentrant returns (uint256 amount) {
        PendingUnstake memory p = pendingUnstake[msg.sender];
        if (p.shares == 0) revert NoPendingUnstake();
        if (block.timestamp < p.releaseAt) revert CooldownActive();
        if (p.shares > sharesOf[msg.sender]) revert InsufficientShares();

        _harvest(msg.sender);

        amount = FixedPointMathLib.fullMulDiv(p.shares, totalStaked, totalShares);
        sharesOf[msg.sender] -= p.shares;
        totalShares -= p.shares;
        totalStaked -= amount;
        delete pendingUnstake[msg.sender];
        _checkpoint(msg.sender);

        SafeTransferLib.safeTransfer(strand, msg.sender, amount);
        emit Unstaked(msg.sender, p.shares, amount);
    }

    // --------------------------------------------------------------------
    // Rewards
    // --------------------------------------------------------------------

    /// @notice Fund staker rewards with pool fees (token0/token1). Pulled from the caller (a fee
    ///         router / keeper / governance) and distributed pro-rata to current stakers.
    function depositRewards(uint256 amount0, uint256 amount1) external nonReentrant {
        if (totalShares == 0) revert NoStakers();
        if (amount0 > 0) {
            SafeTransferLib.safeTransferFrom(token0, msg.sender, address(this), amount0);
            accReward0 += FixedPointMathLib.fullMulDiv(amount0, ACC_PRECISION, totalShares);
        }
        if (amount1 > 0) {
            SafeTransferLib.safeTransferFrom(token1, msg.sender, address(this), amount1);
            accReward1 += FixedPointMathLib.fullMulDiv(amount1, ACC_PRECISION, totalShares);
        }
        emit RewardsDeposited(amount0, amount1);
    }

    /// @notice Claim accrued token0/token1 fee rewards.
    function claim() external nonReentrant returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = _harvest(msg.sender);
        _checkpoint(msg.sender);
    }

    /// @notice Rewards currently claimable by `user`.
    function pendingRewards(address user) external view returns (uint256 fee0, uint256 fee1) {
        uint256 s = sharesOf[user];
        fee0 = s * accReward0 / ACC_PRECISION - rewardDebt0[user];
        fee1 = s * accReward1 / ACC_PRECISION - rewardDebt1[user];
    }

    // --------------------------------------------------------------------
    // Drawdown (hook only)
    // --------------------------------------------------------------------

    /// @inheritdoc IUnderwritingVault
    function drawdown(uint256 bps) external onlyHook nonReentrant returns (uint256 seized) {
        if (bps > BPS) revert InvalidBps();
        seized = FixedPointMathLib.fullMulDiv(totalStaked, bps, BPS);
        if (seized == 0) return 0;
        // Reduce backing only: shares are unchanged, so every staker's redemption value drops
        // pro-rata. `seized <= totalStaked <= STRAND balance`, so this can never overpay.
        totalStaked -= seized;
        SafeTransferLib.safeTransfer(strand, rebalancer, seized);
        emit Drawdown(seized, totalStaked);
    }

    // --------------------------------------------------------------------
    // Internal
    // --------------------------------------------------------------------

    function _harvest(address user) private returns (uint256 fee0, uint256 fee1) {
        uint256 s = sharesOf[user];
        fee0 = s * accReward0 / ACC_PRECISION - rewardDebt0[user];
        fee1 = s * accReward1 / ACC_PRECISION - rewardDebt1[user];
        if (fee0 > 0) SafeTransferLib.safeTransfer(token0, user, fee0);
        if (fee1 > 0) SafeTransferLib.safeTransfer(token1, user, fee1);
        if (fee0 > 0 || fee1 > 0) emit RewardsClaimed(user, fee0, fee1);
    }

    function _checkpoint(address user) private {
        uint256 s = sharesOf[user];
        rewardDebt0[user] = s * accReward0 / ACC_PRECISION;
        rewardDebt1[user] = s * accReward1 / ACC_PRECISION;
    }
}
