export function Footer() {
  return (
    <footer className="mx-auto max-w-2xl px-6 pb-20 mt-32 pt-10 border-t border-line text-[13px] leading-relaxed text-muted">
      <p>
        MSTRX is a security under Backed Finance's wrapper structure. Anyone holding it has gone
        through Backed's KYC. The Twine pool itself does no KYC — it inherits the wrapper's gating
        rather than imposing its own. Twine is unaudited and pre-launch. Nothing on this page is
        investment advice.
      </p>
      <p className="mt-4">
        © Twine. Not affiliated with Strategy, Backed Finance, Coinbase, or Uniswap Labs.
      </p>
    </footer>
  );
}
