import {createConfig} from "ponder";

import {twineHookAbi, twinePositionManagerAbi, twineUnderwritingVaultAbi} from "./abis";

/**
 * Ponder configuration for the Twine indexer.
 *
 * Addresses and the target chain are env-driven so the same indexer image can target testnet
 * and mainnet. For Base Sepolia (the current deployment) set `PONDER_NETWORK=baseSepolia` and
 * populate the address/start-block fields from `frontend/lib/deployments/base-sepolia.json`.
 */
const chain = (process.env.PONDER_NETWORK ?? "baseSepolia") as "base" | "baseSepolia";

// Realtime poll cadence (ms). Higher = fewer RPC calls once the historical backfill has caught up.
const pollingInterval = Number(process.env.PONDER_POLLING_INTERVAL_MS ?? 2_000);

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_BASE,
      pollingInterval,
    },
    baseSepolia: {
      id: 84532,
      rpc: process.env.PONDER_RPC_URL_BASE_SEPOLIA,
      pollingInterval,
    },
  },
  contracts: {
    TwineHook: {
      chain,
      abi: twineHookAbi,
      address: (process.env.PONDER_HOOK_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.PONDER_START_BLOCK ?? 0),
    },
    TwinePositionManager: {
      chain,
      abi: twinePositionManagerAbi,
      address: (process.env.PONDER_PM_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.PONDER_START_BLOCK ?? 0),
    },
    TwineUnderwritingVault: {
      chain,
      abi: twineUnderwritingVaultAbi,
      address: (process.env.PONDER_VAULT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.PONDER_START_BLOCK ?? 0),
    },
  },
});
