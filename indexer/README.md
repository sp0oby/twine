# Twine — indexer

[Ponder](https://ponder.sh) indexer for the Twine protocol. Watches the hook, position manager,
and underwriting vault on Base; exposes a GraphQL + SQL API the dashboard reads from.

## What it tracks

| Table              | Source                              | Used by                                      |
| ------------------ | ----------------------------------- | -------------------------------------------- |
| `swap`             | `TwineHook.SwapProcessed`           | Recent swaps, drift series, 24h fee proxy    |
| `structural_break` | `TwineHook.StructuralBreak*`        | Break history, current pool state            |
| `lp_movement`      | `TwinePositionManager.Mint`/`Burn`  | Per-LP positions, TVL changes                |
| `fee_routing`      | `TwinePositionManager.FeesRouted`   | Vault accrual + buyback sink over time       |
| `vault_event`      | `TwineUnderwritingVault.*`          | Stakes, unstakes, drawdowns                  |

This is a deliberately minimal starter set — extend `abis/`, `ponder.schema.ts`, and `src/index.ts`
as the dashboard grows (e.g., LP fee claims, governance events, market-hours transitions).

## Run

```bash
cp .env.example .env.local
# fill in PONDER_RPC_URL_BASE, contract addresses, PONDER_START_BLOCK
npm install
npm run dev    # starts ponder dev — http://localhost:42069
```

The indexer is pre-launch alongside the rest of the protocol; addresses default to the zero
address until a pool is deployed.

## Notes

- Event IDs are `${tx.hash}-${log.logIndex}` so re-orgs are idempotent.
- PM events emit `id` as `uint256` (the share id == `uint256(PoolId.unwrap(poolId))`); handlers
  cast it back to a 32-byte hex string for consistency with the hook's `bytes32 PoolId`.
- ABIs in `abis/index.ts` cover only the events handlers consume. When deploying for real, switch
  to importing from `../out/*/X.json` so they stay in lockstep with the contracts automatically.
