"use client";

/**
 * Drift band: a one-dimensional SVG visualizing where the pool sits between fair price (centre),
 * the tolerance band (in-band, flat fee), and the hard structural-break threshold (outside).
 *
 * Inputs are signed bps as the hook emits them. Positive drift = pool price above fair.
 * The component clamps visually past the hard threshold so the marker is always on the track.
 */
export function DriftBand({
  driftBps,
  toleranceBps,
  hardThresholdBps,
  broken,
}: {
  driftBps: bigint | undefined;
  toleranceBps: number | undefined;
  hardThresholdBps: number | undefined;
  broken: boolean;
}) {
  const tol = toleranceBps ?? 500;
  const hard = hardThresholdBps ?? 1500;
  const d = driftBps !== undefined ? Number(driftBps) : 0;
  // Visual extent reaches a bit past the hard threshold so the band edges are visible.
  const extent = hard * 1.2;
  const clamped = Math.max(-extent, Math.min(extent, d));
  const center = 50;
  const span = 50; // 0..100 around the center
  const tolWidth = (tol / extent) * span;
  const hardWidth = (hard / extent) * span;
  const markerLeft = ((clamped + extent) / (2 * extent)) * 100;

  const status = driftBps === undefined
    ? "—"
    : broken
      ? "structural break"
      : Math.abs(d) <= tol
        ? "in band"
        : Math.abs(d) >= hard
          ? "beyond hard threshold"
          : "out of band";

  return (
    <div className="px-6 py-5 border-t border-line">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        <span>Drift band</span>
        <span className={broken ? "text-amber-200/90" : "text-ink"}>{status}</span>
      </div>

      <div className="relative mt-4 h-9">
        {/* extent track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-line" />

        {/* hard-threshold band — outside is "danger" / break-eligible */}
        <div
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 h-3 border-y border-amber-300/30 bg-amber-300/[0.05]"
          style={{
            left: `${center - hardWidth}%`,
            width: `${hardWidth * 2}%`,
          }}
        />

        {/* tolerance band — inside is flat fee / "ok" */}
        <div
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 h-3 bg-emerald-300/15"
          style={{
            left: `${center - tolWidth}%`,
            width: `${tolWidth * 2}%`,
          }}
        />

        {/* centre tick (fair price) */}
        <div
          aria-hidden
          className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 h-5 w-px bg-ink/60"
        />

        {/* current drift marker */}
        {driftBps !== undefined ? (
          <div
            aria-hidden
            className={`absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full ring-2 ring-bg ${
              broken ? "bg-amber-200" : Math.abs(d) <= tol ? "bg-emerald-300" : "bg-ink"
            }`}
            style={{left: `calc(${markerLeft}% - 5px)`}}
          />
        ) : null}
      </div>

      <div className="mt-3 flex justify-between font-mono text-[10px] text-muted">
        <span>−{hard} bps</span>
        <span>±{tol}</span>
        <span>+{hard} bps</span>
      </div>
    </div>
  );
}
