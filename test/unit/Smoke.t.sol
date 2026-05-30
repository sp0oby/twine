// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";

/// @dev Phase 0 smoke test — confirms the toolchain, remappings, and forge-std wiring compile and run.
contract SmokeTest is Test {
    function test_toolchainIsWired() public pure {
        assertEq(uint256(1) + 1, 2);
    }
}
