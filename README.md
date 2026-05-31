# Twine

[![CI](https://github.com/sp0oby/twine/actions/workflows/ci.yml/badge.svg)](https://github.com/sp0oby/twine/actions/workflows/ci.yml)
[![Spec](https://img.shields.io/badge/spec-v0.16-1f6feb?labelColor=0d1117)](./PROJECT_SPEC.md)
[![Solidity](https://img.shields.io/badge/solidity-0.8.26-363636?labelColor=0d1117)](./foundry.toml)
[![License](https://img.shields.io/badge/license-BUSL--1.1%20%2F%20MIT-0aa?labelColor=0d1117)](#license)

**A market for the spread between two correlated assets.**

Twine is a Uniswap v4 hook that turns a pool into a continuously-rebalancing pair-trade vehicle. The pool looks like an ordinary v4 pool from the outside. You swap, add liquidity, collect fees. The hook quietly enforces a peg between the pool's internal price and an oracle-derived fair price, which makes the pool a venue for trading the *relationship* between two related assets rather than just one against the other.

The launch pair is **MSTRX / cbBTC** — tokenized Strategy stock and tokenized Bitcoin on Base. Strategy holds roughly 600,000 BTC on its balance sheet, so MSTR is in economic substance levered Bitcoin plus a financing premium and an operating-business overlay. The premium drifts. Twine is where you trade the drift.

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

MSTRX has a real underlying — a US-listed equity. NYSE closes nights and weekends, the equity oracle stops updating, and the pool can't honestly promise convergence during that window. Pretending otherwise is the kind of detail that turns a clean DeFi primitive into a regulatory mess.

The hook handles this directly. An on-chain market-hours oracle (a signed multisig oracle for v1, a Chainlink CCIP feed planned for v2) reports whether NYSE is open. When it's closed, the hook drops the asymmetric mechanic and reverts to flat, symmetric fees in both directions. The pool stays tradable. It just doesn't claim to mean-revert until the equity feed resumes.

If you integrate tokenized real-world assets into an AMM, this is the detail that matters most. The pool's behavior changes when the underlying stops trading, and that change is enforced on-chain.

## Where the protocol is

Pre-launch on testnet. The full system — hook, position manager, governor, underwriting vault, STRAND, oracle adapters, market-hours registry, swap router — is built, broadcast on Base Sepolia, and wired to a working dashboard. No mainnet deployment yet. No audit yet.

| | |
|---|---|
| Spec | [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) v0.16 |
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
| TwineHook | [`0xf45D…aAC0`](https://sepolia.basescan.org/address/0xf45D12d1a683Dae2f7F574fc093d5B836337aAC0) |
| TwinePositionManager | [`0x867d…F864`](https://sepolia.basescan.org/address/0x867d425B1bF77C01d728Ae0b72413897F90FF864) |
| TwineSwapRouter | [`0x9cc4…E3A3`](https://sepolia.basescan.org/address/0x9cc4e54D45b0AbC3A5Df1eef7704EeAb149dE3A3) |
| TwineGovernor | [`0xF438…8233`](https://sepolia.basescan.org/address/0xF43821EB2A59852448db3428316bd832843a8233) |
| TwineUnderwritingVault | [`0x23FC…10dA`](https://sepolia.basescan.org/address/0x23FCa95F88c07539169407d13C167e79641C10dA) |
| STRAND | [`0x1B7b…0522`](https://sepolia.basescan.org/address/0x1B7b2565739AF963445b97E08359CB3230D40522) |
| Mock MSTRX (token0) | [`0x5E25…Ad0d`](https://sepolia.basescan.org/address/0x5E25B3C27367d05a1e177BD6d643914b3099Ad0d) |
| Mock cbBTC (token1) | [`0xd94F…33d2`](https://sepolia.basescan.org/address/0xd94Fd3C611D8732a7315976dCfE417c1b66c33d2) |
| NyseHoursOracle | [`0xb866…19b8`](https://sepolia.basescan.org/address/0xb866bdb52543801ee5c402ccfeb803d9354419b8) |

The canonical machine-readable copy lives in [`frontend/lib/deployments/base-sepolia.json`](./frontend/lib/deployments/base-sepolia.json) and is surfaced live by the dashboard's Deployment panel.

## Architecture

```
TwineHook                beforeSwap / afterSwap, asymmetric fee, structural-break flag
TwinePositionManager     ERC-6909 LP shares, fee accumulator, vault and buyback routing
TwineUnderwritingVault   per-pool STRAND vault, drawdown bound to the hook
TwineGovernor            pool authorization, parameter updates, fee config
TwineSwapRouter          minimal IUnlockCallback wrapper for EOA swaps with slippage
oracle/                  Chainlink adapter, dual-oracle adapter, multisig market hours
STRAND                   protocol token, staked into per-pool vaults
```

Every external entry point has NatSpec and a test file in `test/integration/` (round-trip behavior against a real v4 PoolManager) or `test/unit/` (math primitives).

## For partners

Twine is a focused piece of infrastructure: a hook, a vault, a router, a token. It does one thing — make on-chain a pair-trade market that doesn't otherwise exist — and we want production-grade rails underneath it. A few specific asks, in order of how much they'd move things forward:

- **Tokenized-equity issuers (Backed, Ondo, Dinari).** v1 needs a production-grade MSTRX with predictable mint/burn semantics. v2 expands to COINx, MARAx, GLXYx, HOODx, CRCLx. The hook is wrapper-agnostic by design — it sees an ERC-20 with an oracle — and we'd like to coordinate on integration, redemption mechanics, and co-marketing where it makes sense. Twine never issues its own equity; we route flow to yours.
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
