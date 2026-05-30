import {LPFeeLibraryDynamicFee} from "./constants";
import type {TwineDeployment} from "./twine";

/** v4 PoolKey struct — same shape the contracts expect. */
export type PoolKey = {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
};

export function poolKeyFor(deployment: TwineDeployment): PoolKey {
  return {
    currency0: deployment.token0,
    currency1: deployment.token1,
    fee: LPFeeLibraryDynamicFee,
    tickSpacing: deployment.tickSpacing,
    hooks: deployment.hook,
  };
}
