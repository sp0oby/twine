"use client";

import {useChainId} from "wagmi";

import {usePoolReads} from "@/hooks/usePool";
import {explorerAddress} from "@/lib/wagmi";

/**
 * Surfaces the equity-hours state at the top of /app.
 *
 * When the IMarketHoursOracle reports the underlying market is closed, the hook drops the
 * asymmetric-fee mechanic and reverts to flat fees across both directions (PROJECT_SPEC.md §6.2).
 * The deployed oracle is `NyseHoursOracle`, which computes open/closed directly on-chain from
 * the NYSE calendar — no off-chain feed, no keeper.
 */
export function MarketStatusBanner() {
  const {marketOpen, deployment} = usePoolReads();
  const chainId = useChainId();

  if (!deployment) return null;
  if (marketOpen === undefined) return null;

  const oracleLink = explorerAddress(chainId, deployment.marketHours);

  if (marketOpen) {
    return (
      <div className="mt-6 border border-line/70 px-4 py-2.5">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300/85">
          <span className="inline-block size-1.5 rounded-full bg-emerald-300/85" />
          NYSE open · asymmetric fee active
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Computed on-chain ·{" "}
          {oracleLink ? (
            <a href={oracleLink} target="_blank" rel="noreferrer" className="hover:text-ink transition-colors">
              NyseHoursOracle ↗
            </a>
          ) : (
            "NyseHoursOracle"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 border border-amber-200/30 bg-amber-200/[0.04] px-4 py-3">
      <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100/95">
        <span className="inline-block size-1.5 rounded-full bg-amber-200/90" />
        NYSE closed · flat fees · no convergence promise
      </div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-amber-50/80">
        MSTRX tracks a US-listed equity. While the underlying market is closed the hook drops the
        asymmetric mechanic — swaps still settle, but the pool does not promise to mean-revert
        until markets reopen. LPs bear gap risk over the close.
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-50/60">
        Computed on-chain ·{" "}
        {oracleLink ? (
          <a href={oracleLink} target="_blank" rel="noreferrer" className="hover:text-amber-50/90 transition-colors">
            NyseHoursOracle ↗
          </a>
        ) : (
          "NyseHoursOracle"
        )}
      </p>
    </div>
  );
}
