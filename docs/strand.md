# STRAND — The Twine Protocol Token

**Status:** v1 reference. Read alongside [`PROJECT_SPEC.md`](../PROJECT_SPEC.md) §7 (tokenomics) and §7.4 (governance).

STRAND is the only token Twine issues. It does one thing: underwrite per-pool structural-break risk, and earn a share of pool swap fees for doing so. Everything else — vault staking, governance voting, buyback-and-burn — flows from that.

This doc covers the testnet state today, what the mainnet contract needs to look like, and the presale that has to happen before either is real.

---

## What STRAND is for

Three functions, in order of how load-bearing they are:

1. **Underwriting capital.** A pool's per-pool `TwineUnderwritingVault` only matters if STRAND is staked in it. On a structural break (drift past the hard threshold), the hook seizes a fraction of staked STRAND and uses it to push the pool back toward fair. Stakers take the haircut pro-rata.
2. **Fee yield.** In exchange for that risk, each pool's vault accrues a configurable share of swap fees (default 20% per `FeeConfig`). With v0.17's in-hook auto-realization, that yield streams in on every trade — no LP or keeper interaction needed.
3. **Governance.** v2: proposal threshold 1% of supply, 5% quorum, 2-day vote + 2-day timelock. v1 governance is multisig; the handoff path is built (`TwineGovernor.setHookGovernor`).

There's no "STRAND for trading fees" or "STRAND for LP rewards" — LPs and traders interact in the underlying pair tokens. STRAND is for risk-bearers only.

---

## Supply

100,000,000 fixed cap. No inflation after the initial mint. `STRAND.mint` reverts with `CapExceeded()` past 100M, even from the owner.

The current `src/STRAND.sol` is a minimal `Ownable` ERC-20 with a `burn(amount)` and `mint(to, amount)` gated by `onlyOwner`. The cap is enforced inside `mint`. This contract is what would ship to mainnet — see "Mainnet contract" below for the few additions worth considering before launch.

---

## Distribution (spec §7.2)

| Allocation | % | Vesting |
|---|---|---|
| Underwriting vault bootstrapping | 35% | Linear over 24 months, released as pools cross TVL milestones |
| Team & contributors | 20% | 4-year vest, 1-year cliff |
| Treasury / future development | 25% | Locked, governance-released |
| Initial liquidity & market making | 10% | Unlocked at launch |
| Airdrop to early v4 hook ecosystem participants | 5% | Unlocked at launch |
| Public sale / community round | 5% | Unlocked at launch |

The 35% vault-bootstrap allocation is the largest line and the most important: it's what seeds the underwriting vaults so they're not empty on day one. Without it, the first pool launches with the structural-break drawdown depending entirely on whoever shows up to stake — fragile.

---

## Value accrual (spec §7.3)

- **Per-pool fee share** — each vault accrues `vaultBps` of its pool's gross swap fees as token0/token1 rewards. Default 20%, governance-tunable per pool.
- **Buyback and burn** — `buybackBps` (default 10%) of pool fees flow to a buyback sink address. A treasury or keeper periodically market-buys STRAND and burns it. The buyback itself is an off-chain action; the on-chain contract just routes fees to the sink.
- **No emissions.** Stakers earn from pool fees in the underlying tokens, not from STRAND inflation. Once the cap mints out, total supply only decreases (via burn).

The auto-realization landed in v0.17 means stakers' rewards tick up on every swap, not just when an LP touches the position manager. That makes the staking yield observable in real time on the dashboard.

---

## Governance (spec §7.4)

v1: multisig-owned `TwineGovernor` contract forwards all hook admin calls. STRAND is the voting token *for v2*; v1 doesn't read it.

v2 spec:
- 1 STRAND = 1 vote
- Proposals require 1% of supply to submit (1,000,000 STRAND)
- Quorum: 5% (5,000,000 STRAND)
- Two-day voting period, two-day timelock before execution
- Emergency pause is multisig-controlled (founders + community-elected guardians) for first 12 months, then transitions to fully on-chain

The handoff from multisig to v2 governance is built two ways: `transferOwnership` on `TwineGovernor` (the v2 contract becomes the new owner), or `setHookGovernor` on the hook (repoint the role entirely). Either preserves all pool config without redeploying the hook.

---

## Current state

### Testnet — live on Base Sepolia

| | |
|---|---|
| STRAND contract | [`0x3669C787077db8a7F9B10B21b32D5900Dbae0faE`](https://sepolia.basescan.org/address/0x3669C787077db8a7F9B10B21b32D5900Dbae0faE) |
| Owner | Deployer EOA (testnet only — iteration mode) |
| Faucet | [`0xa085bfc2A2d2368F5614303d70928288fe5E1358`](https://sepolia.basescan.org/address/0xa085bfc2A2d2368F5614303d70928288fe5E1358) |
| Faucet drop | 10,000 STRAND per address, 60s cooldown |
| Faucet pre-funded | 10,000,000 STRAND (1000 drops worth) |

The faucet (`src/testnet/TestnetStrandFaucet.sol`) is a pre-funded contract with a public `claim()`. The dashboard's mint panel calls it for STRAND so any user can stake without needing privileged access. The faucet contract is testnet-only and never deployed on mainnet.

> **Testnet ownership note.** On testnet the deployer EOA owns STRAND so we can iterate quickly (redeploy, refund the faucet, etc) without Safe friction every time. This is *not* the mainnet posture — see "Mainnet contract" and "Mainnet launch checklist" below.

To refill the faucet, the deployer calls `STRAND.mint(faucet, amount)` (or, on mainnet, the multisig does it).

### Mainnet — not deployed

Pre-mainnet checklist for STRAND specifically:

- [ ] Audit STRAND.sol alongside the rest of the hook
- [ ] Deploy STRAND with the multisig as initial owner
- [ ] Deploy four vesting contracts (team, treasury, vault-bootstrap, MM) — likely OpenZeppelin `VestingWallet` or similar
- [ ] Multisig mints the initial allocations: 20M team-vesting, 25M treasury-vesting, 35M vault-bootstrap-vesting, 10M MM, 5M airdrop, 5M presale
- [ ] Multisig renounces or hands off STRAND ownership to a no-op address once the initial mint is complete — the cap is then permanently locked (no further mints possible since the cap check inside `mint` would reject)
- [ ] Initial-liquidity pool deployed on a public AMM (likely Uniswap v4 STRAND/USDC or STRAND/cbBTC)

---

## Mainnet contract — what changes from v1

The current `STRAND.sol` is close to production-ready, but three additions are worth considering before mainnet:

1. **ERC-2612 (Permit).** Gasless approvals via signed messages. Standard for ERC-20s post-2021. Lets stakers / voters approve without burning gas on a separate `approve` tx. Drop-in via `ERC20Permit` from OpenZeppelin.

2. **ERC-20 Votes (for v2 governance).** Snapshot-based voting power, vote delegation, historical balance lookups. Required for any on-chain `Governor` integration. Drop-in via `ERC20Votes` from OpenZeppelin. Doesn't add user-visible behavior beyond `delegate(address)`.

3. **Renounce-after-mint pattern.** After the initial distribution, the multisig calls `renounceOwnership()`. The cap is enforced inside `mint`, but renouncing forecloses any further minting permanently. This is the cleanest commitment to "100M and never more."

These three combined: still ~80 lines of Solidity. Audit cost is marginal vs auditing v1.

---

## Presale — what has to happen before mainnet

The 5% public-sale allocation isn't decorative. Without it, there's:

- **No initial liquidity for STRAND/X.** The 10% MM allocation goes to market-making, but a market needs *both sides* — counterparty STRAND has to come from somewhere, and the presale is where it comes from in the public-distribution model.
- **No working capital.** Treasury allocation is locked + governance-released. Operating expenses pre-revenue (audit, infra, legal) need actual ETH/USDC. Presale supplies that.
- **No price discovery.** Without a presale, the initial liquidity pool's STRAND price is arbitrary — the team picks a number. With a presale, the clearing price is a market signal.

### Sketch (not committed — open for design)

| | |
|---|---|
| Supply offered | 5,000,000 STRAND (the §7.2 public-sale allocation) |
| Form | Single-price tranche, no Dutch auction (avoids participation games) |
| Per-wallet cap | TBD (likely $5–25k equivalent — enough for retail, low enough to broaden distribution) |
| Currency accepted | USDC + ETH on Base (matches where the protocol lives) |
| Lockup | None on tokens purchased (5% is small enough that fast circulating supply isn't a danger) |
| KYC | TBD — light KYC (Synaps / Persona) may be needed depending on jurisdiction; the protocol itself does no KYC |
| Settlement venue | Custom presale contract OR a service like Coinlist / Echo / Camelot |
| Proceeds | Split between (a) initial-liquidity pool seeding, (b) audit + bug-bounty escrow, (c) treasury working capital |

### What we won't do

- No VC round, no SAFTs, no early-investor allocation. The §7.2 distribution has no "private sale" line item; we keep it that way.
- No bonding curve, no fair launch, no liquidity mining. STRAND is a utility token for vault stakers, not a speculation vehicle.
- No team allocation outside the §7.2 20% (4-year vest, 1-year cliff). Co-founders don't get a side allocation.

### Sequence

1. Audit completes, mainnet STRAND deployed by multisig.
2. Vesting contracts deployed, allocations minted into them.
3. Presale contract deployed; 5M STRAND transferred in.
4. Presale opens for a fixed window (e.g. 7 days).
5. Presale closes; participants claim their tokens.
6. Initial liquidity pool seeded with 10M STRAND + the matching USDC/cbBTC from presale proceeds.
7. Pool goes live on a public AMM.
8. Twine pools launch.

This sequence assumes the audit is done and the contract surface is frozen. None of this should start before that.

---

## For partners reading this

Twine's tokenomics are deliberately conservative — fixed cap, no inflation, vesting on everything that's not airdrop or public sale. If you're integrating against Twine and want to understand the STRAND exposure on your end (vault staking, fee share, governance), the spec is the canonical reference; this doc is the operational view.

For presale partnership inquiries (liquidity provisioning, KYC infrastructure, listing) — open a [GitHub Discussion](https://github.com/sp0oby/twine/discussions) and we'll move it off-channel.
