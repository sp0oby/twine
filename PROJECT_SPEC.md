# Twine Protocol - Specification

**Version** v0.17 · **Last updated** May 2026 · **Status** locked for v1 build

This is the canonical specification for Twine. When the code and the spec disagree, the spec wins until it is explicitly updated.

A short README lives at [`README.md`](./README.md) for first-time readers; this document is the full reference and should be read by anyone implementing, auditing, or integrating against the protocol.

---

## 1. What Twine is

Twine is a Uniswap v4 hook framework that turns a pool into a **continuously-rebalancing pair-trade vehicle** between two correlated assets - most importantly a tokenized equity and its crypto twin (the launch pair is MSTRX/cbBTC).

From the outside, a Twine pool is an ordinary v4 pool: swap, mint LP, collect fees. Inside, every callback runs through a hook that reads oracle prices, computes the pool's drift from a fair price, and prices the swap as a function of how the trade affects that drift. Swaps that pull the pool back to fair are discounted below the base fee; swaps that push it away are surcharged. The result is a venue for **trading the relationship between two assets**, not just exchanging one for the other.

That market does not exist on-chain today. Twine builds it.

---

## 2. Scope

### 2.1 In scope for v1 (this build)

- A single Uniswap v4 hook contract serving multiple Twine pools
- **MSTRX / cbBTC** as the launch pair - the flagship pair-trade market
- Market-hours-aware rebalance logic (equity oracles pause on weekends; the hook must handle this from day one)
- Tokenized equity integration with a single issuer (likely xStocks or Ondo)
- STRAND token with per-pool underwriting vaults
- LP position tracking via ERC-6909 (v4-native)
- Chainlink oracle adapter with stale-price guards, plus equity-hours detection
- Governance module for pool authorization and parameter updates
- Foundry test suite with unit, fuzz, and invariant tests
- Testnet deployment (Base Sepolia), then mainnet (Base or Unichain)
- Minimal frontend showing pool state, live z-score, and rebalance history

### 2.2 Deferred to v2

- Second pool: **COINx / ETH**
- Additional pairs: MARAx/cbBTC, GLXYx/ETH, HOODx/basket
- Multi-issuer support (start with one, integrate others later)
- Multi-pool aggregation and cross-pool routing
- Insurance fund tranching / waterfall design
- veSTRAND-style time-locked governance
- Cross-chain deployment

### 2.3 Explicitly out of scope, forever

- Twine does not issue tokenized equities. We integrate with existing issuers.
- Twine does not custody assets directly. All custody is via v4's `PoolManager` and standard vault contracts.
- Twine does not provide investment advice. The protocol is infrastructure.

### 2.4 Regulatory posture for v1

Because v1 includes a tokenized equity (MSTRX), the protocol inherits the regulatory profile of the wrapper:

- **MSTRX is a security** under Backed's structure. Anyone holding it has gone through Backed's KYC.
- The Twine pool itself does no KYC - it's a smart contract. But you can only acquire MSTRX through the issuer's gated mint flow.
- **Practical consequence**: anyone who can already hold MSTRX can use the Twine pool. The pool inherits the wrapper's gating rather than imposing its own.
- We disclose this clearly in the frontend, and the contracts contain no claims about regulatory status or investor eligibility.

---

## 3. Core Mechanics

### 3.1 The price-peg invariant

Twine pools are **full-range only** (§3.3), and Uniswap v4 - like v3 - is a concentrated-liquidity AMM: a pool stores `sqrtPriceX96` and `liquidity`, **not** `reserve0`/`reserve1`. There is no independent dollar-value ratio to "balance." For a full-range pool the split of value between the two tokens is a deterministic function of the current pool price, so the invariant Twine actually enforces is a **peg between the pool's internal price and an oracle-derived fair price.**

Tokens `A` and `B` map to `token0`/`token1` by v4's canonical address-sort ordering; all formulas below assume that orientation is applied consistently. Oracle prices are normalized to 1e18 fixed-point.

```
fair_price = price_A / price_B                          (from oracles)
pool_price = (sqrtPriceX96 / 2^96)^2  · 10^(dec0-dec1)  (token1 per token0)
drift      = (pool_price - fair_price) / fair_price     (signed, relative)
```

The pool is **in band** when `|drift| ≤ δ`, where δ is the drift tolerance (default 5% / 500 bps).

> A 50/50 dollar-value target and this price-peg formulation are mathematically equivalent for a full-range pool. The contract is written in price terms because (a) it matches what v4 actually stores and (b) "keep the AMM price near the oracle price" is the cleaner invariant to reason about, test, and explain. The asymmetric fee (§3.2) makes it expensive to push `pool_price` away from `fair_price` and cheap to push it toward - i.e. it incentivizes pegging the AMM to oracle truth.

### 3.2 Asymmetric fee curve

When the pool is in band: standard fee (default 30 bps) applies to swaps in both directions.

When out of band: the fee becomes **directional**. Swaps pushing the pool *toward* target get a discount; swaps pushing *away* get a premium. The premium/discount scales with the magnitude of drift.

Let `d = drift` (the signed relative price deviation defined in §3.1). Define:

```
fee_corrective    = base_fee * max(0, 1 - k * |d|)
fee_adversarial   = base_fee * (1 + k * |d|)
```

Where `k` is the steepness parameter (default 4.0, governance-tunable per pool).

A swap is "corrective" if it moves the pool toward the target, "adversarial" if it moves the pool away. The hook applies the appropriate fee in `beforeSwap`.

This creates a continuous incentive for arbitrageurs to drag the pool back to target. LPs capture the elevated fee from adversarial flow.

### 3.3 Liquidity provisioning

LPs deposit in the **target** ratio, not the current ratio. If they attempt to deposit in the current (drifted) ratio, the hook reverts in `beforeAddLiquidity`. This prevents free arbitrage against existing LPs by depositing into an imbalanced pool right before the snapback.

LP positions are tracked via ERC-6909. Each position represents a pro-rata share of pool reserves. **Twine pools are full-range only** - no concentrated liquidity. The hook's invariant logic assumes uniform liquidity across the price domain.

### 3.4 Liquidity withdrawal

LPs withdraw at the **current** pool ratio. They receive their pro-rata share of whatever assets are actually in the pool. This means LPs eat the cost of unconverged spread when they exit; the pool is never forced to rebalance for them.

### 3.5 Insurance and structural break handling

When the pool drifts beyond a hard threshold (default 15%, governance-tunable), the hook flags a **structural break event**. This:

1. Pauses the asymmetric fee logic - fees revert to flat
2. Triggers a partial drawdown from the STRAND underwriting vault for that pool
3. The vault contributes assets to nudge reserves back toward target
4. Stakers in the vault take a haircut to fund this

In exchange for taking this risk, vault stakers earn a continuous share of pool fees.

A pool only emerges from structural-break state via a governance vote that explicitly re-authorizes it.

---

## 4. Asset Pairs

### 4.1 v1 launch pair

**MSTRX / cbBTC** is the canonical Twine pair and the v1 launch.

Why it's the right launch:

- **Mechanical linkage.** Strategy (formerly MicroStrategy) holds ~600,000 BTC on its balance sheet. The company's stock is, in economic substance, levered Bitcoin plus a financing premium and an operating-business overlay. When this premium drifts from its rolling norm, that's the spread Twine is designed to capture.
- **Legibility.** The thesis fits in one sentence: "MSTR should track BTC; when it doesn't, the spread mean-reverts." That's a hugely valuable property for marketing, education, and onboarding.
- **Tokenized supply exists.** MSTRX (Backed / xStocks) and MSTRON (Ondo) are live products with non-trivial existing on-chain liquidity to bootstrap against.
- **Spread magnitude.** Historical MSTR/BTC spread is large enough (often 10%+ deviations from mean) to make pair-trade fees meaningful - unlike crypto-only pairs like WBTC/cbBTC where spreads are bps-scale.

Tokenized equity wrapper: **MSTRX from xStocks (Backed)** is the v1 target. Fallback to MSTRON if integration friction is lower.

### 4.2 v2 expansion pairs

- **COINx / ETH** - Coinbase revenue tracks crypto volume + ETH staking. Less mechanically linked than MSTR/BTC but a deep equity market with real crypto exposure.
- **MARAx / cbBTC** - Pure-play Bitcoin miner. Very high beta to BTC with hash-rate and energy-cost overlays.
- **GLXYx / ETH** - Galaxy Digital, crypto-native financial firm.

### 4.3 v3+ candidates

- **HOODx / basket** - Robinhood, crypto revenue is now material
- **CRCLx / USDC** - Circle issues USDC; the spread captures the franchise premium
- **NVDAx / AI-token-basket (TAO/FET/RNDR)** - looser linkage but huge equity liquidity

Tokenized equity wrappers always come from existing issuers: **xStocks** (Backed), **Ondo Global Markets**, **Dinari**. We never mint our own.

---

## 5. Smart Contract Architecture

### 5.1 Contracts

| Contract | Purpose |
|----------|---------|
| `TwineHook.sol` | The v4 hook. Implements `beforeInitialize`, `beforeSwap`, `afterSwap`, `beforeAddLiquidity`, `beforeRemoveLiquidity`. Uses a **dynamic LP fee** (dynamic-fee flag + `beforeSwap` fee override) - **not** `beforeSwapReturnDelta`. Single hook serves all pools, parametrized per-pool. **Auto-realizes fees** in `afterSwap` by poking `pm.realizeFromHook(key)` - no off-chain keeper needed for steady-state operation. |
| `BaseHook.sol` | Minimal vendored hook base (PoolManager-gated callbacks + permission-address validation), built on `v4-core` v4.0.0. Vendored because the pinned v4-periphery checkout omitted `BaseHook`. |
| `TwinePositionManager.sol` | ERC-6909 LP position tracker. One shared full-range position per pool; `shares == liquidity` (exact pro-rata of reserves). Per-share fee accumulator distributes pool fees pro-rata. Also the per-pool **fee router** - splits collected fees into vault rewards / buyback sink / LP share (§7.3). Exposes `realizeFromHook(key)` (gated by `msg.sender == key.hooks`) which the hook calls from `afterSwap` to realize and route fees automatically on every trade. **Non-transferable shares in v1.** |
| `LiquidityAmounts.sol` | Vendored minimal liquidity↔amount math (full-range), on solady fixed-point. |
| `TwineUnderwritingVault.sol` | Per-pool insurance vault. Holds staked STRAND, pays out on structural breaks. One vault per Twine pool. |
| `STRAND.sol` | The protocol token. Standard ERC-20 with mint controls. |
| `TwineGovernor.sol` | Pool authorization, parameter updates, emergency pause. Forwards `setHookPositionManager` so the PM can be repointed without a hook redeploy. |
| `ChainlinkOracleAdapter.sol` | Reads Chainlink feeds with staleness checks. |
| `DualOracleAdapter.sol` | Wraps a primary + backup `IPriceOracle` and enforces an inter-source deviation cap (default 2%). Silent failover when one source is stale; reverts on both-stale or deviation. Used for the equity (MSTRX) leg per §6.1/§6.3. |
| `SpreadMath.sol` | Library: ratio calculation, fee curve, z-score buffer. |
| `RebalanceKeeper.sol` | Permissionless `keep(PoolKey)` - forces a structural-break check so drawdown fires on oracle-driven drift even **without a swap**. With v0.17's in-hook auto-realization, fee realization no longer needs the keeper - its remaining job collapses to this edge case. Holds no funds, no privileges. |
| `MultisigMarketHours.sol` | Multisig-flag `IMarketHoursOracle`. Used in early deployments; superseded in v0.16 by `NyseHoursOracle` for the live Base Sepolia pool. Kept available as a fallback for cases where the on-chain calendar isn't suitable (e.g. a hypothetical 24/7 commodity equity). |
| `NyseHoursOracle.sol` | Pure-Solidity `IMarketHoursOracle` that computes NYSE regular hours (9:30 AM - 4:00 PM ET, Mon-Fri minus holidays) directly on-chain. No off-chain feed, no LINK, no keeper. Hardcoded NYSE 2026 + 2027 holidays + DST transitions through 2030; governance can extend both. |
| `script/Deploy.s.sol` + `script/CreatePool.s.sol` | Forge deploy scripts: HookMiner-mined hook address, multisig-owned STRAND/PM/Governor, per-pool vault + authorize + initialize + wiring. Verified by `test/integration/Deploy.t.sol`. |

### 5.2 Hook callback flow

```
initialize → beforeInitialize:
  1. Revert unless the pool was pre-authorized by governance (config exists for poolId)
  2. (Dynamic-fee requirement is guaranteed by authorizePool + poolId binding the fee)

swap → beforeSwap:
  1. Revert if globally paused
  2. If structural-break state OR equity market closed → flat base fee
     (oracles are intentionally NOT required in this branch - the equity feed
      is expected to be stale while the market is closed)
  3. Otherwise: read oracle prices for both legs (revert if stale/invalid),
     read the pool's sqrtPriceX96, compute fair price and pool price, derive drift
  4. If |drift| ≤ tolerance (in band) → flat base fee
  5. Else classify the swap corrective/adversarial from its direction vs. drift sign,
     and compute the asymmetric fee (SpreadMath)
  6. Return the fee as a dynamic LP-fee override (bps × 100 → pips, with the override flag)

swap → afterSwap:
  1. Skip while market closed or in structural break (don't pollute the baseline)
  2. Otherwise recompute drift from the POST-swap pool price
  3. If |drift| ≥ hard threshold → set structural-break state, emit StructuralBreakTriggered
     (vault drawdown wiring is Phase 5)
  4. Emit SwapProcessed for indexers

addLiquidity → beforeAddLiquidity:
  1. Revert if paused or pool unconfigured
  2. Revert if the equity market is closed (LP can't price the leg)
  3. Revert unless the pool is in band - full-range LPs necessarily deposit at the
     current price, so deposits are only allowed when that price is at fair (anti-grief, §3.3)
  (Full-range-only enforcement on the tick range is deferred to Phase 4 / position manager.)

removeLiquidity → beforeRemoveLiquidity:
  1. No special logic. LP takes pro-rata share of current reserves, even out of band (§3.4).
```

### 5.3 Key invariants (for invariant testing)

- A pool can never reach a state where vault drawdown is impossible while it is also in structural-break state.
- Total LP claims must never exceed actual pool reserves.
- Asymmetric fee can never exceed `MAX_FEE_CAP` (default 100 bps).
- Oracle staleness check must always succeed before any fee calculation.
- A swap can never increase pool drift if the pool was already beyond the structural-break threshold (because flat fees + adversarial flow would worsen the break - this needs to be modeled).

---

## 6. Oracle Strategy

### 6.1 v1 oracle stack

Because v1 ships with a tokenized equity (MSTRX) as one leg, the oracle stack must handle equity market hours from day one. This is materially harder than a crypto-only launch and is treated as a first-class requirement, not an afterthought.

- **Chainlink** as primary feed for cbBTC. Heartbeat-based staleness check: revert if last update > 2x heartbeat.
- **Chainlink + Pyth dual feed** for MSTRX. Chainlink for the canonical price during market hours, Pyth as a faster-updating cross-reference for deviation checking.
- **Equity market-hours detector**: an on-chain function (or oracle-reported flag) that returns whether NYSE is currently open. During closure, the hook enters a degraded mode (see 6.3).
- **Deviation check**: secondary check via the underlying tokenized-equity pool's TWAP if the primary feed deviates by > 2%.

### 6.2 Market-hours handling

When NYSE is closed:

- The asymmetric fee logic is **disabled** - fees revert to flat across both directions.
- The pool continues to allow swaps, but the protocol explicitly does not promise convergence behavior during these windows.
- A "market closed" flag is exposed in pool state for frontends to display prominently.
- At market open, the hook resumes normal operation and the next swap recomputes ratio from current oracle prices.

This means LPs are effectively exposed to overnight and weekend gap risk. This is disclosed prominently in the LP onboarding flow. It is also a primary reason for the underwriting vault.

### 6.3 Failure modes

| Condition | Hook behavior |
|-----------|---------------|
| Both feeds stale | Revert all swaps until recovery |
| Primary stale, backup fresh | Use backup, emit warning event |
| Feeds disagree by > 2% | Revert swaps, require governance intervention |
| Market closed (equity leg) | Flat fees, normal swap allowed, no rebalance promise |
| Pool flagged structural break | Flat fees + vault drawdown, requires governance to exit |

---

## 7. STRAND Tokenomics

### 7.1 Supply

- **Fixed cap**: 100,000,000 STRAND
- **No inflation after initial distribution**

### 7.2 Distribution

| Allocation | % | Vesting |
|-----------|---|---------|
| Underwriting vault bootstrapping | 35% | Linear over 24 months, released to vaults as pools cross TVL milestones |
| Team & contributors | 20% | 4-year vest, 1-year cliff |
| Treasury / future development | 25% | Locked, governance-released |
| Initial liquidity & market making | 10% | Unlocked at launch |
| Airdrop to early v4 hook ecosystem participants | 5% | Unlocked at launch |
| Public sale / community round | 5% | Unlocked at launch |

### 7.3 Value accrual

- **Fee share**: each vault accrues a fixed % of its pool's swap fees (default 20%, governance-tunable)
- **Buyback and burn**: a separate % (default 10%) of every pool's fees is used to market-buy STRAND and burn it
- **No emissions to LPs or swappers** - they earn from native pool fees in the underlying tokens

### 7.4 Governance

- One STRAND = one vote
- Proposals require 1% of supply to submit
- Quorum: 5%
- Two-day voting period, two-day timelock before execution
- Emergency pause is multisig-controlled (founders + community-elected guardians) for first 12 months, then transitions to fully on-chain

---

## 8. Off-Chain Infrastructure

### 8.1 Required

- **Indexer**: tracks every swap, computes live ratio, rolling z-score, historical spread distribution per pool
- **Keeper**: monitors pools for rebalance triggers, calls `RebalanceKeeper` permissionlessly when conditions met
- **Frontend**: surfaces spread metrics - not just prices. Required views:
  - Per-pool dashboard with live ratio, z-score, recent rebalances
  - LP page showing current position value, fees earned, structural-break risk
  - Vault staking page with risk indicators per pool
  - Governance page (proposals, voting)

### 8.2 Nice-to-have

- Telegram/Discord bot for rebalance alerts
- API for external strategies / aggregators

---

## 9. Security Model

### 9.1 Threat surface

- **Oracle manipulation**: an attacker who can influence the oracle can extract value via asymmetric fee. Mitigated by deviation checks, staleness checks, and multi-source aggregation.
- **Sandwich on rebalance**: attackers may attempt to front-run vault rebalance transactions. Mitigated by routing rebalances through commit-reveal or private mempool.
- **LP grief**: an attacker deposits, waits for adverse drift, withdraws at unfavorable ratio. Mitigated by the requirement that deposits use target ratio (prevents free arb) and exit is at current ratio (no protocol obligation to rebalance for them).
- **Vault insolvency**: a structural break larger than the vault can cover. Pool enters degraded state, requires governance intervention. Documented and disclosed prominently.

### 9.2 Audit & disclosure

- Internal review before testnet
- External audit before mainnet (target: one Tier-1 firm or two Tier-2)
- Bug bounty live on mainnet day one
- Postmortems for any production incident, published within 7 days

---

## 10. Open Questions

These are real unknowns the build must resolve. They are not stylistic preferences.

1. **Steepness parameter `k`**: how aggressive should the asymmetric fee be? Too low → arbs don't bother → pool drifts. Too high → LPs get sandwiched by every micro-drift. Requires backtesting against historical MSTR/BTC spread data.
2. **Drawdown waterfall**: when a vault drains, do stakers all take pro-rata haircuts, or is there a tranching mechanism (junior/senior)?
3. ~~**ERC-6909 vs custom NFT** for positions~~ - **Resolved (v0.4):** ERC-6909 fungible shares (`shares == liquidity`, one shared full-range position per pool). Non-transferable in v1 to keep the fee accumulator exact.
4. **Wrapper choice**: MSTRX (Backed) or MSTRON (Ondo). Decide based on integration friction, liquidity depth, and which issuer is open to partnership / co-marketing.
5. **Market-hours source**: who tells the hook NYSE is open? Chainlink has an equities market-hours feed, but availability and cost on Base/Unichain need verification. Fallback: a permissioned bot writes the flag with a multisig backstop.
6. **Weekend liquidity**: do we tolerate the pool going somewhat stale on weekends, or build a "frozen weekend" mode that blocks swaps entirely? The latter is safer for LPs, worse for traders.
7. **Issuer partnership**: do we ship before having a formal partnership with Backed/Ondo, or wait? Pro: faster launch. Con: risk of being asked to delist if they object.

---

## 11. Versioning

This spec uses semantic versioning. Material changes (new mechanics, asset class changes, tokenomics adjustments) bump the major version. Clarifications bump the minor.

Current: **v0.17** (auto-realization in afterSwap + NyseHoursOracle live)

### Changelog

- **v0.17** (2026-05-31) - **Automatic fee realization in `afterSwap`** kills the keeper-as-default dependency. New `TwinePositionManager.realizeFromHook(PoolKey)` (gated by `msg.sender == address(key.hooks)`) skips the unlock wrapper and runs the same `modifyLiquidity(0) → take → route` path `collectFees` does; `TwineHook._afterSwap` calls it on every swap when the PM is wired. Result: vault rewards and the buyback sink update on every trade, no off-chain anything required for steady state. `RebalanceKeeper.keep` still covers the oracle-moved-without-a-swap edge case but is no longer load-bearing. Also: replaced the live `MultisigMarketHours` with `NyseHoursOracle` - pure on-chain NYSE calendar (9:30-16:00 ET Mon-Fri minus hardcoded holidays + DST transitions through 2030, governance-extensible), so weekend behavior is now an honest "deposits paused, withdrawals open, swaps at flat fee" instead of a multisig flag. Redeployed the full system on Base Sepolia: hook `0xf45D…aAC0`, pm `0x867d…F864`, gov `0xF438…8233`, vault `0x23FC…10dA`, strand `0x1B7b…0522`, router `0x9cc4…E3A3`, NYSE oracle `0xb866…19b8` - all four new-bytecode contracts verified on BaseScan; multisig owns governance/strand/pm/oracle. 190 tests pass (3 new for auto-realization).
- **v0.16** (2026-05-30) - **Twine is live on Base Sepolia.** `script/DeployTestnet.s.sol` ran end-to-end against the real Base Sepolia v4 `PoolManager` (`0x05E73…3408`) and deployed every contract - 17 onchain txs, ~0.06 mETH (~$0.15) total. HookMiner produced an address whose low 14 bits exactly encode the required permission bitmask (`0x2AC0`), and the PoolManager accepted it on `initialize`, proving the CREATE2 mining math holds in production. Deployed addresses are written to `frontend/lib/deployments/base-sepolia.json` and surfaced by `/app`'s `DeploymentPanel`. Trade/Provide/Stake panel writes (`useWriteContract`) are the next wiring step.
- **v0.15** (2026-05-29) - Added `test/integration/Lifecycle.t.sol`: a single linear test that walks the entire Twine system through every mechanic in realistic sequence (deploy + governance + stakers + LPs + in-band/out-of-band swaps + fee routing + reward claims + concentrated-add rejection + stale-oracle revert + market-closed suppression + keeper-forced break/drawdown + cooldown unstake + governance resolves + out-of-band LP burn + governance handoff + final invariants). Catches state-combination bugs the focused tests don't reach. 16 phases, 2.1M gas, passes first try; full suite: 174 tests, 0 high slither.
- **v0.14** (2026-05-29) - `/app` is now an interface, not a tape: a `Trade / Provide liquidity / Stake STRAND` tab strip below the pool card with real form panels (swap direction flip, deposit/withdraw modes, stake/unstake/claim modes). Buttons are disabled with honest pre-launch copy ("Pre-launch - execution unavailable" when connected, "Connect wallet" otherwise) so users *see* where they will act once contracts are deployed - without faking values. `next.config.mjs` aliases two optional wagmi peer deps (`@react-native-async-storage/async-storage`, `pino-pretty`) to `false` so the build resolves cleanly. Verified live: `GET /` and `GET /app` both 200, `Ready in 4.3s`.
- **v0.13** (2026-05-29) - Wallet connect on the frontend: `wagmi` + `viem` + RainbowKit, themed to match the editorial dark layout (custom mono "Connect" button on the header instead of the default RainbowKit blue pill; chains: Base + Base Sepolia). `/app` shows an honest `WalletStatus` panel: address + network when connected, "Wallet not connected" pointer to the header otherwise - no fake protocol values. Added `indexer/` - a Ponder scaffold tracking `TwineHook.SwapProcessed` / `StructuralBreak*`, `TwinePositionManager.Mint`/`Burn`/`FeesRouted`, and `TwineUnderwritingVault.Staked`/`Unstaked`/`Drawdown`. Schema is re-org-safe (`txHash-logIndex` ids); addresses are env-driven and default to zero pre-launch. ABIs cover only the events handlers consume; switch to forge artifacts once contracts are deployed.
- **v0.12** (2026-05-29) - Started the frontend (`frontend/`): Next.js 14 App Router + Tailwind 3.4 + Inter/JetBrains Mono, editorial dark layout (black canvas, off-white text). `/` is the splash - explains the mechanic, the MSTRX/cbBTC flagship pair, the market-hours behavior, an honest status panel, and the §2.4 disclosure. `/app` is the dashboard skeleton with a single `MSTRX/cbBTC` pool card showing `-` for every value (no fake TVL or made-up metrics - wiring to live data follows a deployment + indexer). No `shadcn/ui`, no animation libraries, no analytics - type and spacing carry the page. Build is clean (`npm run build`); both routes render.
- **v0.11** (2026-05-29) - Added a public `TwineHook.checkStructuralBreak(PoolKey)` (silent no-op when not configured / paused / already broken / market closed; reverts on stale oracle; otherwise flags the break and fires drawdown). Built `src/RebalanceKeeper.sol` - a permissionless `keep(PoolKey)` that calls `checkStructuralBreak` *and* pokes `pm.collectFees` so vault rewards and the buyback sink stay fresh between LP interactions. Built `src/oracle/MultisigMarketHours.sol` - the §6.1 production `IMarketHoursOracle` (Ownable flag with `lastUpdate`). Refactored the `afterSwap` break-flagging into a shared internal helper used by both paths. v1 deliberately does **not** ship an on-chain BuybackKeeper - buyback-and-burn is an inherently off-chain keeper job, and an on-chain stub would be the kind of "looks useful, isn't" surface to avoid.
- **v0.10** (2026-05-29) - Added `DualOracleAdapter` (primary + backup `IPriceOracle` wrapper with deviation cap, silent single-source failover, reverts on both-stale or deviation; plug-and-play for the MSTRX leg once a Pyth-side `IPriceOracle` is wired) and a **full-range tick guard** on the hook (`beforeAddLiquidity` now rejects non-full-range positions, protecting the uniform-liquidity assumption against direct PoolManager callers bypassing the position manager). This concludes the buildable-without-external-deps protocol surface.
- **v0.9** (2026-05-29) - Added the deploy infrastructure: vendored minimal `HookMiner` (mines a CREATE2 salt so the hook address encodes its permission bits), `script/Deploy.s.sol` (STRAND + hook + PM + Governor, deployed multisig-owned, governor role handed to the Governor contract), and `script/CreatePool.s.sol` (deploys a per-pool vault, authorizes, initializes, and wires drawdown + fee routing). Verified end-to-end by `test/integration/Deploy.t.sol`. With this, the protocol is code-complete for the plug-and-play goal - what remains is the external infra (real MSTRX/feed/market-hours-feed, frontend/indexer/keeper).
- **v0.8** (2026-05-29) - Implemented **fee routing** (§7.3), closing the gap where vault stakers earned nothing. The `TwinePositionManager` now acts as the per-pool fee router: when it realizes pool fees, it splits them per a governance-set `FeeConfig` - default 20% to the underwriting vault (`depositRewards`), 10% to a buyback sink, 70% to LPs - with cuts folding back to LPs when the vault has no stakers or the sink is unset (no stranded fees). Added PM `owner` + `setOwner`/`setFeeConfig`. The buyback sink receives its cut; the actual market-buy-and-burn of STRAND remains a keeper/treasury op. This makes the protocol code-complete for the staker-yield mechanic - plug-and-play once a real MSTRX leg + feeds exist.
- **v0.7** (2026-05-29) - Phase 7 testing: added a handler-driven Foundry **invariant suite** proving the §5.3 accounting invariants - LP shares are always exactly backed by the on-chain position (claims ≤ reserves), LP/vault share accounting consistency, and vault solvency - at **100k calls/invariant** (CI profile), 0 failures. Added a market-hours **transition test** (open→close→weekend-warp→reopen) confirming break detection is suppressed during closure and resumes on reopen. Notes: "fee ≤ MAX_FEE_CAP" and "staleness never bypassed" are per-call properties covered by unit fuzz / targeted tests rather than stateful invariants; dual-oracle, MSTRX, Pyth, and real market-hours-feed fork items remain deferred (not available on Base for v1).
- **v0.6** (2026-05-29) - Implemented `TwineGovernor` (Phase 6): an `Ownable` (v1 multisig) governance surface forwarding `authorizePool`/`updatePoolConfig`/`resolveStructuralBreak`/`setVault`/`pause`/`unpause` to the hook, plus `setHookGovernor` for handoff. Made the hook's `governor` **updatable** (was immutable) so control can transition from the v1 multisig to v2 on-chain governance without redeploying - via either `transferOwnership` of the governor or `setHookGovernor` on the hook. Full on-chain STRAND voting + timelock (§7.4) remains the v2 build.
- **v0.5** (2026-05-29) - Implemented `STRAND` (fixed-cap ERC-20, owner mint, burn) and `TwineUnderwritingVault` (Phase 5): per-pool insurance vault with 7-day-cooldown staking (shares-over-STRAND), a hook-only `drawdown(bps)` that socializes losses pro-rata by reducing backing, and a token0/token1 fee-reward accumulator. Wired the hook→vault: governor `setVault(key, vault, drawdownBps)`, and `afterSwap` triggers `vault.drawdown` on a structural break. Note: the mechanism that *funds* vault rewards (sweeping 20% of protocol fees, §7.3) is a keeper/governance concern, deferred. Also hardened CI gas-snapshot checks to exclude fuzz tests (fuzz gas isn't reproducible across runs).
- **v0.4** (2026-05-29) - Implemented `TwinePositionManager` (Phase 4): ERC-6909 fungible LP shares over a single shared full-range position per pool, `shares == liquidity` for exact pro-rata reserve claims, with a per-share fee accumulator so pool fees distribute pro-rata and no LP can siphon another's fees (v4 credits all of a position's pending fees on any touch). **Open Q#3 resolved: ERC-6909 fungible shares, not an NFT.** v1 shares are non-transferable (keeps fee accounting exact). Added vendored `LiquidityAmounts`.
- **v0.3** (2026-05-29) - Reconciled §5.1/§5.2 to the implemented hook: added the `beforeInitialize` permission (governance authorization gate; only pre-authorized, dynamic-fee pools may initialize), rewrote the `beforeSwap`/`afterSwap` flow in price-peg terms (read `sqrtPriceX96`, compare to oracle fair price; flat fee when closed/broken/in-band; dynamic LP-fee override), and specified `beforeAddLiquidity` as requiring in-band + market-open. Added the vendored `BaseHook.sol` to the contract table.
- **v0.2** (2026-05-28) - Rewrote §3.1 from a v2-style "dollar-value reserve ratio" to a **price-peg** invariant, matching v4's concentrated-liquidity model (`sqrtPriceX96` + `liquidity`, no `reserve0/1`). The two framings are equivalent for a full-range pool; the contract is written in price terms. Updated §3.2 to define drift accordingly. Confirmed Twine v1 uses a **dynamic LP fee** (dynamic-fee flag + `beforeSwap` fee override) and **does not** use `beforeSwapReturnDelta`; vault/buyback cuts are swept from accrued protocol fees, not skimmed in-swap.
- **v0.1** - initial draft.

> **Remaining follow-up:** §3.3's "deposit in target ratio" is implemented as an in-band guard in `beforeAddLiquidity`, but the **full-range-only tick enforcement** (rejecting concentrated ranges) is deferred to Phase 4 (position manager). §5.2 has been reconciled to the price-peg model.
