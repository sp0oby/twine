import type {Metadata} from "next";
import Link from "next/link";

import {Header} from "@/components/Header";
import {Footer} from "@/components/Footer";
import {DeploymentPanel} from "@/components/DeploymentPanel";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How the hook works, who owns what, and the live Base Sepolia deployment addresses. The short version of PROJECT_SPEC.md, with links into the canonical source.",
};

export default function DocsPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <article className="mx-auto max-w-2xl px-6 pt-24 pb-32">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Docs</p>
        <h1 className="mt-3 text-[36px] sm:text-[44px] font-medium tracking-[-0.02em] leading-[1.1]">
          How Twine works.
        </h1>
        <p className="mt-8 text-[17px] leading-relaxed text-ink/85">
          Twine is a Uniswap v4 hook. The hook makes a pool behave less like a passive AMM and more
          like a tightly-managed pair-trade vehicle. Two long-only tokens, one continuously enforced
          economic relationship.
        </p>

        <Section label="The hook">
          <p>
            Every swap routes through the hook's <code className="font-mono">beforeSwap</code>{" "}
            callback. The hook reads two oracle prices and the pool's current ratio, computes the
            implied drift from fair value, and returns an asymmetric fee. Swaps that move the pool
            <em> toward</em> fair are discounted below the base fee; swaps that move it away are
            surcharged. The result is a market force that pulls the pool back to the implied
            equilibrium without LPs or stakers having to actively manage anything.
          </p>
        </Section>

        <Section label="LPs vs stakers">
          <p>
            <span className="text-white">Liquidity providers</span> deposit token0 and token1, mint
            non-transferable LP shares against a TwinePositionManager, and collect a share of swap
            fees in both tokens. They do <em>not</em> bear structural-break risk.
          </p>
          <p className="mt-4">
            <span className="text-white">STRAND stakers</span> deposit a governance asset into the
            per-pool underwriting vault. They earn a configurable cut of swap fees in token0/token1
            but underwrite the pool: when the hook declares a structural break, it seizes a
            fraction of staked STRAND to fund a rebalance and every staker takes a pro-rata
            haircut. A seven-day cooldown blocks staker flight during a break.
          </p>
        </Section>

        <Section id="market-hours" label="Market hours">
          <p>
            MSTRX has a real underlying — a US-listed equity. When NYSE is closed the equity
            oracle stops updating, so Twine cannot honestly price the leg and cannot promise
            the spread will converge. The hook reads NYSE hours directly on-chain (no off-chain
            feed; the calendar is hardcoded with DST and US market holidays through 2030, with
            governance extension), and changes pool behavior accordingly:
          </p>
          <ul className="space-y-2 text-[14px] leading-relaxed text-ink/85 list-disc pl-5 marker:text-muted">
            <li><span className="text-white">Swaps stay open</span>, at a flat symmetric fee. The asymmetric mechanic is paused until reopen.</li>
            <li><span className="text-white">Deposits are blocked.</span> Entering during close means committing capital at a price the protocol explicitly isn't policing — the in-band check would reference a 60-hour-old equity quote, and the asymmetric mechanic that's the whole reason to LP here is off. "Disclose and let them choose" isn't real protection, so the protocol refuses the deposit instead.</li>
            <li><span className="text-white">Withdrawals stay open</span>, the entire time. Existing LPs already committed with a defined risk profile; letting them out is "you can change your mind."</li>
            <li><span className="text-white">Structural-break detection is paused.</span> The hard-threshold drawdown only runs when prices are live.</li>
          </ul>
          <p>
            Reopens automatically at 9:30 AM ET on the next trading day. No keeper involved.
          </p>
        </Section>

        <Section label="Structural breaks">
          <p>
            If the oracle disagrees with the pool by more than a hard threshold (default 15%) and
            the pool's recent drawdown exceeds a separate threshold, the hook flips a{" "}
            <code className="font-mono">structuralBreak</code> flag and disables both directional
            fees and new LP deposits. A drawdown from the vault funds the rebalance back to fair
            value. Withdrawals stay open the entire time.
          </p>
        </Section>

        <Section label="Status">
          <pre className="font-mono text-[13px] leading-[1.8] text-ink/80 border-l border-line pl-5 whitespace-pre">
{`Spec version       v0.17
Build phase        Phases 0–10 complete  ·  live on Base Sepolia
Contracts          Solidity 0.8.26  (BUSL hook / MIT elsewhere)
Audit              pending
Network            Base Sepolia testnet  (mocked equity leg)`}
          </pre>
        </Section>

        <Section label="Source">
          <ul className="space-y-2 font-mono text-[13px]">
            <SourceLink
              href="https://github.com/sp0oby/twine/blob/main/PROJECT_SPEC.md"
              label="PROJECT_SPEC.md"
              hint="canonical specification"
            />
            <SourceLink
              href="https://github.com/sp0oby/twine/blob/main/TODO.md"
              label="TODO.md"
              hint="build progress"
            />
            <SourceLink
              href="https://github.com/sp0oby/twine"
              label="Source on GitHub"
              hint="contracts + tests"
            />
          </ul>
        </Section>

        <DeploymentPanel />

        <div className="mt-20">
          <Link
            href="/app"
            className="inline-flex items-center border border-line px-6 py-3 font-mono text-[12px] uppercase tracking-[0.22em] text-white hover:bg-white/5 transition-colors"
          >
            Open the dashboard →
          </Link>
        </div>
      </article>
      <Footer />
    </main>
  );
}

function Section({id, label, children}: {id?: string; label: string; children: React.ReactNode}) {
  return (
    <section id={id} className="mt-16 scroll-mt-20">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">{label}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-ink/85">{children}</div>
    </section>
  );
}

function SourceLink({href, label, hint}: {href: string; label: string; hint: string}) {
  return (
    <li>
      <a
        href={href}
        className="group inline-flex items-baseline gap-3 hover:text-white transition-colors"
      >
        <span className="underline-offset-4 group-hover:underline">{label}</span>
        <span className="text-muted">·</span>
        <span className="text-muted">{hint}</span>
      </a>
    </li>
  );
}
