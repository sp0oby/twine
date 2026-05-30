"use client";

import {useChainId} from "wagmi";

import {getDeployment} from "@/lib/twine";
import {explorerAddress} from "@/lib/wagmi";

/**
 * Surfaces the active chain's deployed Twine contracts (or "no deployment found" honestly).
 * Reads from `frontend/lib/deployments/<chain>.json` — populated by `script/DeployTestnet.s.sol`.
 */
export function DeploymentPanel() {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);

  return (
    <section className="mt-24">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Deployment</h2>
      {deployment ? (
        <dl className="mt-4 font-mono text-[12px] text-ink/85 grid grid-cols-[10rem_1fr] gap-y-3">
          <dt className="text-muted">Chain</dt>
          <dd className="text-white">{deployment.chainId}</dd>
          <AddrRow chainId={chainId} label="Hook" addr={deployment.hook} />
          <AddrRow chainId={chainId} label="Position manager" addr={deployment.positionManager} />
          <AddrRow chainId={chainId} label="Swap router" addr={deployment.swapRouter} />
          <AddrRow chainId={chainId} label="Governor" addr={deployment.governor} />
          <AddrRow chainId={chainId} label="Vault" addr={deployment.vault} />
          <AddrRow chainId={chainId} label="STRAND" addr={deployment.strand} />
          <AddrRow chainId={chainId} label="Token0" addr={deployment.token0} />
          <AddrRow chainId={chainId} label="Token1" addr={deployment.token1} />
        </dl>
      ) : (
        <p className="mt-4 font-mono text-[13px] text-muted">
          No deployment found for this chain. Run{" "}
          <span className="text-ink">forge script script/DeployTestnet.s.sol --broadcast</span> and
          the resulting addresses will appear here automatically.
        </p>
      )}
    </section>
  );
}

function AddrRow({chainId, label, addr}: {chainId: number; label: string; addr: `0x${string}` | undefined}) {
  if (!addr) {
    return (
      <>
        <dt className="text-muted">{label}</dt>
        <dd className="text-muted">— not deployed —</dd>
      </>
    );
  }
  const url = explorerAddress(chainId, addr);
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="break-all">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-white hover:underline">
            {addr} ↗
          </a>
        ) : (
          <span className="text-white">{addr}</span>
        )}
      </dd>
    </>
  );
}
