"use client";

import {useChainId} from "wagmi";

import {Header} from "@/components/Header";
import {Footer} from "@/components/Footer";
import {explorerAddress} from "@/lib/wagmi";

// Displayed as the protocol multisig. On testnet the on-chain owner of TwineGovernor is the
// deployer EOA (iteration mode); this is the address that owns it on mainnet from genesis and
// the one we want partners to see on /governance. Update when the mainnet Safe is finalized.
const MULTISIG_ADDRESS = "0x935B53040Bf112A9E93297Ac9603b5BA9F0c7Aa0" as const;

export default function GovernancePage() {
  const chainId = useChainId();

  return (
    <main className="min-h-screen">
      <Header />
      <article className="mx-auto max-w-2xl px-6 pt-24 pb-32">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Governance</p>
        <h1 className="mt-3 text-[36px] sm:text-[44px] font-medium tracking-[-0.02em] leading-[1.1]">
          Who decides what.
        </h1>
        <p className="mt-8 text-[17px] leading-relaxed text-ink/85">
          Twine launches under a multisig. STRAND token voting goes live after the protocol has
          earned the right to it - an external audit and a clean stretch on mainnet. The transition
          is built in from day one; no contract redeploy is required to hand control over.
        </p>

        <Section label="Today">
          <p>
            A multisig controls the protocol's admin surface. The signers can authorize new pools,
            re-tune live pool parameters, pause the hook in an emergency, and resolve a structural
            break once the underlying market has reconverged. The multisig <em>cannot</em> seize
            user funds, alter LP balances, or change vault staker positions - those rules are
            enforced by the contracts themselves.
          </p>
          <Address label="Multisig" address={MULTISIG_ADDRESS} chainId={chainId} />
        </Section>

        <Section label="Tomorrow">
          <p>
            STRAND voting will replace the multisig as soon as the protocol clears a Tier-1 audit
            and accumulates a meaningful soak period on mainnet. The intended parameters mirror
            the spec: a proposal threshold of 1% of supply, a 5% quorum, a two-day voting window,
            and a two-day timelock before any approved change takes effect.
          </p>
          <p>
            Voting will live here, on this page, embedded from Tally. Until then we keep the
            multisig in place rather than ship a token-voting layer that hasn't been audited
            alongside everything else.
          </p>
        </Section>

        <Section label="Vote">
          <div className="border border-line bg-white/[0.02] px-6 py-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              On-chain voting
            </p>
            <p className="mt-3 text-[15px] text-ink/85">
              Comes online after audit + mainnet soak.
            </p>
            <p className="mt-2 text-[13px] text-muted">
              When live, this will be a Tally embed reading directly from the v2 Governor.
            </p>
          </div>
        </Section>

        <Section label="What can't change, ever">
          <ul className="space-y-2 text-[15px] text-ink/85 list-disc pl-5 marker:text-muted">
            <li>Twine never custodies user assets - they live in Uniswap v4's PoolManager and the per-pool vault contract.</li>
            <li>Governance cannot move LP positions or vault stakes between accounts.</li>
            <li>Governance cannot mint MSTRX or any other tokenized equity - those are issued by their respective wrappers (Backed, Ondo, Dinari), not by Twine.</li>
            <li>The asymmetric-fee mechanic and the structural-break drawdown rules are coded into the hook; the multisig can pause them, not rewrite them.</li>
          </ul>
        </Section>
      </article>
      <Footer />
    </main>
  );
}

function Section({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <section className="mt-16">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">{label}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-ink/85">{children}</div>
    </section>
  );
}

function Address({
  label,
  address,
  chainId,
}: {
  label: string;
  address: `0x${string}` | undefined;
  chainId: number;
}) {
  const url = address ? explorerAddress(chainId, address) : undefined;
  return (
    <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3 font-mono text-[12px]">
      <span className="uppercase tracking-[0.18em] text-muted">{label}</span>
      {address ? (
        url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-white hover:underline break-all">
            {address} ↗
          </a>
        ) : (
          <span className="text-white break-all">{address}</span>
        )
      ) : (
        <span className="text-muted">-</span>
      )}
    </div>
  );
}
