// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

import {TwineSwapRouter} from "../src/TwineSwapRouter.sol";

/// @notice Standalone deploy script for {TwineSwapRouter}. Idempotent: writes the resulting
///         address into the existing `frontend/lib/deployments/<chain>.json` under `.swapRouter`
///         so the dashboard's swap panel can pick it up without redeploying the rest of the system.
contract DeployRouter is Script {
    function run() external returns (address router) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        IPoolManager poolManager = IPoolManager(vm.envAddress("POOL_MANAGER"));

        console2.log("Chain id   ", block.chainid);
        console2.log("Deployer   ", vm.addr(pk));
        console2.log("PoolManager", address(poolManager));

        vm.startBroadcast(pk);
        TwineSwapRouter r = new TwineSwapRouter(poolManager);
        vm.stopBroadcast();
        router = address(r);

        console2.log("swapRouter ", router);

        // Splice the new address into the existing deployment JSON without touching anything else.
        string memory chainName = block.chainid == 84532 ? "base-sepolia" : block.chainid == 8453 ? "base" : "unknown";
        string memory path = string.concat("frontend/lib/deployments/", chainName, ".json");
        vm.writeJson(vm.toString(router), path, ".swapRouter");
        console2.log("Patched JSON at", path);
    }
}
