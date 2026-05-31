// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @title TestnetStrandFaucet
/// @notice Dispenses a fixed amount of pre-funded STRAND per caller, on a cooldown. Purely a
///         testnet/demo convenience — mainnet distribution follows {PROJECT_SPEC.md §7.2}
///         (vested allocations, public sale, airdrop) and this contract is never deployed there.
/// @dev STRAND.mint is `onlyOwner` post-handoff, so the dashboard can't mint directly. The
///      multisig pre-funds this faucet once with the desired test pool (e.g. 1,000,000 STRAND),
///      then anyone calling {claim} pulls a drop. When the faucet drains, the multisig refills it
///      by minting more STRAND straight to this address.
contract TestnetStrandFaucet {
    /// @notice STRAND token this faucet dispenses.
    IERC20 public immutable strand;
    /// @notice Amount sent to each caller per claim.
    uint256 public constant DROP_AMOUNT = 1_000e18;
    /// @notice Minimum interval between claims for the same address.
    uint256 public constant COOLDOWN = 12 hours;

    /// @notice Timestamp of the last successful claim per address.
    mapping(address user => uint256 timestamp) public lastClaim;

    event Claimed(address indexed user, uint256 amount);

    error CooldownActive(uint256 readyAt);
    error InsufficientFaucetBalance();
    error ZeroAddress();

    constructor(address _strand) {
        if (_strand == address(0)) revert ZeroAddress();
        strand = IERC20(_strand);
    }

    /// @notice Claim {DROP_AMOUNT} STRAND to msg.sender. Reverts if the cooldown is still active
    ///         or the faucet has run dry.
    function claim() external {
        uint256 readyAt = lastClaim[msg.sender] + COOLDOWN;
        if (lastClaim[msg.sender] != 0 && block.timestamp < readyAt) {
            revert CooldownActive(readyAt);
        }
        if (strand.balanceOf(address(this)) < DROP_AMOUNT) revert InsufficientFaucetBalance();

        lastClaim[msg.sender] = block.timestamp;
        SafeTransferLib.safeTransfer(address(strand), msg.sender, DROP_AMOUNT);
        emit Claimed(msg.sender, DROP_AMOUNT);
    }

    /// @notice Timestamp at which `user` can next claim. Returns 0 for a never-claimed address.
    function nextClaimAt(address user) external view returns (uint256) {
        uint256 last = lastClaim[user];
        return last == 0 ? 0 : last + COOLDOWN;
    }

    /// @notice Remaining STRAND held by the faucet — how many more drops it can dispense.
    function remaining() external view returns (uint256) {
        return strand.balanceOf(address(this));
    }
}
