// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {STRAND} from "../../src/STRAND.sol";

contract STRANDTest is Test {
    STRAND strand;
    address owner = address(this);
    address alice = makeAddr("alice");

    function setUp() public {
        strand = new STRAND(owner);
    }

    function test_mint_byOwner() public {
        strand.mint(alice, 1e18);
        assertEq(strand.balanceOf(alice), 1e18);
        assertEq(strand.totalSupply(), 1e18);
    }

    function testRevert_mint_notOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        strand.mint(alice, 1e18);
    }

    function test_mint_upToCap() public {
        strand.mint(alice, strand.MAX_SUPPLY());
        assertEq(strand.totalSupply(), strand.MAX_SUPPLY());
    }

    function testRevert_mint_exceedsCap() public {
        strand.mint(alice, strand.MAX_SUPPLY());
        vm.expectRevert(STRAND.CapExceeded.selector);
        strand.mint(alice, 1);
    }

    function test_burn_reducesSupply() public {
        strand.mint(alice, 10e18);
        vm.prank(alice);
        strand.burn(4e18);
        assertEq(strand.balanceOf(alice), 6e18);
        assertEq(strand.totalSupply(), 6e18);
    }

    function test_burn_allowsReMintUnderCap() public {
        strand.mint(alice, strand.MAX_SUPPLY());
        vm.prank(alice);
        strand.burn(1e18);
        strand.mint(alice, 1e18); // back to cap, allowed
        assertEq(strand.totalSupply(), strand.MAX_SUPPLY());
    }
}
