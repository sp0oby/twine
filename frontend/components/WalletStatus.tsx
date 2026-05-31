"use client";

import {useAccount, useChainId} from "wagmi";

import {chainNameById} from "@/lib/wagmi";

/**
 * Honest, minimal connection state for the dashboard. Shows nothing fake - if no wallet is
 * connected the panel just says so and points at the header.
 */
export function WalletStatus() {
  const {address, isConnected} = useAccount();
  const chainId = useChainId();

  return (
    <section className="mt-24">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Your wallet</h2>
      {isConnected ? (
        <dl className="mt-4 font-mono text-[13px] text-ink/85 grid grid-cols-[8rem_1fr] gap-y-2">
          <dt className="text-muted">Address</dt>
          <dd className="text-white break-all">{address}</dd>
          <dt className="text-muted">Network</dt>
          <dd className="text-white">{chainNameById[chainId] ?? chainId}</dd>
        </dl>
      ) : (
        <p className="mt-4 font-mono text-[13px] text-muted">
          Wallet not connected. Use the connect button in the header.
        </p>
      )}
    </section>
  );
}
