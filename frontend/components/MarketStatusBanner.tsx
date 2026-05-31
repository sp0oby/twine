"use client";

import {useChainId} from "wagmi";
import {baseSepolia} from "wagmi/chains";

import {usePoolReads} from "@/hooks/usePool";

const STALE_AFTER_SECONDS = 48 * 60 * 60; // 48h — generous for a manually-flipped flag

/**
 * Surfaces the equity-hours state at the top of /app.
 *
 * When the IMarketHoursOracle reports the underlying market is closed, the hook drops the
 * asymmetric-fee mechanic and reverts to flat fees across both directions (PROJECT_SPEC.md §6.2).
 * On testnets the oracle is `MultisigMarketHours` — a flag a Safe flips — so we surface its
 * `lastUpdate` so a stale flag is visible at a glance.
 */
export function MarketStatusBanner() {
  const {marketOpen, marketHoursLastUpdate, deployment} = usePoolReads();
  const chainId = useChainId();
  const isTestnet = chainId === baseSepolia.id;

  if (!deployment) return null;
  if (marketOpen === undefined) return null;

  const now = Math.floor(Date.now() / 1000);
  const lastUpdateSec = marketHoursLastUpdate ? Number(marketHoursLastUpdate) : 0;
  const stale = lastUpdateSec > 0 && now - lastUpdateSec > STALE_AFTER_SECONDS;
  const lastUpdateLabel = lastUpdateSec ? relative(lastUpdateSec, now) : "—";

  if (marketOpen) {
    return (
      <div className="mt-6 border border-line/70 px-4 py-2.5">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300/85">
          <span className="inline-block size-1.5 rounded-full bg-emerald-300/85" />
          NYSE open · asymmetric fee active
        </div>
        {isTestnet ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Testnet — flag set by multisig {stale ? `· last updated ${lastUpdateLabel}` : `· updated ${lastUpdateLabel}`}
            {stale ? " (likely stale)" : ""}
          </p>
        ) : null}
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
      {isTestnet ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-50/60">
          Testnet — flag set by multisig · updated {lastUpdateLabel}
        </p>
      ) : null}
    </div>
  );
}

function relative(ts: number, now: number): string {
  const delta = now - ts;
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}
