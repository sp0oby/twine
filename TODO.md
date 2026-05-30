# Twine — Build TODO

Phased build plan. Each phase has a clear definition of done. Don't move forward without it.

The path is calibrated for a solo builder showcasing the hook for a hackathon or grant, then progressively hardening toward mainnet. Estimates are honest — slip them, don't pretend.

---

## CURRENT BUILD SCOPE (set 2026-05-28)

**The full 14-phase path to mainnet is still the goal.** We are deliberately starting narrow to de-risk the core mechanic before committing effort to the later phases.

**Active critical path: Phases 0 → 1 → 2 (minimal) → 3.** Build the math + a working hook, prove the asymmetric-fee/price-peg mechanic against oracle prices on a local + forked v4 `PoolManager`. Only after the mechanic is proven do we commit to Phases 4–13.

Decisions locked for this scope:
- **Price-peg model** (spec §3.1 v0.2): drift = pool price vs. oracle fair price, not reserve ratios.
- **Dynamic LP fee only** — no `beforeSwapReturnDelta` in the bitmask (see Phase 3).
- **Mock equity leg** — `MockERC20` MSTRX/cbBTC + mock oracle/market-hours behind the real interfaces. Don't block on Backed/Ondo to validate the mechanic.
- **Off critical path for now (still in TODO, not deleted):** Phase 4 (positions), 5 (STRAND/vault), 6 (governance), 8 (issuer outreach). Wire vault/governor as thin interface stubs only where Phase 3 needs them.
- **Open, decide at Phase 3:** weekend/market-closed behavior (spec open Q#6). Default to spec's flat-fee-swaps-allowed until then.

---

## Phase 0 — Setup & foundations (1 week)

- [ ] Install Foundry, configure `foundry.toml` with Solidity 0.8.26+
- [ ] Initialize repo with `src/`, `test/`, `script/`, `docs/` skeleton
- [ ] Add Uniswap v4-core and v4-periphery as submodules
- [ ] Add OpenZeppelin Contracts (`@openzeppelin/contracts`)
- [ ] Add Solady (for gas-sensitive utilities)
- [ ] Add Chainlink contracts (`@chainlink/contracts`)
- [ ] Set up GitHub Actions CI: `forge build`, `forge test`, `forge fmt --check`
- [ ] Add `slither` static analysis to CI
- [ ] Write `.env.example` covering all RPC URLs, deployer key paths
- [ ] Add pre-commit hook for `forge fmt` and basic lints
- [ ] Read v4 hook docs end-to-end before writing any code: https://docs.uniswap.org/contracts/v4/concepts/hooks

**Definition of done:** `forge test` runs (against an empty test) and CI is green.

---

## Phase 1 — Core math library (1 week)

Build the math primitives first. They're easier to test in isolation and they're the foundation of everything else.

- [x] `SpreadMath.sol` with (price-peg model, §3.1 v0.2):
  - [x] `fairPrice(price0_1e18, price1_1e18) → fair_1e18`
  - [x] `poolPrice(sqrtPriceX96, dec0, dec1) → pool_1e18` (uses solady `fullMulDiv`; sqrtPrice² overflows 256 bits)
  - [x] `computeDrift(pool_1e18, fair_1e18) → drift_bps` (signed: pool above fair = positive; positive branch clamped to int256 max)
  - [x] `asymmetricFee(base_fee, drift_bps, kScaled, isCorrective) → fee_bps` (kScaled = k×BPS; clamped to `MAX_FEE_CAP_BPS`)
  - [x] `isInBand(drift_bps, drift_tolerance_bps) → bool` (inclusive)
  - [x] `isStructuralBreak(drift_bps, hard_threshold_bps) → bool` (inclusive `>=`)
- [x] Unit tests for every function with:
  - [x] Boundary cases (exactly at band, exactly at threshold)
  - [x] Zero inputs + drift-clamp edge (huge pool vs tiny fair)
  - [x] Asymmetric fee monotonicity (further from target = higher adversarial fee)
- [x] Fuzz tests:
  - [x] Drift / pool-price computation never overflows (incl. extreme `sqrtPriceX96`)
  - [x] Fee never exceeds `MAX_FEE_CAP`
  - [x] Asymmetric fee is sign-symmetric (fee depends only on |drift| for a fixed direction); adversarial ≥ corrective

**Definition of done:** 100% line coverage on the library, 50k+ fuzz runs with no failures.
**✅ Met (2026-05-28):** 28 tests, 100% line/statement/branch/func coverage, all green at 50k fuzz runs.
**Note:** library works in bps; the hook converts fee bps → v4 pip units (×100) at the boundary. Fee output is clamped to `MAX_FEE_CAP_BPS` = 100 bps.

---

## Phase 2 — Oracle adapter (1-2 weeks)

Because v1 launches with a tokenized equity, the oracle stack is materially more complex than a crypto-only build. Budget accordingly.

- [x] `IPriceOracle.sol` interface (1e18-normalized, reverts on stale/invalid)
- [x] `IMarketHoursOracle.sol` interface (`isMarketOpen()`)
- [x] `ChainlinkOracleAdapter.sol`:
  - [x] Read latest answer from `AggregatorV3Interface`
  - [x] Staleness check (revert if age > `heartbeat * 2`; inclusive boundary)
  - [x] Decimal normalization (return prices in 1e18 fixed-point; rejects >18-dec feeds)
  - [x] Per-feed heartbeat configurable (immutable)
- [x] Mocks for deterministic testing: `MockChainlinkFeed`, `MockERC20`, `MockPriceOracle`, `MockMarketHours`
- [x] Unit tests with mock feeds (13 tests: normalization, staleness boundary, invalid price, ctor guards)
- [x] Fork test against the real cbBTC/USD Chainlink feed on Base (`test/fork`) — verified: 8 decimals, ~$73.8k, normalizes correctly. Runs when `BASE_RPC_URL` + `BASE_CBBTC_USD_FEED` are set, else skips.
- [ ] Document the oracle stack in `docs/oracles.md`

**Deferred past the PoC critical path (still in scope for mainnet):**
- [ ] `PythOracleAdapter.sol` — Pyth feed for MSTRX, push-based update pattern
- [x] `DualOracleAdapter.sol` — primary + backup, deviation cap, silent failover on single-source staleness, reverts on both-stale / deviation. Plug-and-play behind `IPriceOracle`. (11 unit tests; 100% coverage.)
- [x] `MultisigMarketHours.sol` — production `IMarketHoursOracle` (Ownable, `setOpen` + `lastUpdate`/event for monitoring). The §6.1 multisig-flag fallback when no on-chain NYSE feed exists on the target chain. **Holiday handling stays off-chain** (the multisig flips the flag); a Chainlink market-status-feed adapter is plug-and-play later if one ships on Base.

**Definition of done (minimal PoC):** adapter normalizes + reverts cleanly on stale/invalid data, all unit tests green. Fork verification of real prices pending an RPC.

---

## Phase 3 — The hook (3-4 weeks)

This is the hard part. Don't rush it. The market-hours logic adds real complexity over a pure crypto pair.

- [x] **Vendored `src/base/BaseHook.sol`** on `v4-core` v4.0.0 — the pinned v4-periphery checkout omitted `BaseHook` and risked a nested-core type conflict, so we vendor a minimal standard base (PoolManager-gated callbacks + permission-address validation).
- [x] `getHookPermissions()` bitmask:
  - `beforeInitialize` (governance authorization gate — **added** beyond the original list)
  - `beforeSwap`, `afterSwap`, `beforeAddLiquidity`, `beforeRemoveLiquidity`
  - **NOT** `beforeSwapReturnDelta` — dynamic LP fee via the dynamic-fee flag + `beforeSwap` fee override. (Corrected v0.2.)
- [x] Per-pool `TwineConfig` struct (oracles, market-hours, kScaled, baseFee, tolerance, hard threshold, decimals, configured, structuralBreak)
- [x] Governance: `authorizePool` / `updatePoolConfig` / `resolveStructuralBreak` / `setPaused` (immutable `governor`)
- [x] `beforeInitialize` — only governance-authorized pools may initialize (dynamic-fee guaranteed by poolId binding the fee)
- [x] `beforeSwap`: flat fee when paused-revert / closed / broken / in-band; else read sqrtPrice + oracle prices (staleness enforced), compute drift, classify corrective/adversarial, asymmetric fee via `SpreadMath`, return dynamic LP-fee override (bps×100 pips)
- [x] `afterSwap`: detect structural break from post-swap price (skip while closed/broken), emit `SwapProcessed` / `StructuralBreakTriggered`
- [x] `beforeAddLiquidity`: require configured + not paused + market open + in-band (price-peg reading of §3.3)
- [x] `beforeRemoveLiquidity`: no-op pass-through (exit allowed even out of band, §3.4)
- [x] Emergency `setPaused` (governor)
- [x] Custom errors + events for mode transitions; `SpreadMath` casts justified (no bare unchecked)
- [x] Integration tests vs. a real `PoolManager` (37 tests): asymmetric fee both directions, in-band/closed/break flat, break trigger+resolve, all revert/access paths, crypto-only (no market-hours) pool
- [x] Coverage: **TwineHook 100% line / 100% func / 96% branch** (only the deferred native-ETH `_decimals` branch uncovered); SpreadMath + ChainlinkOracleAdapter 100%

**Definition of done:** hook compiles, permission bits match implementation, every callback covered incl. market-closed behavior. ✅ Met for the PoC.

**Deferred (not blocking the PoC mechanic):**
- [ ] Market-hours *transition* edge tests (open→close mid-block, holiday handling) and **fork tests** (real cbBTC Chainlink + PoolManager on Base) → Phase 7.
- [ ] Full-range-only tick enforcement in `beforeAddLiquidity` → Phase 4 (position manager).
- [ ] Wire `afterSwap` structural break → `TwineUnderwritingVault.drawdown` → Phase 5.
- [ ] `BaseHook` coverage is partial by design: unused IHooks-completeness callbacks (donate/afterInitialize/etc.) are not exercised; the enabled callbacks + the `onlyPoolManager` guard are.

---

## Phase 4 — Position manager (1 week)

- [x] `TwinePositionManager.sol` using solady **ERC-6909** (open Q#3 resolved: 6909 fungible shares, not an NFT)
- [x] `mint(PoolKey, amount0Max, amount1Max, to) → shares` and `burn(PoolKey, shares, to) → (amount0, amount1)` (fungible per-pool shares; **shares == liquidity** = exact pro-rata of reserves)
- [x] One shared full-range position per pool (owner = PM, salt 0); LP claim is pro-rata of pool reserves. Hook's `beforeAddLiquidity` enforces `tickLower/Upper == minUsable/maxUsable(spacing)` so direct PoolManager callers can't bypass the PM with a concentrated position.
- [x] Integration with hook's `beforeAddLiquidity` (mints go through the in-band guard via the v4 unlock flow)
- [x] **Fee accumulator** — realizes pool fees into a per-share accumulator on every mint/burn/collect (poke) so no LP can siphon another's fees (the v4 "all-fees-on-touch" trap); `collectFees` + `pendingFees` view
- [x] Reentrancy guards on `mint`/`burn`/`collectFees` (solady `ReentrancyGuard`); vendored minimal `LiquidityAmounts` (100% covered)
- [x] Tests (10): two LPs deposit + drift + wei-exact withdrawal, unequal pro-rata, fees pro-rata with no JIT-steal, non-transferable, callback access guard, out-of-band mint reverts
- [x] Coverage: PM 99% line / 100% func; LiquidityAmounts 100%

**Definition of done:** Two LPs can deposit, one withdraws after a drift event, accounting is correct to the wei. ✅ Met (`test_equalLPs_driftNoSwap_withdrawIsWeiExact`).

**Deliberate v1 decisions (documented, not shortcuts):**
- LP shares are **non-transferable** in v1 — keeps the fee accumulator exact without per-transfer settlement. Transferable shares are a later enhancement.
- Full-range-only **tick enforcement** is implicit (PM always uses the full range); rejecting caller-supplied concentrated ranges isn't needed since LPs interact only via the PM.
- ERC20 legs only (fee-on-transfer / native ETH not supported in v1).
- slither: 0 high; remaining mediums are reentrancy-detector false positives (guard not modeled).

---

## Phase 5 — STRAND token + underwriting vault (2 weeks)

- [x] `STRAND.sol`:
  - [x] Fixed-cap (100M) ERC-20 with `Ownable` minting
  - [x] Burn function (no special access)
- [x] `TwineUnderwritingVault.sol`:
  - [x] One vault per Twine pool (bound to its hook + token0/token1 + a rebalancer)
  - [x] Stake / unstake with 7-day cooldown (shares-over-STRAND model; pending unstakers stay exposed to drawdown)
  - [x] `drawdown(bps)` callable only by the hook; pro-rata haircut via reducing backing (shares unchanged); never overpays
  - [x] Fee accrual: `depositRewards(amount0, amount1)` + per-share accumulator + `claim`/`pendingRewards`
  - [x] `ReentrancyGuard` on stake/unstake/claim/depositRewards/drawdown
- [x] Tests (20 + 4 hook-wiring): stake/rewards (incl. single-token + late-staker no-dilution), drawdown haircut, cooldown enforced + no-dodge, never-over-balance, all reverts; end-to-end hook→vault drawdown
- [x] Wire hook ↔ vault: `setVault(key, vault, drawdownBps)` (governor); `afterSwap` calls `vault.drawdown(drawdownBps)` on structural break

**Definition of done:** drawdown event causes correct asset movement and staker losses. ✅ Met (`test_drawdown_proRataHaircut`, `test_structuralBreak_triggersVaultDrawdown`).

**Coverage:** STRAND 100%; vault 100% line / 100% func (2 branches uncovered: a `depositRewards` zero-side already partly covered, and a defensive unreachable `InsufficientShares` in `unstake`).
**Fee routing — NOW BUILT (2026-05-29):** `TwinePositionManager` is the fee router. On every fee-realizing poke it splits collected pool fees per a governance-set per-pool `FeeConfig` (default 20% → vault `depositRewards`, 10% → buyback sink, 70% → LPs); cuts fold back to LPs if the vault has no stakers / the sink is unset, so no fees are stranded (§7.3). PM gained `owner` + `setOwner`/`setFeeConfig`. Tests: split ratio, no-staker fold-back, access/cap guards.
**Still deferred:** the buyback **sink** receives the cut, but the actual market-buy-and-burn of STRAND is a keeper/treasury op (a market action), not on-chain here. STRAND distribution/vesting schedule (§7.2) is a deployment concern.

---

## Phase 6 — Governance (1 week)

For v1, keep governance minimal. Multisig + simple voting. Full on-chain governance is a v2 problem.

- [x] Made `TwineHook.governor` **updatable** (`setGovernor`, governor-only, zero-addr guard, `GovernorUpdated` event) — required for the v1→v2 handoff; was immutable.
- [x] `TwineGovernor.sol` — `Ownable` (owner = multisig in v1, e.g. Safe 3-of-5):
  - [x] Forwards `authorizePool`, `updatePoolConfig`, `resolveStructuralBreak`, `setVault`, `pauseHook`, `unpauseHook`
  - [x] `setHookGovernor` — hands the hook's governor role to a new controller (v2 on-chain governance)
- [x] Tests (10): full governance surface through the governor, multisig-only gating, break resolve end-to-end, role handoff (old controller loses access). Coverage 100%.
- [x] **v2 migration path is built-in (two routes):** `transferOwnership` (multisig → DAO controls this contract) or `setHookGovernor` (repoint the hook entirely). No hook redeploy needed.

**Definition of done:** governor can authorize a new pool, update its config, and pause the hook, all gated behind the multisig. ✅ Met.

**Deferred to deployment (Phase 13):** the actual multisig setup — choosing signers, Safe config, recovery procedure — and the §7.4 on-chain voting params (1% proposal threshold, 5% quorum, 2-day vote + 2-day timelock) which are the v2 build, not v1.

---

## Phase 7 — Integration & invariant testing (2-3 weeks)

This is where bugs come out of the woodwork. Budget more time than you think you need. The market-hours transitions are a particular source of edge cases.

- [x] End-to-end integration tests (across the hook / PM / vault / governor suites):
  - [x] LP deposit (PM) → swaps both directions → fees accrue → LP withdraws (PM tests)
  - [x] Drift during market hours → asymmetric fee (adversarial > corrective) → flat when in band
  - [x] **Market open → close → weekend warp → reopen** transition; break detection suppressed while closed, resumes on reopen (`test_marketHoursTransition_breakSuppressedWhileClosed`)
  - [x] Structural break → vault drawdown → governance resolves (`test_structuralBreak_triggersVaultDrawdown`, `test_resolveStructuralBreak_throughGovernor`)
  - [x] Oracle stale → swaps revert (`testRevert_swap_whenOracleStale`)
  - [ ] ~~Dual oracle disagreement~~ → deferred: no dual oracle in v1 (Phase 2 follow-up)
- [x] Invariant tests (Foundry invariant suite; handler-driven, **100k calls/invariant in CI profile, 0 broken**):
  - [x] Total LP claims ≤ reserves — `invariant_pmSharesBackPosition` (PM shares exactly == on-chain position liquidity)
  - [x] LP + vault share accounting — `invariant_pmShareAccounting`, `invariant_vaultShareAccounting`
  - [x] Vault solvency (balance ≥ obligations) — `invariant_vaultSolvent`
  - [~] Fee ≤ `MAX_FEE_CAP` — covered by SpreadMath unit fuzz (clamp); not a stateful invariant (fee isn't stored state)
- [x] **End-to-end lifecycle scenario** (`test/integration/Lifecycle.t.sol`) — single scripted walk through every mechanic in realistic sequence: deploy → stakers stake → LPs deposit → in-band swaps → fee routing (vault 20% / buyback 10% / LP 70%) → stakers claim pro-rata rewards → out-of-band asymmetric → direct-PM concentrated-add rejected (NotFullRange) → stale oracle reverts → market closed (adds blocked, break suppressed) → reopen + keeper forces break + drawdown → cooldown unstake redeems post-haircut value → governance resolves break → LP burns out of band (allowed) → governance handoff → final invariants (PM shares back position, vault solvent, share accounting consistent). 16-phase linear test, 2.1M gas, every assertion holds first try.
  - [~] Oracle staleness never bypassed / market-closed ⇒ flat — covered by targeted hook tests (per-call properties, not stateful invariants)
- [x] Fork test on Base: real cbBTC/USD Chainlink read (`test/fork`); weekend simulated via time warp in the transition test
  - [ ] ~~Real MSTRX swap / Pyth / real market-hours feed~~ → deferred: MSTRX/Pyth/market-status feeds don't exist on Base for v1 (mocked)

**Definition of done:** 100k+ invariant runs with no broken invariants. ✅ Met (CI profile: 1000 runs × 100 depth = 100k calls × 4 invariants, 0 failures). Market-hours transitions tested. Fork read verified. (Dual-oracle / MSTRX-specific fork items deferred with the rest of the v1-unavailable infra.)

---

## Phase 8 — Issuer integration (1-2 weeks)

Twine's v1 depends on having access to MSTRX. This phase is mostly outreach + paperwork, but it's blocking for mainnet.

- [ ] Reach out to Backed (xStocks) — primary target for MSTRX
  - [ ] Request integration call
  - [ ] Confirm: chain (Base?), contract addresses, KYC flow
  - [ ] Discuss: co-marketing, liquidity incentives, audit cooperation
- [ ] Reach out to Ondo Finance — fallback for MSTRON
  - [ ] Same questions, in parallel
- [ ] Once partner confirmed:
  - [ ] Get production token addresses written into deployment scripts
  - [ ] Get test-token faucet access for testnet builds
  - [ ] Get formal sign-off (email is fine) that integration is acceptable to them
- [ ] Document the integration in `docs/issuer-integration.md`

**Definition of done:** at least one issuer has confirmed (informally or formally) that Twine can integrate their tokenized MSTR. Token addresses are wired into the build.

---

## Phase 9 — Frontend MVP (2-3 weeks)

The frontend is more important than usual for Twine because the product *is the spread metric*. Showing just two ticker prices defeats the whole pitch.

- [x] **Splash + app skeleton built (2026-05-29):** `frontend/` — Next.js 14 (App Router) + Tailwind 3.4 + Inter/JetBrains Mono. Editorial dark layout (black canvas, off-white text), no slop. `/` is the splash (mechanic, flagship pair, market-hours note, honest status panel, disclosures); `/app` is the dashboard skeleton with a `MSTRX/cbBTC` pool card showing `—` for every value (no fake data). `npm run build` clean, both routes render. Dashboard wiring to live data follows once a pool is deployed + an indexer is up.
- [x] Next.js + Tailwind app
- [x] Wallet connect via `wagmi` + `viem` + RainbowKit on `/app` (custom mono "Connect" button to match the splash; chains: Base + Base Sepolia; `WalletStatus` panel shows the connected address + network honestly)
- [x] Indexer scaffold (`indexer/`) — Ponder package tracking `SwapProcessed`, `StructuralBreak*`, PM `Mint`/`Burn`/`FeesRouted`, vault `Staked`/`Unstaked`/`Drawdown`. Re-org-safe IDs, env-configured contract addresses. Pre-launch: addresses default to zero.
- [x] **Interaction surfaces on `/app` (2026-05-29):** `Trade` / `Provide liquidity` / `Stake STRAND` tabs (`components/Tabs.tsx`, `components/panels/*`). Real form state (controlled inputs, direction-flip on swap, deposit/withdraw toggle, stake/unstake/claim modes). Buttons are explicitly **disabled** with honest "Pre-launch — execution unavailable" copy when a wallet is connected and "Connect wallet" when it isn't — so users see *where* they'll act once contracts are live. Stat cells stay `—` until the indexer or chain reads are wired (next milestone). `next.config.mjs` aliases wagmi's optional `@react-native-async-storage/async-storage` + `pino-pretty` peers to `false` so the dev/prod build resolves cleanly.
- [x] **Dashboard wired to deployed contracts (2026-05-30):** `hooks/usePool.ts` batches live reads (drift, fair price, vault TVL, structural-break flag, user balances/stake/rewards) every 12 s. `LiquidityPanel` / `VaultPanel` / `MintFaucet` execute real writes — ERC-20 approve → mint LP / stake STRAND / unstake / claim / collect fees / faucet — each with a `TxStatus` row that links to BaseScan. Allowance reads refetch on approval receipt so the button advances from "Approve" → next step (fixed bug where it looped). `lib/wagmi.ts` defaults `useChainId` to Base Sepolia; `NetworkBanner` prompts a one-click switch when connected to the wrong chain. Home page replaced repo-style "Status"/"Read" sections with a live on-chain strip + primary CTAs to `/app` and `/docs`; spec/build/source content moved to a dedicated `/docs` page. `DeploymentPanel` shows full addresses with BaseScan links.
- [x] **v4 swap router built (2026-05-30):** `TwineSwapRouter` (≈110 lines, single external `swap` + `unlockCallback`) lets EOAs swap with one `approve` + one `swap`. Exact-input ERC-20 only for v1; user-set slippage tolerance as `amountOutMinimum`; reverts with `InsufficientOutput(received, minimum)` if the swap would settle below it. `SwapPanel` wires approve→swap with a slippage input; `script/DeployRouter.s.sol` deploys it standalone and splices `swapRouter` into the existing `frontend/lib/deployments/<chain>.json` via `vm.writeJson` (no full-protocol redeploy needed). Tests in `test/integration/TwineSwapRouter.t.sol`: zero-for-one and one-for-zero paths, recipient receives output, slippage accept at min / revert one wei past, zero-amount revert, non-PM unlockCallback revert.
- [ ] Pool dashboard:
  - [ ] Live ratio, target, drift band — visualized as a gauge or band chart
  - [ ] Rolling z-score over 30/60/90 day windows
  - [ ] MSTR/BTC implied premium chart (what is the market saying?)
  - [ ] Recent swaps with corrective/adversarial labels
  - [ ] **Market status banner** — clearly indicates when NYSE is closed and that pool is in flat-fee mode
- [ ] LP page: deposit, withdraw, current position value, fees earned, structural-break risk indicator
- [ ] Vault staking page: stake STRAND, withdraw (with cooldown), current vault value, risk per pool
- [ ] Governance page (proposals, voting) — can be Tally.xyz embed for v1
- [ ] Connect via wagmi + RainbowKit
- [ ] Pull data from a simple indexer (ponder, subgraph, or a script writing to SQLite)
- [ ] Disclosure modal: "this pool contains a tokenized equity; you must already hold MSTRX through Backed to interact" with link to issuer

**Definition of done:** can demo every user flow including market-closure handling without touching block explorer.

---

## Phase 10 — Testnet deploy & soak (2 weeks)

- [x] **Live on Base Sepolia (2026-05-30):** deployer `0x6d60…5Bb9`; hook `0xc3D0…6ac0` (low 14 bits = `0x2AC0` = exact permission bitmask); PM `0xb851…66a2`; Governor `0x5957…2387`; Vault `0x9eDa…7FFC`; STRAND `0x4CAD…20e3`; Token0 `0xA6b3…737e` (Mock MSTRX); Token1 `0xc622…0ff2` (Mock cbBTC); Oracles `0x76c4…7200` / `0x940f…cE02`; MarketHours `0xBf57…C2b3`; PoolId `0xf156…9f07`. Verified onchain: PoolManager accepted the hook on `initialize`, governance authorized + wired the vault + fee routing, all in 17 txs at ~0.06 mETH total.
- [x] **Deploy infrastructure built (2026-05-29):** vendored minimal `HookMiner` (CREATE2 salt → permission-encoded address), `script/Deploy.s.sol` (STRAND + hook + PM + Governor, hands hook governance to the Governor), `script/CreatePool.s.sol` (per-pool: vault + authorize + initialize + setVault + setFeeConfig). Verified by `test/integration/Deploy.t.sol` (HookMiner round-trip + full wiring).
- [ ] Deploy to Base Sepolia (run `Deploy.s.sol` once env is set)
- [ ] Create the v1 pool with mock MSTRX/cbBTC (or issuer-provided testnet tokens)
- [ ] Seed with modest testnet liquidity ($1-5k USD equivalent or faucet equivalents)
- [ ] Run through at least one full equity market cycle (Mon-Sun-Mon):
  - [ ] Hook correctly enters flat-fee mode on Friday close
  - [ ] Hook resumes normal mode on Monday open
  - [ ] No unexpected state across the closure window
- [ ] Triage and fix any issues found
- [ ] Run for 14+ days, monitor:
  - [ ] No unexpected reverts
  - [ ] Asymmetric fees trigger when expected during market hours
  - [ ] Vault accrues fees as expected
  - [ ] Indexer keeps up with chain across market-hours transitions

**Definition of done:** 14 consecutive days of clean operation on testnet spanning at least one full weekend.

---

## Phase 11 — Audit + bug bounty prep (6-10 weeks if external)

- [ ] Internal review pass (re-read every contract line by line)
- [ ] External audit:
  - [ ] Apply for Code4rena / Sherlock contest, or
  - [ ] Engage a Tier-2 audit firm if budget allows, or
  - [ ] Apply for Uniswap Foundation audit grant
- [ ] Set up Immunefi bug bounty (start with modest payout, scale up post-mainnet)
- [ ] Address all audit findings — critical and high are blocking, medium are case-by-case
- [ ] Second-pass review after fixes

**Definition of done:** Zero unresolved critical/high findings.

---

## Phase 12 — Hackathon / grant submission (parallel to phase 10-11)

- [ ] Identify the right hackathon — Uniswap Foundation grants, Atrium hackathons, EthGlobal events
- [ ] Demo video (3 min max):
  - [ ] What problem Twine solves
  - [ ] Live walkthrough of MSTRX/cbBTC swap during market hours
  - [ ] Walkthrough of market-closure flat-fee mode
  - [ ] Why it's novel (first AMM-native equity/crypto spread market)
- [ ] One-pager / pitch deck
- [ ] Clean repo with README pinned
- [ ] Live testnet pool with public faucet so judges can interact

**Definition of done:** submitted, with all materials linked from a single project page.

---

## Phase 13 — Mainnet launch (after audit)

- [ ] Final deploy script reviewed by at least one other set of eyes
- [ ] Issuer integration confirmed in writing (even informal email is fine)
- [ ] Deploy contracts on Base mainnet
- [ ] Verify all contracts on Basescan
- [ ] Multisig setup live with all signers verified
- [ ] Seed v1 MSTRX/cbBTC pool with conservative TVL
  - [ ] Start with $1-5k of your own (target ratio, both legs)
  - [ ] Scale up only if it's behaving across at least one full week including weekend
- [ ] Bug bounty live before any external comms
- [ ] Public announcement post: blog + Twitter
- [ ] Monitoring dashboards live with alerting working
- [ ] Disclosure prominently displayed: tokenized equity inherits securities classification from the issuer

**Definition of done:** mainnet pool exists, has had at least one external swap during US market hours and at least one across the market-close transition, no incidents in first 72h.

---

## Phase 14 — Second pool (v2 begins)

Once MSTRX/cbBTC has been live for ~3 months with clean operation, expand to the second pair.

- [ ] Decide on second pool — leading candidate: **COINx / ETH**
- [ ] Source the tokenized COIN wrapper (likely the same issuer as MSTRX for relationship efficiency)
- [ ] Re-tune steepness `k` for the new pair (COIN/ETH spread is wider and noisier than MSTR/BTC)
- [ ] Repeat phases 7, 8, 10, 11 for the new pool
- [ ] Launch with separate underwriting vault and STRAND staking — risk-segregated from MSTRX/cbBTC

**Definition of done:** second Twine pool live on mainnet, accruing fees.

---

## Things to deliberately defer

These have been raised and pushed back. Don't get distracted.

- [ ] ~~Concentrated liquidity for Twine pools~~ — incompatible with the invariant model, full-range only
- [ ] ~~Multi-asset Twine pools (>2 legs)~~ — interesting, not v1 or v2
- [ ] ~~Cross-chain Twine~~ — wait until v3 or until a clean cross-chain primitive exists
- [ ] ~~Twine as a launch venue for new tokenized equities~~ — we are infrastructure, not issuer
- [ ] ~~Native ETH pair support beyond WETH~~ — v4 supports it, just not a priority

---

## Open questions to resolve before starting

Don't write code until these have a tentative answer (you can change your mind later).

- [ ] Foundry or Hardhat? **Recommendation: Foundry only.**
- [ ] MSTRX (Backed) or MSTRON (Ondo) as the equity wrapper? **Pursue both in parallel, commit to whichever responds first / has cleaner integration.**
- [ ] ERC-6909 or custom NFT for positions? **Recommendation: ERC-6909 for the future-proofing.**
- [ ] Market-hours data source? **Investigate Chainlink market-status feed on Base; fall back to multisig flag if unavailable.**
- [ ] Self-deploy or audit-first? **Testnet → soak → audit → mainnet. No exceptions.**
- [ ] Solo through phase 11 or recruit help? **Recommendation: solo through phase 7, then consider a security collaborator before audit.**

---

Last reviewed: [date]
Next review: after phase 1 completion
