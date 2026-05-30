import {createConfig} from "ponder";
import {http} from "viem";

import {twineHookAbi, twinePositionManagerAbi, twineUnderwritingVaultAbi} from "./abis";

/**
 * Ponder configuration for the Twine indexer.
 *
 * Addresses are read from env so the same indexer image can target testnet and mainnet. Until a
 * pool is actually deployed (PROJECT_SPEC.md status), set these in `.env.local` from
 * `script/Deploy.s.sol` output and `script/CreatePool.s.sol` output.
 */
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
      network: "base",
      abi: twineHookAbi,
      address: (process.env.PONDER_HOOK_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.PONDER_START_BLOCK ?? 0),
    },
    TwinePositionManager: {
      network: "base",
      abi: twinePositionManagerAbi,
      address: (process.env.PONDER_PM_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.PONDER_START_BLOCK ?? 0),
    },
    TwineUnderwritingVault: {
      network: "base",
      abi: twineUnderwritingVaultAbi,
      address: (process.env.PONDER_VAULT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      startBlock: Number(process.env.PONDER_START_BLOCK ?? 0),
    },
  },
});
