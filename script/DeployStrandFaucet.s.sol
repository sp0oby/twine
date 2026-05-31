// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";

import {TestnetStrandFaucet} from "../src/testnet/TestnetStrandFaucet.sol";

/// @notice Deploys the testnet-only STRAND faucet and splices its address into the existing
///         `frontend/lib/deployments/<chain>.json` under `.strandFaucet`. Idempotent — running
///         it again deploys a new faucet (the old one keeps its STRAND balance until manually
///         drained).
///
/// @dev Env:
///        DEPLOYER_PRIVATE_KEY  — pays gas, no privileges retained
///        STRAND_ADDRESS        — the deployed STRAND token
///
///      After deploy, the multisig must mint STRAND to the faucet for it to dispense:
///        cast send $STRAND 'mint(address,uint256)' $FAUCET 1000000000000000000000000 \
///          --private-key $MULTISIG_KEY --rpc-url $RPC
///      (1,000,000 STRAND = ~1000 drops, since DROP_AMOUNT is 1000e18.)
contract DeployStrandFaucet is Script {
    function run() external returns (address faucet) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address strand = vm.envAddress("STRAND_ADDRESS");

        console2.log("Chain id ", block.chainid);
        console2.log("Deployer ", vm.addr(pk));
        console2.log("STRAND   ", strand);

        vm.startBroadcast(pk);
        TestnetStrandFaucet f = new TestnetStrandFaucet(strand);
        vm.stopBroadcast();
        faucet = address(f);

        console2.log("Faucet   ", faucet);

        string memory chainName = block.chainid == 84532 ? "base-sepolia" : block.chainid == 8453 ? "base" : "unknown";
        string memory path = string.concat("frontend/lib/deployments/", chainName, ".json");
        vm.writeJson(vm.toString(faucet), path, ".strandFaucet");
        console2.log("Patched JSON at", path);
        console2.log("");
        console2.log("NEXT: from the multisig, mint STRAND to the faucet:");
        console2.log("  cast send", strand, "'mint(address,uint256)'");
        console2.log("  ", faucet, "1000000000000000000000000");
    }
}
