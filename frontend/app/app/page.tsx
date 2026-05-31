import type {Metadata} from "next";

import {Header} from "@/components/Header";
import {Footer} from "@/components/Footer";
import {WalletStatus} from "@/components/WalletStatus";
import {NetworkBanner} from "@/components/NetworkBanner";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Live view of the MSTRX/cbBTC pool on Base Sepolia: drift band, NYSE-hours state, recent swaps, rolling z-score, and the trade/LP/stake panels.",
};
import {PoolCard} from "@/components/PoolCard";
import {MintFaucet} from "@/components/MintFaucet";
import {Tabs} from "@/components/Tabs";
import {SwapPanel} from "@/components/panels/SwapPanel";
import {LiquidityPanel} from "@/components/panels/LiquidityPanel";
import {VaultPanel} from "@/components/panels/VaultPanel";
import {MarketStatusBanner} from "@/components/MarketStatusBanner";
import {DisclosureModal} from "@/components/DisclosureModal";
import {RecentSwapsPanel} from "@/components/RecentSwapsPanel";
import {ZScoreChart} from "@/components/ZScoreChart";

export default function AppPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <DisclosureModal />
      <article className="mx-auto max-w-2xl px-6 pt-24">
        <h1 className="text-[32px] font-medium tracking-[-0.02em] leading-tight">
          MSTRX / cbBTC
        </h1>
        <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.22em] text-muted">
          Pre-launch · Base Sepolia testnet
        </p>

        <NetworkBanner />
        <MarketStatusBanner />

        <PoolCard />

        <MintFaucet />

        <section className="mt-20">
          <Tabs
            tabs={[
              {id: "trade", label: "Trade"},
              {id: "provide", label: "Provide liquidity"},
              {id: "stake", label: "Stake STRAND"},
            ]}
            panels={{
              trade: <SwapPanel />,
              provide: <LiquidityPanel />,
              stake: <VaultPanel />,
            }}
          />
        </section>

        <ZScoreChart />
        <RecentSwapsPanel />

        <WalletStatus />
      </article>
      <Footer />
    </main>
  );
}

