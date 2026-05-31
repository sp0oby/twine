"use client";

import {useReadContract, useChainId} from "wagmi";

import {Header} from "@/components/Header";
import {Footer} from "@/components/Footer";
import {getDeployment} from "@/lib/twine";
import {explorerAddress} from "@/lib/wagmi";

const governorOwnerAbi = [
  {type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{name: "", type: "address"}]},
] as const;

export default function GovernancePage() {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);

  const {data: owner} = useReadContract({
    address: deployment?.governor,
    abi: governorOwnerAbi,
    functionName: "owner",
    query: {enabled: !!deployment},
  });

  return (
    <main className="min-h-screen">
      <Header />
      <article className="mx-auto max-w-2xl px-6 pt-24 pb-32">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Governance</p>
        <h1 className="mt-3 text-[36px] sm:text-[44px] font-medium tracking-[-0.02em] leading-[1.1]">
          One contract, two upgrade paths.
        </h1>
        <p className="mt-8 text-[17px] leading-relaxed text-ink/85">
          Twine's governance surface is deliberately minimal in v1: a single Ownable contract
          (<code className="font-mono">TwineGovernor</code>) holds the hook's <em>governor</em> role
          and forwards a handful of admin calls. The owner is a multisig today. Two routes carry
          control into v2 on-chain governance without redeploying the hook.
        </p>

        <Section label="Current controller (v1)">
          <ControllerCard
            label="TwineGovernor.owner()"
            address={owner as `0x${string}` | undefined}
            chainId={chainId}
            hint="Multisig signers in v1. Switch to a Safe with founder + community guardians for testnet soak."
          />
          <ControllerCard
            label="TwineGovernor"
            address={deployment?.governor}
            chainId={chainId}
            hint="Holds TwineHook.governor. Owner-only forwarding of authorizePool / updatePoolConfig / setVault / pause."
          />
          <ControllerCard
            label="TwineHook"
            address={deployment?.hook}
            chainId={chainId}
            hint="The role-receiver. governor can be repointed via setHookGovernor without redeploying the hook."
          />
        </Section>

        <Section label="Powers held by the governor">
          <ul className="space-y-2 font-mono text-[13px] text-ink/85">
            <Power name="authorizePool" desc="register a new pool with oracles, market-hours feed, kScaled, base fee, tolerance, hard threshold" />
            <Power name="updatePoolConfig" desc="re-tune a pool's parameters" />
            <Power name="setVault" desc="bind a per-pool TwineUnderwritingVault and its drawdownBps" />
            <Power name="resolveStructuralBreak" desc="lift a pool out of structural-break state once the underlying has reconverged" />
            <Power name="pauseHook / unpauseHook" desc="global emergency pause of swap routing through the hook" />
            <Power name="setHookGovernor" desc="hand the hook's governor role to a successor controller (v2 path)" />
          </ul>
        </Section>

        <Section label="Path to v2 on-chain voting">
          <p>
            v1 ships without on-chain voting on purpose. STRAND tokens are minted; the §7.4
            machinery (1% proposal threshold, 5% quorum, 2-day vote + 2-day timelock) is a v2
            deliverable. Either of two transitions completes the handoff:
          </p>
          <ol className="mt-4 space-y-3 text-[14px] leading-relaxed text-ink/85 list-decimal pl-5">
            <li>
              <span className="text-white">Transfer ownership of <code className="font-mono">TwineGovernor</code></span> {" "}
              to a new on-chain governance contract (e.g. an OpenZeppelin <code className="font-mono">Governor</code>{" "}
              over STRAND with a timelock). Existing wiring keeps working; the new contract decides
              calls.
            </li>
            <li>
              <span className="text-white">Call <code className="font-mono">setHookGovernor</code></span> from the
              multisig to repoint the hook's governor role directly at the new controller. The
              v1 governor loses its role; the v2 controller takes over without any hook redeploy.
            </li>
          </ol>
        </Section>

        <Section label="On-chain voting interface">
          <p>
            A Tally embed will live here once the v2 Governor + Timelock are deployed and the
            multisig has handed off. Tally renders proposals, votes, and execution windows against
            any OpenZeppelin-compatible governor without bespoke frontend work — that's the
            cheapest credible v1 of a governance UI.
          </p>
          <div className="mt-4 border border-line bg-white/[0.02] px-5 py-6 text-center font-mono text-[12px] uppercase tracking-[0.22em] text-muted">
            Tally embed — pending v2 Governor deployment
          </div>
        </Section>

        <Section label="Audit posture">
          <p>
            v1's governance footprint is small by design: ~60 lines of Solidity, all forwarders,
            no voting math. The risk surface is the <em>powers</em> the governor holds over the
            hook, not the voting mechanism. That makes the v1 audit conversation simple — review
            the forwarders, then review the hook calls they unlock.
          </p>
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

function ControllerCard({
  label,
  address,
  chainId,
  hint,
}: {
  label: string;
  address: `0x${string}` | undefined;
  chainId: number;
  hint: string;
}) {
  const url = address ? explorerAddress(chainId, address) : undefined;
  return (
    <div className="border border-line px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">{label}</span>
        {address ? (
          url ? (
            <a href={url} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-white hover:underline break-all">
              {address} ↗
            </a>
          ) : (
            <span className="font-mono text-[12px] text-white break-all">{address}</span>
          )
        ) : (
          <span className="font-mono text-[12px] text-muted">—</span>
        )}
      </div>
      <p className="mt-2 text-[13px] text-muted leading-relaxed">{hint}</p>
    </div>
  );
}

function Power({name, desc}: {name: string; desc: string}) {
  return (
    <li className="grid grid-cols-[12rem_1fr] gap-4">
      <span className="text-white">{name}</span>
      <span className="text-muted">{desc}</span>
    </li>
  );
}
