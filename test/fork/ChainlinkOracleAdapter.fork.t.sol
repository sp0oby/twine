// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ChainlinkOracleAdapter} from "../../src/oracle/ChainlinkOracleAdapter.sol";

/// @notice Fork test: read a real Chainlink feed on Base through the adapter.
/// @dev Runs only when both env vars are set, so it stays green in CI without secrets:
///        BASE_RPC_URL          — a Base mainnet RPC endpoint
///        BASE_CBBTC_USD_FEED   — the *verified* cbBTC/USD aggregator address on Base
///      The feed address is intentionally NOT hardcoded — supply the verified address from
///      docs.chain.link / Basescan. A wrong address would make the assertions meaningless.
contract ChainlinkOracleAdapterForkTest is Test {
    // Generous heartbeat for a liveness sanity check at an arbitrary fork block.
    uint256 constant FORK_HEARTBEAT = 1 days;

    function test_fork_readsRealFeed() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        address feed = vm.envOr("BASE_CBBTC_USD_FEED", address(0));
        if (bytes(rpc).length == 0 || feed == address(0)) {
            vm.skip(true);
            return;
        }

        vm.createSelectFork(rpc);
        ChainlinkOracleAdapter adapter = new ChainlinkOracleAdapter(feed, FORK_HEARTBEAT);

        uint256 price = adapter.getPrice();
        // 1e18-normalized; cbBTC tracks BTC, so a wide sane band catches a wrong feed/decimals.
        assertGt(price, 1_000e18);
        assertLt(price, 10_000_000e18);
    }
}
