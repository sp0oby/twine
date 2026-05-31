/**
 * Minimal Twine ABIs as `as const` arrays so wagmi's type inference works end-to-end.
 * Only the functions the frontend uses — extend per feature as the dashboard grows.
 */

export const hookAbi = [
  {
    type: "function",
    name: "currentDrift",
    stateMutability: "view",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          {name: "currency0", type: "address"},
          {name: "currency1", type: "address"},
          {name: "fee", type: "uint24"},
          {name: "tickSpacing", type: "int24"},
          {name: "hooks", type: "address"},
        ],
      },
    ],
    outputs: [{name: "", type: "int256"}],
  },
  {
    type: "function",
    name: "poolConfig",
    stateMutability: "view",
    inputs: [{name: "id", type: "bytes32"}],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          {name: "oracle0", type: "address"},
          {name: "oracle1", type: "address"},
          {name: "marketHours", type: "address"},
          {name: "vault", type: "address"},
          {name: "kScaled", type: "uint32"},
          {name: "baseFeeBps", type: "uint16"},
          {name: "toleranceBps", type: "uint16"},
          {name: "hardThresholdBps", type: "uint16"},
          {name: "drawdownBps", type: "uint16"},
          {name: "decimals0", type: "uint8"},
          {name: "decimals1", type: "uint8"},
          {name: "configured", type: "bool"},
          {name: "structuralBreak", type: "bool"},
        ],
      },
    ],
  },
] as const;

export const pmAbi = [
  {
    type: "function",
    name: "totalShares",
    stateMutability: "view",
    inputs: [{name: "id", type: "uint256"}],
    outputs: [{name: "", type: "uint256"}],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      {name: "owner", type: "address"},
      {name: "id", type: "uint256"},
    ],
    outputs: [{name: "", type: "uint256"}],
  },
  {
    type: "function",
    name: "pendingFees",
    stateMutability: "view",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          {name: "currency0", type: "address"},
          {name: "currency1", type: "address"},
          {name: "fee", type: "uint24"},
          {name: "tickSpacing", type: "int24"},
          {name: "hooks", type: "address"},
        ],
      },
      {name: "account", type: "address"},
    ],
    outputs: [
      {name: "fee0", type: "uint256"},
      {name: "fee1", type: "uint256"},
    ],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          {name: "currency0", type: "address"},
          {name: "currency1", type: "address"},
          {name: "fee", type: "uint24"},
          {name: "tickSpacing", type: "int24"},
          {name: "hooks", type: "address"},
        ],
      },
      {name: "amount0Max", type: "uint256"},
      {name: "amount1Max", type: "uint256"},
      {name: "to", type: "address"},
    ],
    outputs: [{name: "shares", type: "uint128"}],
  },
  {
    type: "function",
    name: "burn",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          {name: "currency0", type: "address"},
          {name: "currency1", type: "address"},
          {name: "fee", type: "uint24"},
          {name: "tickSpacing", type: "int24"},
          {name: "hooks", type: "address"},
        ],
      },
      {name: "shares", type: "uint128"},
      {name: "to", type: "address"},
    ],
    outputs: [
      {name: "amount0", type: "uint256"},
      {name: "amount1", type: "uint256"},
    ],
  },
  {
    type: "function",
    name: "collectFees",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          {name: "currency0", type: "address"},
          {name: "currency1", type: "address"},
          {name: "fee", type: "uint24"},
          {name: "tickSpacing", type: "int24"},
          {name: "hooks", type: "address"},
        ],
      },
      {name: "to", type: "address"},
    ],
    outputs: [
      {name: "amount0", type: "uint256"},
      {name: "amount1", type: "uint256"},
    ],
  },
] as const;

export const vaultAbi = [
  {
    type: "function",
    name: "totalShares",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "", type: "uint256"}],
  },
  {
    type: "function",
    name: "totalStaked",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "", type: "uint256"}],
  },
  {
    type: "function",
    name: "sharesOf",
    stateMutability: "view",
    inputs: [{name: "", type: "address"}],
    outputs: [{name: "", type: "uint256"}],
  },
  {
    type: "function",
    name: "pendingRewards",
    stateMutability: "view",
    inputs: [{name: "user", type: "address"}],
    outputs: [
      {name: "fee0", type: "uint256"},
      {name: "fee1", type: "uint256"},
    ],
  },
  {
    type: "function",
    name: "pendingUnstake",
    stateMutability: "view",
    inputs: [{name: "", type: "address"}],
    outputs: [
      {name: "shares", type: "uint256"},
      {name: "releaseAt", type: "uint256"},
    ],
  },
  {
    type: "function",
    name: "COOLDOWN",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "", type: "uint256"}],
  },
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [{name: "amount", type: "uint256"}],
    outputs: [{name: "shares", type: "uint256"}],
  },
  {
    type: "function",
    name: "requestUnstake",
    stateMutability: "nonpayable",
    inputs: [{name: "shares", type: "uint256"}],
    outputs: [],
  },
  {
    type: "function",
    name: "unstake",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{name: "amount", type: "uint256"}],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [
      {name: "amount0", type: "uint256"},
      {name: "amount1", type: "uint256"},
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{name: "", type: "address"}],
    outputs: [{name: "", type: "uint256"}],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      {name: "", type: "address"},
      {name: "", type: "address"},
    ],
    outputs: [{name: "", type: "uint256"}],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      {name: "spender", type: "address"},
      {name: "amount", type: "uint256"},
    ],
    outputs: [{name: "", type: "bool"}],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "", type: "uint8"}],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "", type: "string"}],
  },
] as const;

export const mockErc20Abi = [
  ...erc20Abi,
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      {name: "to", type: "address"},
      {name: "amount", type: "uint256"},
    ],
    outputs: [],
  },
] as const;

export const oracleAbi = [
  {
    type: "function",
    name: "getPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "priceWad", type: "uint256"}],
  },
] as const;

export const marketHoursAbi = [
  {
    type: "function",
    name: "isMarketOpen",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "", type: "bool"}],
  },
  {
    type: "function",
    name: "lastUpdate",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "", type: "uint64"}],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "", type: "address"}],
  },
  {
    type: "function",
    name: "setOpen",
    stateMutability: "nonpayable",
    inputs: [{name: "_open", type: "bool"}],
    outputs: [],
  },
] as const;

/** Just the events the dashboard reads via `getLogs` — used by RecentSwapsPanel and ZScoreChart. */
export const hookEventsAbi = [
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
] as const;

/** PM events the dashboard reads via getLogs — for the 24h fee tally on PoolCard. */
export const pmEventsAbi = [
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

export const swapRouterAbi = [
  {
    type: "function",
    name: "swap",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "key",
        type: "tuple",
        components: [
          {name: "currency0", type: "address"},
          {name: "currency1", type: "address"},
          {name: "fee", type: "uint24"},
          {name: "tickSpacing", type: "int24"},
          {name: "hooks", type: "address"},
        ],
      },
      {name: "zeroForOne", type: "bool"},
      {name: "amountIn", type: "uint256"},
      {name: "amountOutMinimum", type: "uint256"},
      {name: "recipient", type: "address"},
      {name: "hookData", type: "bytes"},
    ],
    outputs: [{name: "amountOut", type: "uint256"}],
  },
] as const;
