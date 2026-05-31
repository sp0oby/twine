import {createConfig} from "ponder";
import {http} from "viem";

import {twineHookAbi, twinePositionManagerAbi, twineUnderwritingVaultAbi} from "./abis";

/**
 * Ponder configuration for the Twine indexer.
 *
 * Addresses and the target network are env-driven so the same indexer image can target testnet
 * and mainnet. For Base Sepolia (the current deployment) set `PONDER_NETWORK=baseSepolia` and
 * populate the address/start-block fields from `frontend/lib/deployments/base-sepolia.json`.
 */
const network = (process.env.PONDER_NETWORK ?? "baseSepolia") as "base" | "baseSepolia";

export default createConfig({
  networks: {
    base: {
      chainId: 8453,
      transport: http(process.env.PONDER_RPC_URL_BASE),
    },
    baseSepolia: {
      chainId: 84532,
      transport: http(process.env.PONDER_RPC_URL_BASE_SEPOLIA),
    },
  },
  contracts: {
    TwineHook: {
      network,
      abi: twineHookAbi,
      address: (process.env.PONDER_HOOK_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.PONDER_START_BLOCK ?? 0),
    },
    TwinePositionManager: {
      network,
      abi: twinePositionManagerAbi,
      address: (process.env.PONDER_PM_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.PONDER_START_BLOCK ?? 0),
    },
    TwineUnderwritingVault: {
      network,
      abi: twineUnderwritingVaultAbi,
      address: (process.env.PONDER_VAULT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.PONDER_START_BLOCK ?? 0),
    },
  },
});
