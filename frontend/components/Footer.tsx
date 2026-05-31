export function Footer() {
  return (
    <footer className="mx-auto max-w-2xl px-6 pb-20 mt-32 pt-10 border-t border-line text-[13px] leading-relaxed text-muted">
      <p>
        MSTRX is a security under Backed Finance's wrapper structure. Anyone holding it has gone
        through Backed's KYC. The Twine pool itself does no KYC - it inherits the wrapper's gating
        rather than imposing its own. Twine is unaudited and pre-launch. Nothing on this page is
        investment advice.
      </p>
      <p className="mt-4">
        © Twine. Not affiliated with Strategy, Backed Finance, Coinbase, or Uniswap Labs.
      </p>
      <nav className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        <a
          href="https://github.com/sp0oby/twine"
          target="_blank"
          rel="noreferrer"
          className="hover:text-ink transition-colors"
        >
          GitHub ↗
        </a>
        <a
          href="https://github.com/sp0oby/twine/blob/main/PROJECT_SPEC.md"
          target="_blank"
          rel="noreferrer"
          className="hover:text-ink transition-colors"
        >
          Spec ↗
        </a>
        <a
          href="https://github.com/sp0oby/twine/blob/main/TODO.md"
          target="_blank"
          rel="noreferrer"
          className="hover:text-ink transition-colors"
        >
          Roadmap ↗
        </a>
      </nav>
    </footer>
  );
}
