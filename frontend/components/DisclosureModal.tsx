"use client";

import {useEffect, useState} from "react";

const STORAGE_KEY = "twine.disclosure.ack.v1";

/**
 * First-visit dismissable modal explaining the tokenized-equity dependency.
 *
 * The Twine pool does no KYC - it's a smart contract - but MSTRX is a security under Backed's
 * wrapper structure and you must have already gone through Backed's KYC to hold it
 * (PROJECT_SPEC.md §2.4). The modal makes that inheritance explicit before users interact.
 *
 * Acknowledgement is persisted to localStorage so the modal does not nag returning users.
 */
export function DisclosureModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const ack = window.localStorage.getItem(STORAGE_KEY);
      if (!ack) setOpen(true);
    } catch {
      // Privacy-mode browsers throw on localStorage access; default to showing the modal.
      setOpen(true);
    }
  }, []);

  function acknowledge() {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Best-effort; ignore quota / privacy errors.
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="twine-disclosure-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6"
    >
      <div className="w-full max-w-lg border border-line bg-bg text-ink shadow-2xl">
        <div className="px-6 pt-6 pb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Disclosure</p>
          <h2 id="twine-disclosure-title" className="mt-2 text-[20px] font-medium tracking-tight">
            This pool depends on a tokenized equity.
          </h2>
        </div>
        <div className="px-6 pb-5 space-y-4 text-[14px] leading-relaxed text-ink/85">
          <p>
            The flagship pair is{" "}
            <span className="font-mono text-white">MSTRX / cbBTC</span>. MSTRX is a tokenized
            wrapper around a US-listed equity (Strategy, formerly MicroStrategy) issued by Backed
            Finance. Anyone holding MSTRX has already completed Backed's KYC.
          </p>
          <p>
            Twine itself does no KYC - it's a smart contract. But the pool inherits the wrapper's
            gating: you can only acquire MSTRX through Backed's issuer flow. If you don't already
            hold MSTRX through Backed, you cannot meaningfully interact with this pool.
          </p>
          <p>
            While NYSE is closed the hook drops its asymmetric mechanic and reverts to flat fees.
            LPs bear overnight and weekend gap risk. Twine is pre-launch, unaudited, and provides
            no investment advice.
          </p>
        </div>
        <div className="border-t border-line px-6 py-4 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:justify-end">
          <a
            href="https://backed.fi"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted hover:text-white transition-colors"
          >
            About Backed ↗
          </a>
          <button
            type="button"
            onClick={acknowledge}
            className="inline-flex items-center justify-center border border-line px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white hover:bg-white/5 transition-colors"
          >
            I understand
          </button>
        </div>
      </div>
    </div>
  );
}
