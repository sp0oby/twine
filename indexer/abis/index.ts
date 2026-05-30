/**
 * Minimal Twine event ABIs for the indexer.
 *
 * Only the events we actually consume are listed — extend per `src/index.ts` as the dashboard
 * grows. Sourced from the Solidity contracts in `../../src/`; keep these in sync when contract
 * events change (or wire ponder to read from `../../out/*.json` once the contracts are deployed).
 */

export const twineHookAbi = [
  {
    type: "event",
    name: "SwapProcessed",
    inputs: [
      {indexed: true, name: "id", type: "bytes32"},
      {indexed: false, name: "driftBps", type: "int256"},
      {indexed: false, name: "asymmetricActive", type: "bool"},
      {indexed: false, name: "structuralBreakTriggered", type: "bool"},
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "StructuralBreakTriggered",
    inputs: [
      {indexed: true, name: "id", type: "bytes32"},
      {indexed: false, name: "driftBps", type: "int256"},
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "StructuralBreakResolved",
    inputs: [{indexed: true, name: "id", type: "bytes32"}],
    anonymous: false,
  },
] as const;

export const twinePositionManagerAbi = [
  {
    type: "event",
    name: "Mint",
    inputs: [
      {indexed: true, name: "id", type: "uint256"},
      {indexed: true, name: "to", type: "address"},
      {indexed: false, name: "liquidity", type: "uint128"},
      {indexed: false, name: "amount0", type: "uint256"},
      {indexed: false, name: "amount1", type: "uint256"},
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Burn",
    inputs: [
      {indexed: true, name: "id", type: "uint256"},
      {indexed: true, name: "from", type: "address"},
      {indexed: false, name: "liquidity", type: "uint128"},
      {indexed: false, name: "amount0", type: "uint256"},
      {indexed: false, name: "amount1", type: "uint256"},
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FeesRouted",
    inputs: [
      {indexed: true, name: "id", type: "uint256"},
      {indexed: false, name: "vault0", type: "uint256"},
      {indexed: false, name: "vault1", type: "uint256"},
      {indexed: false, name: "buyback0", type: "uint256"},
      {indexed: false, name: "buyback1", type: "uint256"},
    ],
    anonymous: false,
  },
] as const;

export const twineUnderwritingVaultAbi = [
  {
    type: "event",
    name: "Staked",
    inputs: [
      {indexed: true, name: "user", type: "address"},
      {indexed: false, name: "amount", type: "uint256"},
      {indexed: false, name: "shares", type: "uint256"},
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Unstaked",
    inputs: [
      {indexed: true, name: "user", type: "address"},
      {indexed: false, name: "shares", type: "uint256"},
      {indexed: false, name: "amount", type: "uint256"},
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Drawdown",
    inputs: [
      {indexed: false, name: "seized", type: "uint256"},
      {indexed: false, name: "totalStakedAfter", type: "uint256"},
    ],
    anonymous: false,
  },
] as const;
