"use client";

import {useEffect, useMemo, useState} from "react";
import {useChainId, usePublicClient} from "wagmi";

import {hookEventsAbi} from "@/lib/abis";
import {getDeployment} from "@/lib/twine";

/**
 * One `SwapProcessed` row, enriched with our derived corrective/adversarial classification.
 *
 * The hook emits POST-swap drift only, so the classification is derived from the *previous*
 * row's drift. The first row in the window is marked "—" because there's nothing to compare to.
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
 * No indexer required — falls back to the public Base RPCs the frontend already uses for reads.
 */
export function useHookSwaps({
  lookbackBlocks = 150_000n,
  refetchMs = 30_000,
}: {lookbackBlocks?: bigint; refetchMs?: number} = {}) {
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
        const logs = await publicClient!.getLogs({
          address: hook,
          event: hookEventsAbi[0],
          args: {id: poolId as `0x${string}`},
          fromBlock: from,
          toBlock: latest,
        });

        // Sort ascending so we can classify each row against the previous one's drift.
        const sorted = [...logs].sort((a, b) => {
          if (a.blockNumber === b.blockNumber) return (a.logIndex ?? 0) - (b.logIndex ?? 0);
          return a.blockNumber < b.blockNumber ? -1 : 1;
        });

        const enriched: SwapRow[] = [];
        let prevAbs: bigint | undefined = undefined;
        for (const log of sorted) {
          const driftBps = (log.args.driftBps ?? 0n) as bigint;
          const absDrift = driftBps < 0n ? -driftBps : driftBps;
          let classification: SwapRow["classification"];
          if (prevAbs !== undefined) {
            if (absDrift < prevAbs) classification = "corrective";
            else if (absDrift > prevAbs) classification = "adversarial";
            else classification = "neutral";
          }
          enriched.push({
            id: `${log.transactionHash}:${log.logIndex}`,
            blockNumber: log.blockNumber,
            timestamp: undefined,
            driftBps,
            asymmetricActive: (log.args.asymmetricActive ?? false) as boolean,
            structuralBreakTriggered: (log.args.structuralBreakTriggered ?? false) as boolean,
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
              // Ignore — leave undefined and the panel will hide the relative time.
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
