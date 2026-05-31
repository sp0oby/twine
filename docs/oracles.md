# Twine Oracle Stack

**Status:** v1 reference. Read alongside [`PROJECT_SPEC.md`](../PROJECT_SPEC.md) §6.

This document is the operational reference for anyone integrating, auditing, or extending Twine's oracle layer - Chainlink, Pyth, RedStone teams; auditors reviewing the v1 hook; future maintainers. The implementation lives in [`src/oracle/`](../src/oracle/) and exposes two interfaces in [`src/interfaces/`](../src/interfaces/).

---

## Why the oracle layer matters

Twine's hook prices every swap as a function of the pool's drift from an oracle-derived fair price. The oracle layer is therefore directly load-bearing: a bad price is not a degraded UX, it is a bad fee.

Three classes of failure must be impossible:

1. **Stale prices used as fresh.** Either revert or fail over.
2. **A single feed's bad print quietly mispricing the pool.** Cross-check against a second source when one is wired.
3. **Equity-market-closed periods treated like normal trading.** The asymmetric fee mechanic is paused on close.

The v1 design handles each of these explicitly; the rest of this document is how.

---

## The two interfaces

Everything the hook reads goes through one of two minimal interfaces.

### `IPriceOracle`

```solidity
interface IPriceOracle {
    function getPrice() external view returns (uint256 priceWad);
}
```

A 1e18-normalized price. Adapters MUST revert on stale or invalid data - the hook does not introspect prices.

### `IMarketHoursOracle`

```solidity
interface IMarketHoursOracle {
    function isMarketOpen() external view returns (bool);
}
```

A boolean: true when the equity market backing the relevant leg is currently open. When false, the hook drops the asymmetric fee mechanic and reverts to flat fees in both directions (§6.2).

These two interfaces are the entire contract between Twine and the oracle world. Anything that satisfies them is plug-and-play.

---

## Implementations shipped in v1

### `ChainlinkOracleAdapter`

Wraps a single Chainlink aggregator.

| Property | Behavior |
|---|---|
| Decimals | Read once at construction; rejects feeds with > 18 decimals. Up-scales `answer` to 1e18 on read. |
| Heartbeat | Immutable, set per feed at deploy. |
| Staleness | Reverts `StalePrice(updatedAt, maxStaleness)` if `block.timestamp − updatedAt > heartbeat × 2`. The 2× factor is the spec's chosen tolerance (§6.1) - wide enough to ride out brief feeder outages, tight enough that a multi-hour stall is caught. |
| Invalid price | Reverts `InvalidPrice(answer)` if `answer ≤ 0`. Catches incomplete rounds too (an `updatedAt == 0` round registers as maximally stale). |
| Mutability | Feed, heartbeat, and decimals are all `immutable`. Changing any of them means deploying a new adapter and re-pointing the hook via governance. |

One adapter instance per feed. For Base mainnet the v1 launch wires `ChainlinkOracleAdapter` for the cbBTC leg; for the MSTRX leg it sits behind `DualOracleAdapter` (next).

### `DualOracleAdapter`

Wraps a primary + backup `IPriceOracle` and enforces a deviation cap.

Designed for the equity leg (§6.1/§6.3): Chainlink MSTRX as primary, Pyth (behind an `IPriceOracle` adapter) as backup. The adapter is wrapper-agnostic - anything that satisfies `IPriceOracle` plugs in.

Behavior:

- **Both fresh, within cap → return primary.** The deviation check is `(hi − lo) × BPS > lo × maxDeviationBps` against the configured `maxDeviationBps` (default 200 bps).
- **Primary stale, backup fresh → return backup.** Silent failover (no event - `getPrice` is `view`). Off-chain monitoring observes failover by reading the two sources directly.
- **Backup stale, primary fresh → return primary alone.** No deviation check possible; the primary is trusted.
- **Both stale → revert `BothStale()`.** No fallback fiction.
- **Deviation exceeds cap → revert `PriceDeviation(p, b)`.** Requires governance intervention to either re-tune or repoint a source. This is the right default: silently picking one of two disagreeing sources is worse than briefly halting swaps.

### `MultisigMarketHours`

The production `IMarketHoursOracle` for the v1 launch.

- A single `bool open` plus a `lastUpdate` timestamp.
- `setOpen(bool)` is `onlyOwner`, where the owner is a multisig (Safe, typically).
- Emits `MarketStatusUpdated(open, at)` on every write so off-chain monitoring can prove freshness and detect drift.

Why a multisig oracle in v1? Because no Chainlink (or equivalent) market-status feed exists on Base Sepolia today. The §6.1 fallback is exactly this: a multisig flips the flag on the weekly NYSE open/close cadence plus US market holidays. The flip is observable on-chain via the event, and the `lastUpdate` field lets monitors alert on stale flags.

The interface is plug-compatible. The day a Chainlink market-status feed ships on Base, swapping `MultisigMarketHours` for a `ChainlinkMarketHoursAdapter` is a one-line governance call (`updatePoolConfig`).

---

## How the hook consumes oracle data

`TwineHook` reads oracle data in two places - `beforeSwap` (pricing) and `beforeAddLiquidity` (the in-band check). The flow:

1. **Market-closed gate first.** If the pool's `IMarketHoursOracle.isMarketOpen()` returns `false`, the hook returns the flat base fee without reading any price oracle. Crucially the equity feed *is expected to be stale* over the close, so this branch must not require it.
2. **Otherwise read both price oracles.** Each `IPriceOracle.getPrice()` reverts on stale or invalid data - and that revert bubbles up to the swap caller. There is no fallback price.
3. **Compute drift and classify the swap.** `SpreadMath` derives the signed drift in bps; if out of band, the hook computes the asymmetric fee and returns it as the dynamic LP fee override.

The flat-fee branch is intentionally permissive on staleness because the spec says so: a closed market should not block swaps, just suspend the convergence promise.

---

## Failure-mode reference

This table is the operational source of truth. It is reproduced in §6.3 of the spec; if the two ever diverge, the spec wins.

| Condition | Hook behavior |
|---|---|
| Both feeds stale | Revert all swaps until recovery |
| Primary stale, backup fresh | Use backup (silent failover) |
| Feeds disagree by > 2% (configurable) | Revert swaps; requires governance intervention |
| Market closed (equity leg) | Flat fees; normal swap allowed; no rebalance promise |
| Structural break flag set | Flat fees + vault drawdown; requires governance to exit |

Every row is unit- or integration-tested. See `test/unit/ChainlinkOracleAdapter.t.sol`, `test/unit/DualOracleAdapter.t.sol`, `test/unit/MultisigMarketHours.t.sol`, and `test/integration/TwineHook.t.sol`.

---

## What's deferred to v2

- **`PythOracleAdapter`.** Pyth push-pattern wrapper sitting behind `IPriceOracle`, intended as the MSTRX backup. Not built in v1 because the launch pair on Base Sepolia uses a mocked equity leg.
- **Chainlink market-status feed adapter.** Drop-in `IMarketHoursOracle` once an on-chain NYSE-status feed is available on the target chain. Same governance call (`updatePoolConfig`) swaps it in.
- **Underlying-pool TWAP cross-check.** Spec §6.1 references a secondary deviation check against the issuer's underlying tokenized-equity pool. Wired as a `DualOracleAdapter` backup once a credible TWAP source exists.

---

## For oracle teams reading this

Twine is a small, well-scoped integration. If you're shipping a feed that fits one of the slots above, two things move the conversation:

1. **A working `IPriceOracle` (or `IMarketHoursOracle`) wrapper around your feed.** Anything that satisfies the interface above plugs in without contract changes.
2. **Feed metadata** - addresses, heartbeats, decimals, push cadence, expected uptime, and a contact for the team that maintains it.

The right entry point is [GitHub Discussions on the repo](https://github.com/sp0oby/twine/discussions). The codebase is small enough that we can plumb a new adapter through in a single PR.
