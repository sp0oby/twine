"use client";

import {useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract} from "wagmi";

import {marketHoursAbi} from "@/lib/abis";
import {getDeployment} from "@/lib/twine";

/**
 * Admin toggle for the per-pool `MultisigMarketHours` flag.
 *
 * Renders only when the connected wallet is the contract's owner. The flag controls whether the
 * hook applies the asymmetric fee or falls back to flat — flipping it from the UI is the cheapest
 * way to demo the market-hours behavior on testnet, ahead of the Chainlink Data Streams adapter
 * shipping. On mainnet this should be flipped by the multisig/keeper, not from a dashboard.
 */
export function MarketHoursAdmin() {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const {address} = useAccount();

  const {data: owner} = useReadContract({
    address: deployment?.marketHours,
    abi: marketHoursAbi,
    functionName: "owner",
    query: {enabled: !!deployment},
  });

  const {data: open, refetch: refetchOpen} = useReadContract({
    address: deployment?.marketHours,
    abi: marketHoursAbi,
    functionName: "isMarketOpen",
    query: {enabled: !!deployment, refetchInterval: 6_000},
  });

  const {writeContract, data: tx, isPending} = useWriteContract();
  const wait = useWaitForTransactionReceipt({hash: tx});

  if (!deployment || !address) return null;
  if (!owner || (owner as string).toLowerCase() !== address.toLowerCase()) return null;

  const busy = isPending || wait.isLoading;
  const next = !open;

  function flip() {
    if (!deployment?.marketHours) return;
    writeContract(
      {
        address: deployment.marketHours,
        abi: marketHoursAbi,
        functionName: "setOpen",
        args: [next],
      },
      {onSuccess: () => refetchOpen()},
    );
  }

  return (
    <section className="mt-10 border border-dashed border-line/70 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Owner controls · MultisigMarketHours
          </div>
          <div className="mt-1.5 font-mono text-[12px] text-ink/85">
            Current flag: <span className="text-white">{open === undefined ? "—" : open ? "open" : "closed"}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={flip}
          disabled={busy || open === undefined}
          className={`shrink-0 border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
            busy || open === undefined
              ? "border-line/50 text-muted cursor-not-allowed"
              : "border-line text-white hover:bg-white/5"
          }`}
        >
          {busy ? "Submitting…" : `Set ${next ? "open" : "closed"}`}
        </button>
      </div>
      {wait.isSuccess ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/85">
          Updated. Banner refreshes within ~12s.
        </p>
      ) : null}
    </section>
  );
}
