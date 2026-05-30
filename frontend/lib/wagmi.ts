import {http} from "wagmi";
import {base, baseSepolia} from "wagmi/chains";
import {getDefaultConfig} from "@rainbow-me/rainbowkit";

/**
 * WalletConnect project id (from cloud.walletconnect.com). Optional — RainbowKit still works
 * with injected/browser wallets if this isn't set, just without WC modal support.
 */
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "twine-dev";

export const config = getDefaultConfig({
  appName: "Twine",
  projectId,
  // baseSepolia first so wagmi defaults useChainId() to the testnet where Twine is actually deployed.
  // Base mainnet stays in the list so users can switch once a mainnet deployment exists.
  chains: [baseSepolia, base],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

export const chainNameById: Record<number, string> = {
  [base.id]: "Base",
  [baseSepolia.id]: "Base Sepolia",
};

const explorerById: Record<number, string> = {
  [base.id]: "https://basescan.org",
  [baseSepolia.id]: "https://sepolia.basescan.org",
};

export function explorerTx(chainId: number | undefined, hash: `0x${string}`): string | undefined {
  const base = chainId !== undefined ? explorerById[chainId] : undefined;
  return base ? `${base}/tx/${hash}` : undefined;
}

export function explorerAddress(chainId: number | undefined, addr: `0x${string}`): string | undefined {
  const base = chainId !== undefined ? explorerById[chainId] : undefined;
  return base ? `${base}/address/${addr}` : undefined;
}
