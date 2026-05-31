import Link from "next/link";

import {Header} from "@/components/Header";
import {Footer} from "@/components/Footer";
import {LivePoolStrip} from "@/components/LivePoolStrip";

export default function SplashPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <article className="mx-auto max-w-2xl px-6 pt-24">
        <h1 className="text-[44px] sm:text-5xl font-medium tracking-[-0.02em] leading-[1.05]">
          A market for the spread.
        </h1>
        <p className="mt-8 text-[17px] leading-relaxed text-ink/85">
          Twine is a Uniswap v4 hook that turns a pool into a continuously-rebalancing pair-trade
          vehicle between two fundamentally-linked assets. The flagship pair is{" "}
          <span className="font-mono text-white">MSTRX/cbBTC</span> - Strategy's stock against
          Bitcoin.
        </p>

        <Section label="Mechanic">
          Each Twine pool enforces dollar-neutrality between its two reserves. The hook intercepts
          every swap and applies an asymmetric fee based on which direction the swap pushes the pool.
          Swaps toward the oracle-implied fair price are discounted; swaps away are surcharged. The
          spread mean-reverts. Liquidity providers capture the elevated fees from the directional
          flow.
        </Section>

        <Section label="Flagship pair">
          Strategy holds approximately 600,000 BTC on its balance sheet. The stock is, in economic
          substance, levered Bitcoin plus a financing premium and an operating-business overlay.
          When that premium drifts from its rolling norm, Twine is the market for trading the drift.
          Historical MSTR/BTC spread is large enough - often 10%+ deviations from mean - to make
          pair-trade fees meaningful.
        </Section>

        <Section label="Market hours">
          MSTRX has a real underlying: a US-listed equity. When NYSE is closed, Twine reverts to flat
          fees across both directions. The pool stays usable, but does not promise convergence in
          those windows. LPs bear the resulting gap risk; a per-pool underwriting vault, capitalized
          by STRAND stakers, backstops structural breaks.
        </Section>

        <Section label="On-chain right now">
          <p className="mt-3 text-[15px] leading-[1.75] text-ink/85">
            The flagship pool is live on Base Sepolia against mocked equity feeds. Drift, fair price
            and vault stake are read straight from the deployed contracts every twelve seconds.
          </p>
          <LivePoolStrip />
        </Section>

        <Section label="Open">
          <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:gap-6 items-stretch sm:items-baseline">
            <Link
              href="/app"
              className="inline-flex items-center justify-center border border-line px-6 py-3 font-mono text-[12px] uppercase tracking-[0.22em] text-white hover:bg-white/5 transition-colors"
            >
              Open the dashboard →
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center px-2 py-3 font-mono text-[12px] uppercase tracking-[0.22em] text-muted hover:text-white transition-colors"
            >
              Read the docs
            </Link>
          </div>
        </Section>
      </article>
      <Footer />
    </main>
  );
}

function Section({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <section className="mt-20">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">{label}</h2>
      <div className="mt-4 text-[15px] leading-[1.75] text-ink/85">{children}</div>
    </section>
  );
}
