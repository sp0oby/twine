"use client";

import {useEffect, useState} from "react";
import {parseUnits} from "viem";
import {useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract} from "wagmi";

import {erc20Abi, swapRouterAbi} from "@/lib/abis";
import {fmtAmount} from "@/lib/format";
import {poolKeyFor} from "@/lib/poolKey";
import {getDeployment} from "@/lib/twine";

import {useAllowance, usePoolReads, useUserReads} from "@/hooks/usePool";
import {Field, PanelFootnote, StatRow, TxStatus} from "./atoms";

const ZERO_BYTES = "0x" as const;

/**
 * Swap UI wired to {TwineSwapRouter}. User-set slippage tolerance (% bps); we pass
 * `amountOutMinimum = amountIn * (10000 - slippageBps) / 10000` as a first-cut bound. A future
 * pass will quote the asymmetric fee from the hook for a tighter min-out.
 */
export function SwapPanel() {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const {address} = useAccount();
  const {drift} = usePoolReads();
  const user = useUserReads(address);

  const [zeroForOne, setZeroForOne] = useState(true);
  const [amountIn, setAmountIn] = useState("");
  const [slippage, setSlippage] = useState("0.5");

  if (!deployment) {
    return <PanelFootnote>No Twine deployment found for this chain.</PanelFootnote>;
  }
  if (!deployment.swapRouter) {
    return (
      <div className="space-y-5">
        <Field label="You pay" token={zeroForOne ? "token0" : "token1"} value={amountIn} onChange={setAmountIn} editable />
        <PanelFootnote>
          Swap router not yet deployed on this chain. Run{" "}
          <span className="text-ink">forge script script/DeployRouter.s.sol --broadcast</span> and
          the panel will activate.
        </PanelFootnote>
      </div>
    );
  }

  return (
    <Live
      deployment={deployment as NonNullable<ReturnType<typeof getDeployment>> & {swapRouter: `0x${string}`}}
      address={address}
      drift={drift}
      user={user}
      zeroForOne={zeroForOne}
      setZeroForOne={setZeroForOne}
      amountIn={amountIn}
      setAmountIn={setAmountIn}
      slippage={slippage}
      setSlippage={setSlippage}
    />
  );
}

function Live({
  deployment,
  address,
  drift,
  user,
  zeroForOne,
  setZeroForOne,
  amountIn,
  setAmountIn,
  slippage,
  setSlippage,
}: {
  deployment: NonNullable<ReturnType<typeof getDeployment>> & {swapRouter: `0x${string}`};
  address: `0x${string}` | undefined;
  drift: bigint | undefined;
  user: ReturnType<typeof useUserReads>;
  zeroForOne: boolean;
  setZeroForOne: (fn: (d: boolean) => boolean) => void;
  amountIn: string;
  setAmountIn: (v: string) => void;
  slippage: string;
  setSlippage: (v: string) => void;
}) {
  const key = poolKeyFor(deployment);
  const tokenIn = zeroForOne ? deployment.token0 : deployment.token1;
  const tokenInLabel = zeroForOne ? "token0" : "token1";
  const tokenOutLabel = zeroForOne ? "token1" : "token0";
  const balanceIn = zeroForOne ? user.bal0 : user.bal1;

  const amountInWei = parseAmount(amountIn, 18);

  const allowance = useAllowance(tokenIn, address, deployment.swapRouter);
  const {writeContract: approve, data: approveTx, isPending: approving} = useWriteContract();
  const {writeContract: swap, data: swapTx, isPending: swapping} = useWriteContract();
  const approveWait = useWaitForTransactionReceipt({hash: approveTx});
  const swapWait = useWaitForTransactionReceipt({hash: swapTx});

  useEffect(() => {
    if (approveWait.isSuccess) allowance.refetch();
  }, [approveWait.isSuccess, allowance]);

  const needsApproval = amountInWei !== undefined && (allowance.data ?? 0n) < amountInWei;
  const slippageBps = parseSlippageBps(slippage);
  const busy = approving || swapping || approveWait.isLoading || swapWait.isLoading;
  const ready = !!address && !!amountInWei && amountInWei > 0n && slippageBps !== undefined && !busy;

  // corrective when the swap pushes the pool toward fair price
  let direction = "—";
  if (drift !== undefined) {
    if (drift === 0n) direction = "in band";
    else if ((drift > 0n && zeroForOne) || (drift < 0n && !zeroForOne)) direction = "corrective";
    else direction = "adversarial";
  }

  function onClick() {
    if (!amountInWei || !address || slippageBps === undefined) return;
    if (needsApproval) {
      approve({
        address: tokenIn,
        abi: erc20Abi,
        functionName: "approve",
        args: [deployment.swapRouter, amountInWei],
      });
      return;
    }
    // amountOutMinimum is a crude lower bound: amountIn * (10000 - slippage*100) / 10000.
    // It assumes fair price ≈ 1:1; a future quoting pass will tighten this to the hook's
    // expected fee at the current drift.
    const minOut = (amountInWei * (10_000n - slippageBps)) / 10_000n;
    swap({
      address: deployment.swapRouter,
      abi: swapRouterAbi,
      functionName: "swap",
      args: [key, zeroForOne, amountInWei, minOut, address, ZERO_BYTES],
    });
  }

  return (
    <div className="space-y-5">
      <Field
        label="You pay"
        token={tokenInLabel}
        value={amountIn}
        onChange={setAmountIn}
        editable
        hint={`balance ${fmtAmount(balanceIn)}`}
      />
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setZeroForOne((d) => !d)}
          aria-label="Flip swap direction"
          className="font-mono text-muted hover:text-ink transition-colors text-lg leading-none px-3 py-1"
        >
          ↓
        </button>
      </div>
      <Field label="You receive" token={tokenOutLabel} value="" editable={false} />

      <div className="flex items-baseline justify-between gap-3 border border-line px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Slippage (%)</span>
        <input
          type="text"
          inputMode="decimal"
          value={slippage}
          onChange={(e) => setSlippage(e.target.value.replace(/[^0-9.]/g, ""))}
          className="bg-transparent font-mono text-sm text-white outline-none text-right w-24"
        />
      </div>

      <StatRow
        stats={[
          {label: "Pool drift (bps)", value: drift !== undefined ? signedBps(drift) : "—"},
          {label: "Direction", value: direction},
          {label: "Slippage", value: slippageBps !== undefined ? `${(Number(slippageBps) / 100).toFixed(2)}%` : "—"},
        ]}
      />

      <button type="button" disabled={!ready} onClick={onClick} className={btnCls(!ready)}>
        {!address
          ? "Connect wallet"
          : !amountInWei || amountInWei === 0n
            ? "Enter an amount"
            : slippageBps === undefined
              ? "Set slippage"
              : approving || approveWait.isLoading
                ? "Approving…"
                : swapping || swapWait.isLoading
                  ? "Swapping…"
                  : needsApproval
                    ? `Approve ${tokenInLabel}`
                    : "Swap"}
      </button>
      <TxStatus hash={swapTx ?? approveTx} />

      <PanelFootnote>
        Swap routes through {`{TwineSwapRouter}`}. The Twine hook decides the asymmetric fee in
        beforeSwap — corrective swaps are discounted, adversarial swaps are surcharged.
      </PanelFootnote>
    </div>
  );
}

function parseAmount(v: string, decimals: number): bigint | undefined {
  if (!v || v === "." || v.startsWith(".")) return undefined;
  try {
    return parseUnits(v as `${number}`, decimals);
  } catch {
    return undefined;
  }
}

function parseSlippageBps(v: string): bigint | undefined {
  if (!v) return undefined;
  const num = Number(v);
  if (!Number.isFinite(num) || num < 0 || num > 50) return undefined;
  // 0.5 -> 50 bps
  return BigInt(Math.floor(num * 100));
}

function signedBps(bps: bigint): string {
  return `${bps > 0n ? "+" : ""}${bps.toString()}`;
}

function btnCls(disabled: boolean) {
  return `block w-full py-3 border border-line font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
    disabled ? "text-muted cursor-not-allowed" : "text-white hover:bg-white/5"
  }`;
}
