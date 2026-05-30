import {onchainTable} from "ponder";

/**
 * Indexer schema for the Twine dashboard. Each row is uniquely identified by `txHash-logIndex`
 * so re-orgs are handled idempotently.
 */

// Every swap, with the hook's classification.
export const swap = onchainTable("swap", (t) => ({
  id: t.text().primaryKey(),
  poolId: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  driftBps: t.bigint().notNull(), // signed; stored as bigint
  asymmetricActive: t.boolean().notNull(),
  structuralBreakTriggered: t.boolean().notNull(),
}));

// Each structural-break event (set + resolved).
export const structuralBreak = onchainTable("structural_break", (t) => ({
  id: t.text().primaryKey(),
  poolId: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  driftBps: t.bigint().notNull(),
  resolved: t.boolean().notNull().default(false),
}));

// LP mint/burn events through the position manager.
export const lpMovement = onchainTable("lp_movement", (t) => ({
  id: t.text().primaryKey(),
  poolId: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  account: t.hex().notNull(),
  kind: t.text().notNull(), // "mint" | "burn"
  liquidity: t.bigint().notNull(),
  amount0: t.bigint().notNull(),
  amount1: t.bigint().notNull(),
}));

// Fee routing each time the PM realizes pool fees.
export const feeRouting = onchainTable("fee_routing", (t) => ({
  id: t.text().primaryKey(),
  poolId: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  vault0: t.bigint().notNull(),
  vault1: t.bigint().notNull(),
  buyback0: t.bigint().notNull(),
  buyback1: t.bigint().notNull(),
}));

// Vault stake / unstake / drawdown.
export const vaultEvent = onchainTable("vault_event", (t) => ({
  id: t.text().primaryKey(),
  blockNumber: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  kind: t.text().notNull(), // "stake" | "unstake" | "drawdown"
  user: t.hex(),
  amount: t.bigint().notNull(),
  shares: t.bigint(),
  totalStakedAfter: t.bigint(),
}));
