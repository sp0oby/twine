"use client";

import {useAccount, useChainId, useSwitchChain} from "wagmi";
import {baseSepolia} from "wagmi/chains";

import {getDeployment} from "@/lib/twine";
import {chainNameById} from "@/lib/wagmi";

/**
 * Honest "wrong network" prompt. Renders nothing in the happy path. If a wallet is connected
 * to a chain Twine isn't deployed on, this asks the user to switch to the supported chain.
 * Until mainnet is up, the supported chain is Base Sepolia.
 */
export function NetworkBanner() {
  const {isConnected} = useAccount();
  const chainId = useChainId();
  const {switchChain, isPending} = useSwitchChain();
  const deployment = getDeployment(chainId);

  if (!isConnected) return null;
  if (deployment) return null;

  const current = chainNameById[chainId] ?? `chain ${chainId}`;

  return (
    <div className="mt-8 border border-line px-5 py-4 flex items-baseline justify-between gap-4">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-amber-200/90">
          Wrong network
        </div>
        <div className="mt-1 font-mono text-[13px] text-muted">
          Twine is only deployed on Base Sepolia. You're on {current}.
        </div>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchChain({chainId: baseSepolia.id})}
        className="font-mono text-[11px] uppercase tracking-[0.22em] text-white border border-line px-4 py-2 hover:bg-white/5 disabled:text-muted disabled:cursor-not-allowed"
      >
        {isPending ? "Switching…" : "Switch to Base Sepolia"}
      </button>
    </div>
  );
}
