import type {Metadata} from "next";

// Governance page is a client component (live multisig owner read), so we attach metadata
// here via a wrapping layout - the only way the App Router exposes <title>/<meta> for a
// 'use client' route.
export const metadata: Metadata = {
  title: "Governance",
  description:
    "Who controls Twine today, what they can and can't do, and how STRAND-holder voting takes over once the protocol clears its audit.",
};

export default function GovernanceLayout({children}: {children: React.ReactNode}) {
  return children;
}
