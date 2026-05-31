"use client";

import {usePoolReads} from "@/hooks/usePool";

/**
 * Surfaces the equity-hours state at the top of /app.
 *
 * When the IMarketHoursOracle reports the underlying market is closed, the hook drops the
 * asymmetric-fee mechanic and reverts to flat fees across both directions (PROJECT_SPEC.md §6.2).
 * That's the moment partners look for — render it prominently and honestly.
 */
export function MarketStatusBanner() {
  const {marketOpen, deployment} = usePoolReads();

  if (!deployment) return null;
  if (marketOpen === undefined) return null;
  if (marketOpen) {
    return (
      <div className="mt-6 flex items-center gap-3 border border-line/70 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300/85">
        <span className="inline-block size-1.5 rounded-full bg-emerald-300/85" />
        NYSE open · asymmetric fee active
      </div>
    );
  }

  return (
    <div className="mt-6 border border-amber-200/30 bg-amber-200/[0.04] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-100/95">
      <div className="flex items-center gap-3">
        <span className="inline-block size-1.5 rounded-full bg-amber-200/90" />
        NYSE closed · flat fees · no convergence promise
      </div>
      <p className="mt-2.5 normal-case tracking-normal text-[12px] leading-relaxed text-amber-50/80">
        MSTRX tracks a US-listed equity. While the underlying market is closed the hook drops the
        asymmetric mechanic — swaps still settle, but the pool does not promise to mean-revert
        until markets reopen. LPs bear gap risk over the close.
      </p>
    </div>
  );
}
