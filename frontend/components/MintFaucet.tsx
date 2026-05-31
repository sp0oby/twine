"use client";

import {parseUnits} from "viem";
import {useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract} from "wagmi";

import {mockErc20Abi, strandFaucetAbi} from "@/lib/abis";
import {fmtAmount} from "@/lib/format";
import {getDeployment} from "@/lib/twine";

import {useUserReads} from "@/hooks/usePool";
import {TxStatusInline} from "./panels/atoms";

/**
 * Testnet faucet UI. Token0 / token1 are MockERC20 with an open `mint` selector. STRAND has a
 * gated `mint` (owner = multisig), so we route its drop through `TestnetStrandFaucet.claim()`
 * — a pre-funded faucet with a per-address cooldown.
 */
export function MintFaucet() {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const {address} = useAccount();
  const user = useUserReads(address);

  if (!deployment) return null;

  return (
    <section className="mt-24">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Test tokens</h2>
      <p className="mt-3 font-mono text-[13px] text-muted">
        Mock token0 / token1 mint freely. STRAND drops 1,000 per claim from a pre-funded faucet
        with a 12h cooldown — production STRAND has a fixed cap and gated mint (see /docs).
      </p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        <MintMock label="token0" token={deployment.token0} balance={user.bal0} address={address} />
        <MintMock label="token1" token={deployment.token1} balance={user.bal1} address={address} />
        <StrandClaim
          faucet={deployment.strandFaucet}
          balance={user.strandBal}
          address={address}
        />
      </div>
    </section>
  );
}

function MintMock({
  label,
  token,
  balance,
  address,
}: {
  label: string;
  token: `0x${string}`;
  balance: bigint | undefined;
  address: `0x${string}` | undefined;
}) {
  const {writeContract, data: tx, isPending} = useWriteContract();
  const wait = useWaitForTransactionReceipt({hash: tx});
  const disabled = !address || isPending || wait.isLoading;

  return (
    <div className="border border-line px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{label}</div>
      <div className="mt-1 font-mono text-[14px] text-white">{fmtAmount(balance)}</div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!address) return;
          writeContract({
            address: token,
            abi: mockErc20Abi,
            functionName: "mint",
            args: [address, parseUnits("1000", 18)],
          });
        }}
        className={`mt-3 block w-full py-2 border border-line font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          disabled ? "text-muted cursor-not-allowed" : "text-white hover:bg-white/5"
        }`}
      >
        {!address ? "Connect" : isPending || wait.isLoading ? "Minting…" : "+1000"}
      </button>
      <TxStatusInline hash={tx} />
    </div>
  );
}

function StrandClaim({
  faucet,
  balance,
  address,
}: {
  faucet: `0x${string}` | undefined;
  balance: bigint | undefined;
  address: `0x${string}` | undefined;
}) {
  const {writeContract, data: tx, isPending} = useWriteContract();
  const wait = useWaitForTransactionReceipt({hash: tx});

  // Per-address cooldown — show "Ready in 4h 12m" when waiting.
  const {data: nextAt, refetch} = useReadContract({
    address: faucet,
    abi: strandFaucetAbi,
    functionName: "nextClaimAt",
    args: address ? [address] : undefined,
    query: {enabled: !!faucet && !!address, refetchInterval: 30_000},
  });

  if (!faucet) {
    return (
      <div className="border border-line px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">STRAND</div>
        <div className="mt-1 font-mono text-[14px] text-white">{fmtAmount(balance)}</div>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted/70">
          Faucet not deployed
        </div>
      </div>
    );
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const ready = !nextAt || nextAt <= now;
  const txBusy = isPending || wait.isLoading;
  const disabled = !address || txBusy || !ready;

  return (
    <div className="border border-line px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">STRAND</div>
      <div className="mt-1 font-mono text-[14px] text-white">{fmtAmount(balance)}</div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!address) return;
          writeContract(
            {address: faucet, abi: strandFaucetAbi, functionName: "claim"},
            {onSuccess: () => refetch()},
          );
        }}
        className={`mt-3 block w-full py-2 border border-line font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          disabled ? "text-muted cursor-not-allowed" : "text-white hover:bg-white/5"
        }`}
      >
        {!address
          ? "Connect"
          : txBusy
            ? "Claiming…"
            : ready
              ? "+1000"
              : `Ready in ${fmtCountdown(nextAt as bigint, now)}`}
      </button>
      <TxStatusInline hash={tx} />
    </div>
  );
}

function fmtCountdown(readyAt: bigint, now: bigint): string {
  const delta = Number(readyAt - now);
  if (delta <= 0) return "now";
  const h = Math.floor(delta / 3600);
  const m = Math.floor((delta % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${delta}s`;
}
