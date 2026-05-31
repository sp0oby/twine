"use client";

import {useEffect, useMemo, useState} from "react";
import {useChainId, usePublicClient} from "wagmi";

import {hookEventsAbi} from "@/lib/abis";
import {getDeployment} from "@/lib/twine";

/**
 * One `SwapProcessed` row, enriched with our derived corrective/adversarial classification.
 *
 * The hook emits POST-swap drift only, so the classification is derived from the *previous*
 * row's drift. The first row in the window is marked "-" because there's nothing to compare to.
 */
export type SwapRow = {
  id: string; // tx-hash:logIndex
  blockNumber: bigint;
  timestamp: bigint | undefined;
  driftBps: bigint;
  asymmetricActive: boolean;
  structuralBreakTriggered: boolean;
  /** "corrective" | "adversarial" | "neutral" | undefined */
  classification?: "corrective" | "adversarial" | "neutral";
  txHash: `0x${string}`;
};

/**
 * Pulls SwapProcessed events from chain via getLogs and classifies each swap against the previous
 * one's drift. Defaults to scanning back ~150k blocks (about 3 days on Base Sepolia at 2s blocks)
 * but never reaches before the deployment block.
 *
 * Public RPCs (the default fallback in lib/wagmi.ts) clamp `eth_getLogs` ranges aggressively, so
 * we paginate in fixed-size windows. Configure NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL with a real
 * provider for fast scans.
 */
export function useHookSwaps({
  lookbackBlocks = 25_000n,
  refetchMs = 90_000,
  chunkSize = 2_000n,
}: {lookbackBlocks?: bigint; refetchMs?: number; chunkSize?: bigint} = {}) {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const publicClient = usePublicClient({chainId});
  const [rows, setRows] = useState<SwapRow[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const poolId = deployment?.poolId;
  const hook = deployment?.hook;

  useEffect(() => {
    if (!publicClient || !hook || !poolId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const latest = await publicClient!.getBlockNumber();
        const from = latest > lookbackBlocks ? latest - lookbackBlocks : 0n;

        // Single helper so the inferred type carries `args` through (a typed event ABI is essential).
        const fetchChunk = (start: bigint, end: bigint) =>
          publicClient!.getLogs({
            address: hook,
            event: hookEventsAbi[0],
            args: {id: poolId as `0x${string}`},
            fromBlock: start,
            toBlock: end,
          });
        type ChunkLogs = Awaited<ReturnType<typeof fetchChunk>>;

        // Paginate the scan in `chunkSize`-block windows so we don't blow past public-RPC limits.
        // Public Base nodes typically cap eth_getLogs at ~10k blocks; 2k is safely below that and
        // still finishes fast against Alchemy / QuickNode.
        let logs: ChunkLogs = [] as unknown as ChunkLogs;
        for (let cursor = from; cursor <= latest; cursor += chunkSize) {
          if (cancelled) return;
          const end = cursor + chunkSize - 1n > latest ? latest : cursor + chunkSize - 1n;
          const slice = await fetchChunk(cursor, end);
          if (slice.length > 0) logs = logs.concat(slice) as ChunkLogs;
        }

        // Sort ascending so we can classify each row against the previous one's drift.
        // (Pending logs would have null block numbers; filter them since we only want mined data.)
        const mined = logs.filter((l) => l.blockNumber !== null);
        const sorted = [...mined].sort((a, b) => {
          const ab = a.blockNumber as bigint;
          const bb = b.blockNumber as bigint;
          if (ab === bb) return (a.logIndex ?? 0) - (b.logIndex ?? 0);
          return ab < bb ? -1 : 1;
        });

        const enriched: SwapRow[] = [];
        let prevAbs: bigint | undefined = undefined;
        for (const log of sorted) {
          // viem's strongly typed event args (via the `event:` form above) put fields on `args`.
          const args = (log as unknown as {args: {driftBps?: bigint; asymmetricActive?: boolean; structuralBreakTriggered?: boolean}}).args;
          const driftBps = (args.driftBps ?? 0n) as bigint;
          const absDrift = driftBps < 0n ? -driftBps : driftBps;
          let classification: SwapRow["classification"];
          if (prevAbs !== undefined) {
            if (absDrift < prevAbs) classification = "corrective";
            else if (absDrift > prevAbs) classification = "adversarial";
            else classification = "neutral";
          }
          enriched.push({
            id: `${log.transactionHash}:${log.logIndex}`,
            blockNumber: log.blockNumber as bigint,
            timestamp: undefined,
            driftBps,
            asymmetricActive: (args.asymmetricActive ?? false) as boolean,
            structuralBreakTriggered: (args.structuralBreakTriggered ?? false) as boolean,
            classification,
            txHash: log.transactionHash as `0x${string}`,
          });
          prevAbs = absDrift;
        }

        // Best-effort timestamp enrichment for the most recent N rows so the panel can show
        // "X minutes ago" without a paginated chain-wide getBlock storm.
        const TIMESTAMP_BUDGET = 25;
        const head = enriched.slice(-TIMESTAMP_BUDGET);
        await Promise.all(
          head.map(async (row) => {
            try {
              const block = await publicClient!.getBlock({blockNumber: row.blockNumber});
              row.timestamp = block.timestamp;
            } catch {
              // Ignore - leave undefined and the panel will hide the relative time.
            }
          }),
        );

        if (!cancelled) {
          setRows(enriched);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, refetchMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [publicClient, hook, poolId, lookbackBlocks, refetchMs]);

  // Newest-first for UI consumption, but original order is preserved on `rows` for analytics.
  const newest = useMemo(() => (rows ? [...rows].reverse() : null), [rows]);

  return {
    rows,
    newest,
    loading,
    error,
    deployment,
  };
}
