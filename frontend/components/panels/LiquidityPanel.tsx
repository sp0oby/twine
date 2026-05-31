"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {parseUnits} from "viem";
import {useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract} from "wagmi";

import {erc20Abi, pmAbi} from "@/lib/abis";
import {fmtAmount} from "@/lib/format";
import {poolKeyFor} from "@/lib/poolKey";
import {getDeployment} from "@/lib/twine";

import {useAllowance, usePoolReads, useUserReads} from "@/hooks/usePool";
import {Field, PanelFootnote, StatRow, TxStatus} from "./atoms";

type Mode = "deposit" | "withdraw";

export function LiquidityPanel() {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const {address} = useAccount();
  const user = useUserReads(address);
  const {drift, totalShares, marketOpen} = usePoolReads();

  const [mode, setMode] = useState<Mode>("deposit");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [shares, setShares] = useState("");

  if (!deployment) {
    return <PanelFootnote>No Twine deployment found for this chain.</PanelFootnote>;
  }

  return (
    <div className="space-y-5">
      <ModeTabs mode={mode} setMode={setMode} />
      {mode === "deposit" ? (
        marketOpen === false ? (
          // Hard-block deposits during close - spec §5.2, equity oracle is stale so the LP would
          // be entering at a Friday-close anchor with no asymmetric-fee protection until reopen.
          // Withdrawals stay open via the other tab.
          <ClosedDeposits />
        ) : (
          <DepositMode
            deployment={deployment}
            address={address}
            a0={amount0}
            setA0={setAmount0}
            a1={amount1}
            setA1={setAmount1}
            user={user}
            drift={drift}
            totalShares={totalShares}
          />
        )
      ) : (
        <WithdrawMode
          deployment={deployment}
          address={address}
          sharesIn={shares}
          setShares={setShares}
          user={user}
        />
      )}
      <PanelFootnote>
        LP shares are non-transferable in v1 and back the pool position 1:1 with the v4 liquidity
        you provide. Deposits are accepted only while the pool is in band and the equity market is
        open; withdrawals are always allowed (even out of band).
      </PanelFootnote>
    </div>
  );
}

function ClosedDeposits() {
  return (
    <div className="border border-amber-200/30 bg-amber-200/[0.04] px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-200/85">
        Deposits paused · NYSE closed
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-amber-50/85">
        Reopens next NYSE session. Withdrawals stay open. <Link href="/docs#market-hours" className="underline underline-offset-4 hover:text-white">Why →</Link>
      </p>
    </div>
  );
}

function DepositMode({
  deployment,
  address,
  a0,
  setA0,
  a1,
  setA1,
  user,
  drift,
  totalShares,
}: {
  deployment: NonNullable<ReturnType<typeof getDeployment>>;
  address: `0x${string}` | undefined;
  a0: string;
  setA0: (v: string) => void;
  a1: string;
  setA1: (v: string) => void;
  user: ReturnType<typeof useUserReads>;
  drift: bigint | undefined;
  totalShares: bigint | undefined;
}) {
  const key = poolKeyFor(deployment);
  const a0Wei = parseAmount(a0, 18);
  const a1Wei = parseAmount(a1, 18);

  const allow0 = useAllowance(deployment.token0, address, deployment.positionManager);
  const allow1 = useAllowance(deployment.token1, address, deployment.positionManager);

  const {writeContract: approve0, data: tx0, isPending: pending0} = useWriteContract();
  const {writeContract: approve1, data: tx1, isPending: pending1} = useWriteContract();
  const {writeContract: mint, data: txMint, isPending: pendingMint} = useWriteContract();
  const wait0 = useWaitForTransactionReceipt({hash: tx0});
  const wait1 = useWaitForTransactionReceipt({hash: tx1});
  const waitMint = useWaitForTransactionReceipt({hash: txMint});

  // Optimistic allowance shadow: the on-chain `allowance` read can lag the approve receipt by
  // several seconds (RPC propagation + react-query's cached fetch), which used to leave the
  // button stuck on "Approve" and made users re-sign in a loop. The moment the receipt confirms
  // we bump the local shadow to the amount we just approved, AND trigger a real refetch.
  const [optAllow0, setOptAllow0] = useState<bigint>(0n);
  const [optAllow1, setOptAllow1] = useState<bigint>(0n);
  useEffect(() => {
    if (wait0.isSuccess && a0Wei !== undefined && a0Wei > optAllow0) {
      setOptAllow0(a0Wei);
      allow0.refetch();
    }
  }, [wait0.isSuccess, a0Wei, allow0, optAllow0]);
  useEffect(() => {
    if (wait1.isSuccess && a1Wei !== undefined && a1Wei > optAllow1) {
      setOptAllow1(a1Wei);
      allow1.refetch();
    }
  }, [wait1.isSuccess, a1Wei, allow1, optAllow1]);

  const eff0 = max(allow0.data ?? 0n, optAllow0);
  const eff1 = max(allow1.data ?? 0n, optAllow1);
  const needs0 = a0Wei !== undefined && eff0 < a0Wei;
  const needs1 = a1Wei !== undefined && eff1 < a1Wei;
  const busy =
    pending0 || pending1 || pendingMint || wait0.isLoading || wait1.isLoading || waitMint.isLoading;

  function onClick() {
    if (!a0Wei || !a1Wei || !address) return;
    if (needs0) {
      approve0({
        address: deployment.token0,
        abi: erc20Abi,
        functionName: "approve",
        args: [deployment.positionManager, a0Wei],
      });
      return;
    }
    if (needs1) {
      approve1({
        address: deployment.token1,
        abi: erc20Abi,
        functionName: "approve",
        args: [deployment.positionManager, a1Wei],
      });
      return;
    }
    mint({
      address: deployment.positionManager,
      abi: pmAbi,
      functionName: "mint",
      args: [key, a0Wei, a1Wei, address],
    });
  }

  const ready = !!a0Wei && !!a1Wei && !!address && !busy;

  return (
    <>
      <Field
        label="Deposit"
        token="token0"
        value={a0}
        onChange={setA0}
        editable
        hint={`balance ${fmtAmount(user.bal0)}`}
      />
      <Field
        label="Deposit"
        token="token1"
        value={a1}
        onChange={setA1}
        editable
        hint={`balance ${fmtAmount(user.bal1)}`}
      />
      <StatRow
        stats={[
          {label: "Your LP shares", value: fmtAmount(user.lpShares)},
          {label: "Pool drift (bps)", value: drift !== undefined ? signedBps(drift) : "-"},
          {label: "Total LP shares", value: fmtAmount(totalShares)},
        ]}
      />
      <button type="button" disabled={!ready} onClick={onClick} className={btnCls(!ready)}>
        {!address
          ? "Connect wallet"
          : !a0Wei || !a1Wei
            ? "Enter amounts"
            : pending0 || wait0.isLoading
              ? "Approving token0…"
              : pending1 || wait1.isLoading
                ? "Approving token1…"
                : pendingMint || waitMint.isLoading
                  ? "Providing liquidity…"
                  : needs0
                    ? "Approve token0"
                    : needs1
                      ? "Approve token1"
                      : "Provide liquidity"}
      </button>
      <TxStatus hash={txMint ?? tx1 ?? tx0} />
    </>
  );
}

function WithdrawMode({
  deployment,
  address,
  sharesIn,
  setShares,
  user,
}: {
  deployment: NonNullable<ReturnType<typeof getDeployment>>;
  address: `0x${string}` | undefined;
  sharesIn: string;
  setShares: (v: string) => void;
  user: ReturnType<typeof useUserReads>;
}) {
  const key = poolKeyFor(deployment);
  const sharesWei = parseAmount(sharesIn, 18);

  const {writeContract: burn, data: tx, isPending} = useWriteContract();
  const wait = useWaitForTransactionReceipt({hash: tx});
  const {writeContract: collect, data: ctx, isPending: collectPending} = useWriteContract();
  const collectWait = useWaitForTransactionReceipt({hash: ctx});

  const validShares = sharesWei !== undefined && sharesWei > 0n;
  const tooMany = validShares && user.lpShares !== undefined && sharesWei > user.lpShares;
  const ready = !!address && validShares && !tooMany && !isPending && !wait.isLoading;

  return (
    <>
      <Field
        label="Burn"
        token="LP shares"
        value={sharesIn}
        onChange={setShares}
        editable
        hint={`your shares ${fmtAmount(user.lpShares)}`}
      />
      <StatRow
        stats={[
          {label: "Your LP shares", value: fmtAmount(user.lpShares)},
          {label: "Pending fee0", value: fmtAmount(user.lpShares ? undefined : 0n)},
          {label: "Pending fee1", value: fmtAmount(user.lpShares ? undefined : 0n)},
        ]}
      />
      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          if (!sharesWei || !address) return;
          burn({
            address: deployment.positionManager,
            abi: pmAbi,
            functionName: "burn",
            args: [key, sharesWei, address],
          });
        }}
        className={btnCls(!ready)}
      >
        {!address
          ? "Connect wallet"
          : !validShares
            ? "Enter shares"
            : tooMany
              ? "Exceeds your shares"
              : isPending || wait.isLoading
                ? "Withdrawing…"
                : "Withdraw"}
      </button>
      <button
        type="button"
        disabled={!address || collectPending || collectWait.isLoading}
        onClick={() => {
          if (!address) return;
          collect({
            address: deployment.positionManager,
            abi: pmAbi,
            functionName: "collectFees",
            args: [key, address],
          });
        }}
        className={btnCls(!address || collectPending || collectWait.isLoading)}
      >
        {!address
          ? "Connect wallet"
          : collectPending || collectWait.isLoading
            ? "Collecting…"
            : "Collect fees only"}
      </button>
      <TxStatus hash={ctx ?? tx} />
    </>
  );
}

function ModeTabs({mode, setMode}: {mode: Mode; setMode: (m: Mode) => void}) {
  const modes: {id: Mode; label: string}[] = [
    {id: "deposit", label: "Deposit"},
    {id: "withdraw", label: "Withdraw"},
  ];
  return (
    <div className="flex items-baseline gap-4 font-mono text-[11px] uppercase tracking-[0.22em]">
      {modes.map((m, i) => (
        <span key={m.id} className="flex items-baseline gap-4">
          {i > 0 ? (
            <span aria-hidden className="text-line">
              ·
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setMode(m.id)}
            className={`transition-colors ${m.id === mode ? "text-white" : "text-muted hover:text-ink"}`}
          >
            {m.label}
          </button>
        </span>
      ))}
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

function max(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

function signedBps(bps: bigint): string {
  const sign = bps > 0n ? "+" : "";
  return `${sign}${bps.toString()}`;
}

function btnCls(disabled: boolean) {
  return `block w-full py-3 border border-line font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
    disabled ? "text-muted cursor-not-allowed" : "text-white hover:bg-white/5"
  }`;
}
