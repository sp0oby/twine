import baseSepolia from "./deployments/base-sepolia.json";

/** Shape of the JSON `script/DeployTestnet.s.sol` writes after a successful deploy. */
export type TwineDeployment = {
  chainId: number;
  poolManager: `0x${string}`;
  hook: `0x${string}`;
  positionManager: `0x${string}`;
  governor: `0x${string}`;
  strand: `0x${string}`;
  vault: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  oracle0: `0x${string}`;
  oracle1: `0x${string}`;
  marketHours: `0x${string}`;
  // Optional: populated by `script/DeployRouter.s.sol` after the main protocol deploy.
  swapRouter?: `0x${string}`;
  // Optional: testnet-only STRAND faucet (TestnetStrandFaucet). Populated by
  // `script/DeployStrandFaucet.s.sol`. Frontend's MintFaucet uses this for STRAND drops
  // because STRAND.mint is `onlyOwner` (owner = multisig) post-launch.
  strandFaucet?: `0x${string}`;
  poolId: `0x${string}`;
  tickSpacing: number;
  baseFeeBps: number;
  toleranceBps: number;
  hardThresholdBps: number;
  drawdownBps: number;
  vaultFeeBps: number;
  buybackBps: number;
};

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const deployments: Record<number, TwineDeployment> = {
  [baseSepolia.chainId]: baseSepolia as TwineDeployment,
};

/** Returns the deployment for `chainId`, or `null` when no contracts are deployed yet there. */
export function getDeployment(chainId: number | undefined): TwineDeployment | null {
  if (!chainId) return null;
  const d = deployments[chainId];
  // Treat an all-zero hook as "not yet deployed" — the frontend should render the pre-launch UI.
  if (!d || d.hook === ZERO) return null;
  return d;
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr ?? "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
