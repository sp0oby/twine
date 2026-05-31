"use client";

import {useEffect, useState} from "react";
import {useChainId, usePublicClient} from "wagmi";

import {pmEventsAbi} from "@/lib/abis";
import {getDeployment} from "@/lib/twine";

/**
 * Reads `FeesRouted` events emitted by `TwinePositionManager` and sums the routed amounts
 * (vault cut + buyback cut, both tokens) over the recent lookback window.
 *
 * The LP cut is NOT in the event — it stays in the PM and accrues to the per-share accumulator.
 * What we sum here is "fees that left the LP pool", which is the right proxy for showing pool
 * activity on the dashboard. With the testnet default split (vault 20% / buyback 10% / LP 70%),
 * the routed sum is roughly 30% of the gross fee — multiply by ~3.33 to estimate gross.
 */
export function useRoutedFees({
  lookbackBlocks = 25_000n,
  refetchMs = 30_000,
  chunkSize = 2_000n,
}: {lookbackBlocks?: bigint; refetchMs?: number; chunkSize?: bigint} = {}) {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const publicClient = usePublicClient({chainId});
  const [fee0, setFee0] = useState<bigint | undefined>(undefined);
  const [fee1, setFee1] = useState<bigint | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);

  const pm = deployment?.positionManager;
  const poolIdBigint = deployment ? BigInt(deployment.poolId) : undefined;

  useEffect(() => {
    if (!publicClient || !pm || poolIdBigint === undefined) return;
    let cancelled = false;

    async function load() {
      try {
        const latest = await publicClient!.getBlockNumber();
        const from = latest > lookbackBlocks ? latest - lookbackBlocks : 0n;

        const fetchChunk = (start: bigint, end: bigint) =>
          publicClient!.getLogs({
            address: pm,
            event: pmEventsAbi[0],
            args: {id: poolIdBigint as bigint},
            fromBlock: start,
            toBlock: end,
          });
        type ChunkLogs = Awaited<ReturnType<typeof fetchChunk>>;

        let logs: ChunkLogs = [] as unknown as ChunkLogs;
        for (let cursor = from; cursor <= latest; cursor += chunkSize) {
          if (cancelled) return;
          const end = cursor + chunkSize - 1n > latest ? latest : cursor + chunkSize - 1n;
          const slice = await fetchChunk(cursor, end);
          if (slice.length > 0) logs = logs.concat(slice) as ChunkLogs;
        }

        let f0 = 0n;
        let f1 = 0n;
        for (const log of logs) {
          const args = (log as unknown as {
            args: {vault0?: bigint; vault1?: bigint; buyback0?: bigint; buyback1?: bigint};
          }).args;
          f0 += (args.vault0 ?? 0n) + (args.buyback0 ?? 0n);
          f1 += (args.vault1 ?? 0n) + (args.buyback1 ?? 0n);
        }
        if (!cancelled) {
          setFee0(f0);
          setFee1(f1);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e as Error);
      }
    }

    load();
    const t = setInterval(load, refetchMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [publicClient, pm, poolIdBigint, lookbackBlocks, refetchMs, chunkSize]);

  return {fee0, fee1, error};
}
