"use client";

import {DriftBand} from "@/components/DriftBand";
import {usePoolReads} from "@/hooks/usePool";
import {useRoutedFees} from "@/hooks/useRoutedFees";
import {fmtAmount} from "@/lib/format";

export function PoolCard() {
  const {drift, totalShares, vaultStaked, fairPriceWad, config, deployment} = usePoolReads();
  const {fee0, fee1} = useRoutedFees();
  const broken = config?.structuralBreak === true;

  return (
    <div className="mt-10 border border-line">
      {broken ? (
        <div className="px-6 py-2 border-b border-line bg-white/[0.03] font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/90">
          Structural break — fees are flat
        </div>
      ) : null}
      <dl className="grid grid-cols-3 divide-x divide-line text-[13px]">
        <StatCell label="Fair price" value={fmtAmount(fairPriceWad)} />
        <StatCell label="Drift (bps)" value={drift !== undefined ? signedBps(drift) : "—"} />
        <StatCell label="LP shares" value={fmtAmount(totalShares)} />
      </dl>
      <DriftBand
        driftBps={drift}
        toleranceBps={config?.toleranceBps ?? deployment?.toleranceBps}
        hardThresholdBps={config?.hardThresholdBps ?? deployment?.hardThresholdBps}
        broken={broken}
      />
      <dl className="grid grid-cols-3 divide-x divide-line text-[13px] border-t border-line">
        <StatCell label="Vault stake" value={fmtAmount(vaultStaked)} />
        <StatCell label="State" value={config ? (config.structuralBreak ? "broken" : "ok") : "—"} />
        <StatCell
          label="Recent fees"
          value={
            fee0 === undefined || fee1 === undefined
              ? "—"
              : `${fmtAmount(fee0, 18, 2)} / ${fmtAmount(fee1, 18, 2)}`
          }
          hint="routed, last ~14h"
        />
      </dl>
    </div>
  );
}

function StatCell({label, value, hint}: {label: string; value: string; hint?: string}) {
  return (
    <div className="px-6 py-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{label}</dt>
      <dd className="mt-2 font-mono text-base text-ink">{value}</dd>
      {hint ? <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted/80">{hint}</div> : null}
    </div>
  );
}

function signedBps(bps: bigint): string {
  const sign = bps > 0n ? "+" : "";
  return `${sign}${bps.toString()}`;
}
