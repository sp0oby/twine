import type {Metadata, Viewport} from "next";
import "./globals.css";

import {Providers} from "@/components/Providers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twine.market";

// One sentence, written like a human would tell you what this is. Reused across OG/Twitter so
// link previews on Slack, X, Telegram, etc. say the same thing the splash page says.
const DESCRIPTION =
  "A Uniswap v4 hook that prices every swap against an oracle, so a pool can trade the spread between two related assets instead of just exchanging them. Launch pair is tokenized Strategy stock against Bitcoin.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Twine - A market for the spread",
    template: "%s - Twine",
  },
  description: DESCRIPTION,
  // Deliberately short - five terms that actually describe the thing. Stuffing keyword lists
  // makes Google rank you lower these days, not higher.
  keywords: ["Uniswap v4 hook", "pair trade", "tokenized equity", "Base", "MSTR cbBTC"],
  authors: [{name: "Brandon McCall"}],
  creator: "Brandon McCall",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Twine",
    title: "Twine - A market for the spread",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Twine - A market for the spread",
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
  alternates: {canonical: SITE_URL},
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
