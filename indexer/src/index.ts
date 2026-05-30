import {ponder} from "ponder:registry";
import {swap, structuralBreak, lpMovement, feeRouting, vaultEvent} from "ponder:schema";

/**
 * Event handlers for Twine. Each handler is idempotent on (tx hash, log index) so re-orgs
 * are safe. Drift is stored as a signed bigint in the same bps units the hook emits.
 */

function eventId(event: {transaction: {hash: string}; log: {logIndex: number}}) {
  return `${event.transaction.hash}-${event.log.logIndex}`;
}

ponder.on("TwineHook:SwapProcessed", async ({event, context}) => {
  await context.db.insert(swap).values({
    id: eventId(event),
    poolId: event.args.id,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    driftBps: event.args.driftBps,
    asymmetricActive: event.args.asymmetricActive,
    structuralBreakTriggered: event.args.structuralBreakTriggered,
  });
});

ponder.on("TwineHook:StructuralBreakTriggered", async ({event, context}) => {
  await context.db.insert(structuralBreak).values({
    id: eventId(event),
    poolId: event.args.id,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    driftBps: event.args.driftBps,
    resolved: false,
  });
});

ponder.on("TwineHook:StructuralBreakResolved", async ({event, context}) => {
  // Mark the most recent unresolved break for this pool as resolved.
  // (Logged as a separate row keyed by tx so re-orgs are idempotent.)
  await context.db.insert(structuralBreak).values({
    id: eventId(event),
    poolId: event.args.id,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    driftBps: 0n,
    resolved: true,
  });
});

ponder.on("TwinePositionManager:Mint", async ({event, context}) => {
  await context.db.insert(lpMovement).values({
    id: eventId(event),
    // PM emits the share id (uint256 of the poolId bytes32) — cast back to hex for consistency
    poolId: `0x${event.args.id.toString(16).padStart(64, "0")}` as `0x${string}`,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    account: event.args.to,
    kind: "mint",
    liquidity: event.args.liquidity,
    amount0: event.args.amount0,
    amount1: event.args.amount1,
  });
});

ponder.on("TwinePositionManager:Burn", async ({event, context}) => {
  await context.db.insert(lpMovement).values({
    id: eventId(event),
    poolId: `0x${event.args.id.toString(16).padStart(64, "0")}` as `0x${string}`,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    account: event.args.from,
    kind: "burn",
    liquidity: event.args.liquidity,
    amount0: event.args.amount0,
    amount1: event.args.amount1,
  });
});

ponder.on("TwinePositionManager:FeesRouted", async ({event, context}) => {
  await context.db.insert(feeRouting).values({
    id: eventId(event),
    poolId: `0x${event.args.id.toString(16).padStart(64, "0")}` as `0x${string}`,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    vault0: event.args.vault0,
    vault1: event.args.vault1,
    buyback0: event.args.buyback0,
    buyback1: event.args.buyback1,
  });
});

ponder.on("TwineUnderwritingVault:Staked", async ({event, context}) => {
  await context.db.insert(vaultEvent).values({
    id: eventId(event),
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    kind: "stake",
    user: event.args.user,
    amount: event.args.amount,
    shares: event.args.shares,
    totalStakedAfter: null,
  });
});

ponder.on("TwineUnderwritingVault:Unstaked", async ({event, context}) => {
  await context.db.insert(vaultEvent).values({
    id: eventId(event),
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    kind: "unstake",
    user: event.args.user,
    amount: event.args.amount,
    shares: event.args.shares,
    totalStakedAfter: null,
  });
});

ponder.on("TwineUnderwritingVault:Drawdown", async ({event, context}) => {
  await context.db.insert(vaultEvent).values({
    id: eventId(event),
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    kind: "drawdown",
    user: null,
    amount: event.args.seized,
    shares: null,
    totalStakedAfter: event.args.totalStakedAfter,
  });
});
