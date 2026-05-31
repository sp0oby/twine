"use client";

import {useMemo} from "react";

import {useHookSwaps} from "@/hooks/useHookSwaps";

/**
 * Rolling z-score of drift, computed in the browser from the same SwapProcessed log set the
 * recent-swaps panel uses. No indexer required - the spec calls this a v1 frontend feature and
 * a back-of-envelope rolling window is plenty for the dashboard's "is this pool mean-reverting?"
 * question. When the Ponder indexer is up, this can be swapped for a GraphQL backend without
 * touching the chart.
 */
const WINDOW = 30;

export function ZScoreChart() {
  const {rows, loading, error, deployment} = useHookSwaps();

  const series = useMemo(() => computeRollingZ(rows, WINDOW), [rows]);

  return (
    <section className="mt-20">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
          Drift z-score · {WINDOW}-swap rolling
        </h2>
        {series ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {series.points.length} pts · last z={series.points.at(-1)?.z.toFixed(2) ?? "-"}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[13px] text-muted leading-relaxed">
        Drift normalized by its own {WINDOW}-swap standard deviation. Values near zero mean the
        pool is sitting at its rolling normal; large absolute values mean the spread has stretched
        relative to recent history. Mean-reverting pools spend most of their time near zero with
        occasional excursions that quickly snap back.
      </p>

      {!deployment ? (
        <p className="mt-4 font-mono text-[12px] text-muted">No deployment for this chain.</p>
      ) : error ? (
        <div className="mt-4 border border-amber-200/30 bg-amber-200/[0.04] px-4 py-3 font-mono text-[12px] text-amber-100/95">
          <div className="uppercase tracking-[0.18em] text-[10px] text-amber-200/85">RPC error</div>
          <p className="mt-1.5 normal-case break-words">
            {error.message.slice(0, 240)}
            {error.message.length > 240 ? "…" : ""}
          </p>
        </div>
      ) : !rows ? (
        <p className="mt-4 font-mono text-[12px] text-muted">{loading ? "Loading swap history…" : "-"}</p>
      ) : series.points.length < 2 ? (
        <p className="mt-4 font-mono text-[12px] text-muted">
          Need at least {WINDOW + 1} swaps for a stable rolling z-score. Currently have{" "}
          {rows.length}.
        </p>
      ) : (
        <ZChart series={series} />
      )}
    </section>
  );
}

function ZChart({series}: {series: NonNullable<ReturnType<typeof computeRollingZ>>}) {
  const W = 600;
  const H = 180;
  const PAD_X = 8;
  const PAD_Y = 16;

  // Symmetric domain around zero so the centre is visually meaningful.
  const absMax = Math.max(2, ...series.points.map((p) => Math.abs(p.z)));
  const xStep = series.points.length > 1 ? (W - 2 * PAD_X) / (series.points.length - 1) : 0;
  const yFor = (z: number) => PAD_Y + ((1 - (z + absMax) / (2 * absMax)) * (H - 2 * PAD_Y));

  const path = series.points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${PAD_X + i * xStep} ${yFor(p.z)}`)
    .join(" ");

  const zeroY = yFor(0);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Rolling drift z-score, ${series.points.length} points`}
      className="mt-5 w-full border border-line"
    >
      {/* Zero baseline */}
      <line x1={PAD_X} x2={W - PAD_X} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 4" />
      {/* ±1σ guides */}
      <line x1={PAD_X} x2={W - PAD_X} y1={yFor(1)} y2={yFor(1)} stroke="rgba(110,231,183,0.15)" />
      <line x1={PAD_X} x2={W - PAD_X} y1={yFor(-1)} y2={yFor(-1)} stroke="rgba(110,231,183,0.15)" />
      {/* ±2σ guides */}
      <line x1={PAD_X} x2={W - PAD_X} y1={yFor(2)} y2={yFor(2)} stroke="rgba(252,211,77,0.18)" />
      <line x1={PAD_X} x2={W - PAD_X} y1={yFor(-2)} y2={yFor(-2)} stroke="rgba(252,211,77,0.18)" />

      <path d={path} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2" />

      {/* Endpoint dot for emphasis */}
      {(() => {
        const last = series.points.at(-1);
        if (!last) return null;
        const x = PAD_X + (series.points.length - 1) * xStep;
        const y = yFor(last.z);
        return <circle cx={x} cy={y} r={3} fill="white" />;
      })()}

      {/* y-axis labels */}
      <text x={PAD_X + 4} y={PAD_Y + 10} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="ui-monospace,monospace">
        +{absMax.toFixed(1)}σ
      </text>
      <text x={PAD_X + 4} y={H - PAD_Y - 2} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="ui-monospace,monospace">
        −{absMax.toFixed(1)}σ
      </text>
      <text x={W - PAD_X - 24} y={zeroY - 3} fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="ui-monospace,monospace">
        0
      </text>
    </svg>
  );
}

type ZPoint = {z: number; driftBps: number};
type ZSeries = {points: ZPoint[]};

function computeRollingZ(rows: ReturnType<typeof useHookSwaps>["rows"], windowSize: number): ZSeries {
  if (!rows || rows.length === 0) return {points: []};

  const drifts = rows.map((r) => Number(r.driftBps));
  const out: ZPoint[] = [];
  for (let i = 0; i < drifts.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const w = drifts.slice(start, i + 1);
    if (w.length < 2) continue;
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    const variance = w.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (w.length - 1);
    const std = Math.sqrt(variance);
    const z = std === 0 ? 0 : (drifts[i] - mean) / std;
    out.push({z, driftBps: drifts[i]});
  }
  return {points: out};
}
