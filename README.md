# Twine

[![CI](https://github.com/sp0oby/twine/actions/workflows/ci.yml/badge.svg)](https://github.com/sp0oby/twine/actions/workflows/ci.yml)
[![Spec](https://img.shields.io/badge/spec-v0.17-1f6feb?labelColor=0d1117)](./PROJECT_SPEC.md)
[![Solidity](https://img.shields.io/badge/solidity-0.8.26-363636?labelColor=0d1117)](./foundry.toml)
[![License](https://img.shields.io/badge/license-BUSL--1.1%20%2F%20MIT-0aa?labelColor=0d1117)](#license)

**A market for the spread between two correlated assets.**

Twine is a Uniswap v4 hook that turns a pool into a continuously-rebalancing pair-trade vehicle. The pool looks like an ordinary v4 pool from the outside. You swap, add liquidity, collect fees. The hook quietly enforces a peg between the pool's internal price and an oracle-derived fair price, which makes the pool a venue for trading the *relationship* between two related assets rather than just one against the other.

The launch pair is **MSTRX / cbBTC** - tokenized Strategy stock and tokenized Bitcoin on Base. Strategy holds roughly 600,000 BTC on its balance sheet, so MSTR is in economic substance levered Bitcoin plus a financing premium and an operating-business overlay. The premium drifts. Twine is where you trade the drift.

## The trade

If you wanted to express "the MSTR premium is too wide" on-chain today, you'd need a perp short on the equity side, spot on the crypto side, two collateral accounts, ongoing funding, and counterparty risk in two venues. Or you'd manage two concentrated-liquidity positions and rebalance them by hand every time the underlying moves.

Twine collapses all of that into a swap. You buy or sell the spread. The liquidity providers on the other side of your trade collect the fee. When the spread mean-reverts, LPs win; if it doesn't, the underwriting vault funds the rebalance back to fair.

## The mechanic

Each Twine pool is a full-range v4 pool with a dynamic LP fee. The hook runs at every callback.

In one paragraph: every swap routes through `beforeSwap`. The hook reads two oracle prices, computes the pool's drift from fair, and returns an asymmetric fee. Swaps that pull the pool back toward fair get a discount; swaps that push it further away pay a premium. The discount draws arbitrageurs in. The premium prices out adversarial flow. Mean-reversion stops being something a keeper has to do and becomes something the market does to itself.

A few things make this work without anyone actively managing the pool:

- Drift is computed on-chain, from primitive math against a Chainlink (or compatible) price feed. No off-chain solver, no transaction queue, no trusted operator.
- The fee scales with drift, not time. A pool sitting at fair earns the base fee. A pool 800 bps out of band might charge four times that to push it further out and a quarter to pull it back. The further the drift, the steeper the asymmetry.
- Liquidity providers stay passive. There's no concentrated-range maintenance. A full-range v4 mint is the whole UX.

## When correlations break

Correlations break. A balance sheet gets restated, an issuer halts redemptions, the link that looked fundamental turns out to be circumstantial.

Twine handles this with a per-pool underwriting vault, capitalized by STRAND stakers. The vault sits behind the LP layer. If the oracle and the pool disagree by more than a hard threshold (default 15 percent) and the pool's recent drawdown crosses a second threshold, the hook flips a `structuralBreak` flag, pauses asymmetric fees, blocks new deposits, and draws from the vault to rebalance the pool back to fair. STRAND stakers earn a configurable share of pool fees (default 20 percent) in return for underwriting this risk, and a seven-day cooldown keeps them in place during a break.

LPs are insulated from the haircut; their tokens stay where they are, and withdrawals remain open the entire time.

The vault doesn't make breaks impossible. It makes them survivable.

## Market hours

MSTRX has a real underlying - a US-listed equity. NYSE closes nights and weekends, the equity oracle stops updating, and the pool can't honestly promise convergence during that window. Pretending otherwise is the kind of detail that turns a clean DeFi primitive into a regulatory mess.

The hook handles this directly. An on-chain market-hours oracle (a signed multisig oracle for v1, a Chainlink CCIP feed planned for v2) reports whether NYSE is open. When it's closed, the hook drops the asymmetric mechanic and reverts to flat, symmetric fees in both directions. The pool stays tradable. It just doesn't claim to mean-revert until the equity feed resumes.

If you integrate tokenized real-world assets into an AMM, this is the detail that matters most. The pool's behavior changes when the underlying stops trading, and that change is enforced on-chain.

## Where the protocol is

Pre-launch on testnet. The full system - hook, position manager, governor, underwriting vault, STRAND, oracle adapters, market-hours registry, swap router - is built, broadcast on Base Sepolia, and wired to a working dashboard. No mainnet deployment yet. No audit yet.

| | |
|---|---|
| Spec | [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) v0.17 |
| Source | Solidity 0.8.26, Foundry, BUSL-1.1 hook, MIT elsewhere |
| Tests | 181 passing &middot; 100k invariant calls clean &middot; [CI](https://github.com/sp0oby/twine/actions/workflows/ci.yml) |
| Testnet | Base Sepolia, chain id 84532 |
| Mainnet | Not deployed |
| Audit | Not done; bug bounty pending audit |
| Dashboard | Next.js 14, wagmi/viem, wired against the deployed contracts |

### Live on Base Sepolia

The flagship MSTRX/cbBTC pool is live against mocked equity feeds. Every address links to BaseScan.

| Contract | Address |
|---|---|
| TwineHook | [`0xC5E3…eaC0`](https://sepolia.basescan.org/address/0xC5E3357238255445692feFB489F99863bf6EeaC0) |
| TwinePositionManager | [`0xdf0F…0Fd0`](https://sepolia.basescan.org/address/0xdf0F7aA4f31aF3088bA558EEd6dd612c47e90Fd0) |
| TwineSwapRouter | [`0xDbD1…Cf92`](https://sepolia.basescan.org/address/0xDbD19EA0328dB437BdcCac799b198203a42FCf92) |
| TwineGovernor | [`0x4537…3Cc0`](https://sepolia.basescan.org/address/0x45377adccdC8102b7938f82E98CdBdF046dC3Cc0) |
| TwineUnderwritingVault | [`0x27AA…12Ac`](https://sepolia.basescan.org/address/0x27AA677242639c008d03CD061E40D9e137b912Ac) |
| STRAND | [`0x3669…0faE`](https://sepolia.basescan.org/address/0x3669C787077db8a7F9B10B21b32D5900Dbae0faE) |
| TestnetStrandFaucet | [`0xa085…1358`](https://sepolia.basescan.org/address/0xa085bfc2A2d2368F5614303d70928288fe5E1358) |
| Mock MSTRX (token0) | [`0xB975…c9A6`](https://sepolia.basescan.org/address/0xB975a9637B95F7E7c49C3A1AdEe64997fd8bc9A6) |
| Mock cbBTC (token1) | [`0xE7AE…443F`](https://sepolia.basescan.org/address/0xE7AE1E125D5f0C03143ff37D4F7455E4372D443F) |
| NyseHoursOracle | [`0x196e…8cc3`](https://sepolia.basescan.org/address/0x196e0d919ac5655a3bbc8bb45ea2b4276dd88cc3) |

The canonical machine-readable copy lives in [`frontend/lib/deployments/base-sepolia.json`](./frontend/lib/deployments/base-sepolia.json) and is surfaced live by the dashboard's Deployment panel.

## Architecture

```
TwineHook                beforeSwap / afterSwap, asymmetric fee, structural-break flag,
                         auto-realizes fees on every swap
TwinePositionManager     ERC-6909 LP shares, fee accumulator, vault and buyback routing
TwineUnderwritingVault   per-pool STRAND vault, drawdown bound to the hook
TwineGovernor            pool authorization, parameter updates, fee config
TwineSwapRouter          minimal IUnlockCallback wrapper for EOA swaps with slippage
oracle/                  Chainlink adapter, dual-oracle adapter, NyseHoursOracle (on-chain
                         NYSE calendar - no off-chain feed)
STRAND                   protocol token, staked into per-pool vaults
```

Every external entry point has NatSpec and a test file in `test/integration/` (round-trip behavior against a real v4 PoolManager) or `test/unit/` (math primitives).

## Docs

- [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) - canonical specification (v0.17)
- [`docs/strand.md`](./docs/strand.md) - STRAND tokenomics, mainnet contract requirements, presale design
- [`docs/oracles.md`](./docs/oracles.md) - oracle stack reference (Chainlink, dual-oracle, NYSE hours)
- [`TODO.md`](./TODO.md) - phased build plan
- [`SECURITY.md`](./SECURITY.md) - disclosure policy
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) - dev setup + style

## For partners

Twine is a focused piece of infrastructure: a hook, a vault, a router, a token. It does one thing - make on-chain a pair-trade market that doesn't otherwise exist - and we want production-grade rails underneath it. A few specific asks, in order of how much they'd move things forward:

- **Tokenized-equity issuers (Backed, Ondo, Dinari).** v1 needs a production-grade MSTRX with predictable mint/burn semantics. v2 expands to COINx, MARAx, GLXYx, HOODx, CRCLx. The hook is wrapper-agnostic by design - it sees an ERC-20 with an oracle - and we'd like to coordinate on integration, redemption mechanics, and co-marketing where it makes sense. Twine never issues its own equity; we route flow to yours.
- **Oracle providers (Chainlink, Pyth, RedStone).** v1 already ships a `ChainlinkOracleAdapter` and a `DualOracleAdapter` with deviation caps and silent failover. The hard problem is an **equity-hours-aware feed** that behaves correctly on weekends, holidays, and trading halts. If you have or are building this primitive, we want to be a launch integration.
- **Auditors.** The on-chain surface is small for a v4-hook audit: seven contracts, ~1,500 lines of Solidity, 181 tests including a 100k-call invariant suite. The asymmetric-fee math (`SpreadMath.sol`), the structural-break logic, and the vault drawdown path are where we want a Tier-1 set of eyes before mainnet.
- **Liquidity bootstrap partners and market makers.** Pair-trade markets only work when both legs are deep enough that the corrective discount actually pulls flow in. If you backstop mean-reversion strategies or run inventory on tokenized equities, the asymmetric-fee mechanic should look familiar.

If you're working at the intersection of tokenized real-world assets and on-chain market structure, the dashboard and spec are the fastest read. The repo's [Discussions tab](https://github.com/sp0oby/twine/discussions) and [Issues tab](https://github.com/sp0oby/twine/issues) are open; for anything private, open a discussion and we'll move it off-channel.

## Running locally

Prerequisites: [Foundry](https://book.getfoundry.sh/), Node 20+, and a Base RPC URL.

```bash
git clone https://github.com/sp0oby/twine.git
cd twine
forge install
forge build
forge test
```

The frontend lives in `frontend/`:

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

The splash and docs render at `/` and `/docs`, the dashboard at `/app`. With a wallet on Base Sepolia, the dashboard reads the deployed pool in real time and lets you mint test tokens, swap through `TwineSwapRouter`, provide liquidity, and stake STRAND.

## License

`src/TwineHook.sol` is Business Source License 1.1 with a two-year conversion to MIT, matching the Uniswap v4 model. Everything else is MIT.

## Acknowledgements

Uniswap Labs for v4 and the hooks framework. The `awesome-uniswap-hooks` curators for keeping prior art legible. Backed, Ondo, and Dinari for building the tokenized-equity rails this depends on.
