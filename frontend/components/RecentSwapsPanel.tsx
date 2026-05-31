"use client";

import {useChainId} from "wagmi";

import {useHookSwaps} from "@/hooks/useHookSwaps";
import {explorerTx} from "@/lib/wagmi";

/**
 * Recent swaps for the active pool, classified corrective / adversarial / neutral.
 *
 * Classification is derived from the change in |drift| between consecutive emitted
 * SwapProcessed events — the hook itself emits POST-swap drift only, so the first row
 * in the window is intentionally unlabelled.
 */
export function RecentSwapsPanel() {
  const chainId = useChainId();
  const {newest, loading, error, deployment} = useHookSwaps({lookbackBlocks: 150_000n});

  return (
    <section className="mt-20">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
        Recent swaps
      </h2>
      <p className="mt-3 text-[13px] text-muted leading-relaxed">
        Each row is a <code className="font-mono">SwapProcessed</code> event from the hook. The
        label is derived from whether the swap reduced (<span className="text-emerald-300">corrective</span>)
        or increased (<span className="text-amber-200">adversarial</span>) the absolute drift
        relative to the previous swap. "Asym" = the asymmetric fee was active.
      </p>

      {!deployment ? (
        <p className="mt-4 font-mono text-[12px] text-muted">No deployment for this chain.</p>
      ) : error ? (
        <p className="mt-4 font-mono text-[12px] text-amber-200/85">RPC error: {error.message}</p>
      ) : !newest ? (
        <p className="mt-4 font-mono text-[12px] text-muted">{loading ? "Loading swap history…" : "—"}</p>
      ) : newest.length === 0 ? (
        <p className="mt-4 font-mono text-[12px] text-muted">
          No swaps in the last 150k blocks. Be the first to swap from the Trade tab.
        </p>
      ) : (
        <div className="mt-5 border border-line divide-y divide-line">
          <div className="grid grid-cols-[100px_1fr_1fr_72px] gap-3 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted bg-white/[0.02]">
            <span>When</span>
            <span>Drift (bps)</span>
            <span>Classification</span>
            <span className="text-right">Tx</span>
          </div>
          {newest.slice(0, 12).map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[100px_1fr_1fr_72px] gap-3 px-4 py-2.5 font-mono text-[12px] text-ink/85"
            >
              <span className="text-muted">{relative(row.timestamp)}</span>
              <span>
                {signedBps(row.driftBps)}
                {row.structuralBreakTriggered ? (
                  <span className="ml-2 inline-flex items-center gap-1.5 rounded-sm border border-amber-300/40 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-amber-200/90">
                    break
                  </span>
                ) : null}
              </span>
              <span>
                <Tag classification={row.classification} asym={row.asymmetricActive} />
              </span>
              <span className="text-right">
                <a
                  href={explorerTx(chainId, row.txHash) ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted hover:text-white transition-colors"
                  title={row.txHash}
                >
                  {row.txHash.slice(0, 6)}…↗
                </a>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Tag({
  classification,
  asym,
}: {
  classification: "corrective" | "adversarial" | "neutral" | undefined;
  asym: boolean;
}) {
  const base = "inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]";
  const dot = (color: string) => <span className={`size-1.5 rounded-full ${color}`} />;
  return (
    <span className={base}>
      {classification === "corrective" ? (
        <>
          {dot("bg-emerald-300/85")}
          <span className="text-emerald-300/90">corrective</span>
        </>
      ) : classification === "adversarial" ? (
        <>
          {dot("bg-amber-200/90")}
          <span className="text-amber-200/95">adversarial</span>
        </>
      ) : classification === "neutral" ? (
        <>
          {dot("bg-ink/40")}
          <span className="text-muted">neutral</span>
        </>
      ) : (
        <span className="text-muted">—</span>
      )}
      <span className={`ml-2 rounded-sm border px-1.5 py-0.5 ${
        asym ? "border-line text-muted" : "border-line/60 text-muted/70"
      }`}>
        {asym ? "asym" : "flat"}
      </span>
    </span>
  );
}

function signedBps(bps: bigint): string {
  const sign = bps > 0n ? "+" : "";
  return `${sign}${bps.toString()}`;
}

function relative(ts: bigint | undefined): string {
  if (ts === undefined) return "—";
  const now = Math.floor(Date.now() / 1000);
  const delta = now - Number(ts);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}
