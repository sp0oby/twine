import {Header} from "@/components/Header";
import {Footer} from "@/components/Footer";
import {WalletStatus} from "@/components/WalletStatus";
import {DeploymentPanel} from "@/components/DeploymentPanel";
import {NetworkBanner} from "@/components/NetworkBanner";
import {PoolCard} from "@/components/PoolCard";
import {MintFaucet} from "@/components/MintFaucet";
import {Tabs} from "@/components/Tabs";
import {SwapPanel} from "@/components/panels/SwapPanel";
import {LiquidityPanel} from "@/components/panels/LiquidityPanel";
import {VaultPanel} from "@/components/panels/VaultPanel";

export default function AppPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <article className="mx-auto max-w-2xl px-6 pt-24">
        <h1 className="text-[32px] font-medium tracking-[-0.02em] leading-tight">
          MSTRX / cbBTC
        </h1>
        <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.22em] text-muted">
          Pre-launch · Base Sepolia testnet
        </p>

        <NetworkBanner />

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

        <WalletStatus />

        <DeploymentPanel />
      </article>
      <Footer />
    </main>
  );
}

