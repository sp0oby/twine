// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {STRANDMainnet} from "../../src/STRANDMainnet.sol";

/// @notice Production-shape STRAND coverage: cap + mint authority + burn (same as testnet
///         STRAND), plus the two production additions — ERC-2612 permit and ERC20Votes voting
///         power. Tests target the behaviors a Governor and a permit-using frontend depend on.
contract STRANDMainnetTest is Test {
    STRANDMainnet token;
    address constant OWNER = address(0xABCD);
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);

    // Pre-generated key for permit tests so we have a known signer.
    uint256 constant ALICE_PK = 0xA11CE;
    address aliceFromKey;

    function setUp() public {
        token = new STRANDMainnet(OWNER);
        aliceFromKey = vm.addr(ALICE_PK);
        vm.prank(OWNER);
        token.mint(aliceFromKey, 1_000e18);
    }

    // -------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------

    function test_metadata() public view {
        assertEq(token.name(), "Strand");
        assertEq(token.symbol(), "STRAND");
        assertEq(token.decimals(), 18);
        assertEq(token.MAX_SUPPLY(), 100_000_000e18);
        assertEq(token.owner(), OWNER);
    }

    // -------------------------------------------------------------------
    // Cap + mint + burn
    // -------------------------------------------------------------------

    function test_mint_byOwnerUnderCap() public {
        vm.prank(OWNER);
        token.mint(ALICE, 1e18);
        assertEq(token.balanceOf(ALICE), 1e18);
    }

    function testRevert_mint_notOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this)));
        token.mint(ALICE, 1e18);
    }

    function testRevert_mint_exceedsCap() public {
        // Precompute the cap BEFORE the expectRevert window — otherwise the external view call
        // becomes the "next call" and consumes the revert expectation.
        uint256 cap = token.MAX_SUPPLY();
        vm.prank(OWNER);
        vm.expectRevert(STRANDMainnet.CapExceeded.selector);
        token.mint(ALICE, cap); // already minted 1000 in setUp, so 1000 + 100M > 100M
    }

    function test_renounceOwnership_locksMintingForever() public {
        vm.prank(OWNER);
        token.renounceOwnership();
        assertEq(token.owner(), address(0));
        // No one — including the former owner — can mint anymore.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, OWNER));
        vm.prank(OWNER);
        token.mint(ALICE, 1);
    }

    function test_burn_anyoneCanBurnTheirOwn() public {
        vm.prank(aliceFromKey);
        token.burn(100e18);
        assertEq(token.balanceOf(aliceFromKey), 900e18);
        assertEq(token.totalSupply(), 900e18);
    }

    // -------------------------------------------------------------------
    // ERC-2612 Permit
    // -------------------------------------------------------------------

    function test_permit_grantsAllowance() public {
        uint256 value = 250e18;
        uint256 deadline = block.timestamp + 1 hours;
        uint256 nonce = token.nonces(aliceFromKey);

        bytes32 PERMIT_TYPEHASH =
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, aliceFromKey, BOB, value, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ALICE_PK, digest);

        // BOB submits the permit (gasless on Alice's side).
        token.permit(aliceFromKey, BOB, value, deadline, v, r, s);
        assertEq(token.allowance(aliceFromKey, BOB), value);
        assertEq(token.nonces(aliceFromKey), nonce + 1);
    }

    // -------------------------------------------------------------------
    // ERC20Votes — what the v2 Governor actually reads
    // -------------------------------------------------------------------

    function test_votes_zeroUntilDelegated() public view {
        // ERC20Votes: balances do not equal voting power until the holder delegates (to themselves
        // or someone else). This is the entire mental model the Governor reads.
        assertEq(token.getVotes(aliceFromKey), 0);
    }

    function test_votes_selfDelegateGivesFullBalance() public {
        vm.prank(aliceFromKey);
        token.delegate(aliceFromKey);
        assertEq(token.getVotes(aliceFromKey), 1_000e18);
    }

    function test_votes_delegateToAnother() public {
        vm.prank(aliceFromKey);
        token.delegate(BOB);
        assertEq(token.getVotes(BOB), 1_000e18);
        assertEq(token.getVotes(aliceFromKey), 0);
    }

    function test_votes_transferMovesVotingPower() public {
        vm.prank(aliceFromKey);
        token.delegate(aliceFromKey);
        vm.prank(aliceFromKey);
        token.transfer(BOB, 400e18);
        // BOB needs to delegate to receive votes from his balance.
        vm.prank(BOB);
        token.delegate(BOB);
        assertEq(token.getVotes(aliceFromKey), 600e18);
        assertEq(token.getVotes(BOB), 400e18);
    }

    function test_votes_historicalSnapshotAtPastBlock() public {
        vm.prank(aliceFromKey);
        token.delegate(aliceFromKey);
        uint256 snapBlock = block.number;
        vm.roll(block.number + 1); // ERC20Votes requires the query block to be < current

        vm.prank(aliceFromKey);
        token.transfer(BOB, 600e18);

        // Past-block lookup still sees Alice with the full 1000 STRAND at snapBlock.
        assertEq(token.getPastVotes(aliceFromKey, snapBlock), 1_000e18);
        // Current votes reflect the transfer.
        assertEq(token.getVotes(aliceFromKey), 400e18);
    }

    function test_votes_clockModeIsBlockNumber() public view {
        // Default ERC20Votes clock — Governor + Tally expect this string verbatim.
        assertEq(token.CLOCK_MODE(), "mode=blocknumber&from=default");
    }
}
