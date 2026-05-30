import type {Metadata, Viewport} from "next";
import "./globals.css";

import {Providers} from "@/components/Providers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twine.market";
const DESCRIPTION =
  "Twine is a Uniswap v4 hook for trading the spread between two correlated assets. Pair-trade MSTRX against cbBTC in a single swap, on Base.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Twine — A market for the spread",
    template: "%s — Twine",
  },
  description: DESCRIPTION,
  keywords: [
    "Uniswap v4",
    "v4 hook",
    "DeFi",
    "RWA",
    "tokenized equity",
    "pair trade",
    "MSTR",
    "Bitcoin",
    "Base",
    "AMM",
    "Ethereum",
    "Strategy",
  ],
  authors: [{name: "Brandon McCall"}],
  creator: "Brandon McCall",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Twine",
    title: "Twine — A market for the spread",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Twine — A market for the spread",
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="bg-bg text-ink font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
