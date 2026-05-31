"use client";

import {useEffect, useState} from "react";
import {parseUnits} from "viem";
import {useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract} from "wagmi";

import {erc20Abi, vaultAbi} from "@/lib/abis";
import {fmtAmount} from "@/lib/format";
import {getDeployment} from "@/lib/twine";

import {useAllowance, usePoolReads, useUserReads} from "@/hooks/usePool";
import {Field, PanelFootnote, StatRow, TxStatus} from "./atoms";

type Mode = "stake" | "unstake" | "claim";

export function VaultPanel() {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const {address} = useAccount();
  const {vaultStaked} = usePoolReads();
  const user = useUserReads(address);

  const [mode, setMode] = useState<Mode>("stake");
  const [amount, setAmount] = useState("");

  if (!deployment) {
    return <PanelFootnote>No Twine deployment found for this chain.</PanelFootnote>;
  }

  return (
    <div className="space-y-5">
      <ModeTabs mode={mode} setMode={setMode} />
      {mode === "stake" ? (
        <StakeMode
          deployment={deployment}
          address={address}
          amount={amount}
          setAmount={setAmount}
          user={user}
          vaultStaked={vaultStaked}
        />
      ) : mode === "unstake" ? (
        <UnstakeMode deployment={deployment} address={address} amount={amount} setAmount={setAmount} user={user} />
      ) : (
        <ClaimMode deployment={deployment} address={address} user={user} />
      )}
      <PanelFootnote>
        STRAND stakers underwrite structural-break risk: on a break the hook seizes a fraction of
        staked STRAND and every staker takes a pro-rata haircut. In return, stakers earn a
        governance-configured share of pool swap fees in token0/token1.
      </PanelFootnote>
    </div>
  );
}

function StakeMode({
  deployment,
  address,
  amount,
  setAmount,
  user,
  vaultStaked,
}: {
  deployment: NonNullable<ReturnType<typeof getDeployment>>;
  address: `0x${string}` | undefined;
  amount: string;
  setAmount: (v: string) => void;
  user: ReturnType<typeof useUserReads>;
  vaultStaked: bigint | undefined;
}) {
  const amountWei = parseAmount(amount, 18);
  const allowance = useAllowance(deployment.strand, address, deployment.vault);
  const {writeContract: approve, data: approveTx, isPending: approving} = useWriteContract();
  const {writeContract: stake, data: stakeTx, isPending: staking} = useWriteContract();
  const approveWait = useWaitForTransactionReceipt({hash: approveTx});
  const stakeWait = useWaitForTransactionReceipt({hash: stakeTx});

  // Optimistic allowance shadow - see LiquidityPanel for the same fix. The on-chain allowance
  // read lags the approve receipt by a few seconds, which used to leave the button stuck on
  // "Approve STRAND" and force users to re-sign.
  const [optAllow, setOptAllow] = useState<bigint>(0n);
  useEffect(() => {
    if (approveWait.isSuccess && amountWei !== undefined && amountWei > optAllow) {
      setOptAllow(amountWei);
      allowance.refetch();
    }
  }, [approveWait.isSuccess, amountWei, allowance, optAllow]);
  const effAllow = (allowance.data ?? 0n) > optAllow ? (allowance.data ?? 0n) : optAllow;

  const needsApproval = amountWei !== undefined && effAllow < amountWei;
  const busy = approving || staking || approveWait.isLoading || stakeWait.isLoading;
  const disabled = !address || amountWei === undefined || amountWei === 0n || busy;

  return (
    <>
      <Field
        label="Stake"
        token="STRAND"
        value={amount}
        onChange={setAmount}
        editable
        hint={`balance ${fmtAmount(user.strandBal)}`}
      />
      <StatRow
        stats={[
          {label: "Your stake", value: fmtAmount(user.vaultStake)},
          {label: "Vault TVL", value: fmtAmount(vaultStaked)},
          {label: "Pending rewards", value: fmtRewardPair(user.pendingRewards)},
        ]}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!amountWei || !address) return;
          if (needsApproval) {
            approve({
              address: deployment.strand,
              abi: erc20Abi,
              functionName: "approve",
              args: [deployment.vault, amountWei],
            });
          } else {
            stake({address: deployment.vault, abi: vaultAbi, functionName: "stake", args: [amountWei]});
          }
        }}
        className={btnCls(disabled)}
      >
        {!address
          ? "Connect wallet"
          : amountWei === undefined || amountWei === 0n
            ? "Enter an amount"
            : approving || approveWait.isLoading
              ? "Approving…"
              : staking || stakeWait.isLoading
                ? "Staking…"
                : needsApproval
                  ? "Approve STRAND"
                  : "Stake"}
      </button>
      <TxStatus hash={stakeTx ?? approveTx} />
    </>
  );
}

function UnstakeMode({
  deployment,
  address,
  amount,
  setAmount,
  user,
}: {
  deployment: NonNullable<ReturnType<typeof getDeployment>>;
  address: `0x${string}` | undefined;
  amount: string;
  setAmount: (v: string) => void;
  user: ReturnType<typeof useUserReads>;
}) {
  const sharesWei = parseAmount(amount, 18);
  const {writeContract: request, data: requestTx, isPending: requesting} = useWriteContract();
  const {writeContract: withdraw, data: withdrawTx, isPending: withdrawing} = useWriteContract();
  const requestWait = useWaitForTransactionReceipt({hash: requestTx});
  const withdrawWait = useWaitForTransactionReceipt({hash: withdrawTx});

  const pending = user.pendingUnstake;
  const hasPending = !!pending && pending[0] > 0n;
  const releaseAt = pending ? Number(pending[1]) : 0;
  const now = Math.floor(Date.now() / 1000);
  const cooldownActive = hasPending && now < releaseAt;

  return (
    <>
      {hasPending ? (
        <div className="border border-line px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Pending unstake
          </div>
          <div className="mt-1 font-mono text-[15px] text-white">{fmtAmount(pending[0])} shares</div>
          <div className="mt-2 font-mono text-[12px] text-muted">
            {cooldownActive ? `Ready in ${Math.max(0, releaseAt - now)}s` : "Cooldown elapsed - ready to withdraw"}
          </div>
        </div>
      ) : (
        <Field
          label="Request unstake"
          token="SHARES"
          value={amount}
          onChange={setAmount}
          editable
          hint={`your stake ${fmtAmount(user.vaultStake)}`}
        />
      )}
      <StatRow
        stats={[
          {label: "Your stake", value: fmtAmount(user.vaultStake)},
          {label: "Cooldown", value: "7 days"},
          {label: "Ready at", value: hasPending ? new Date(releaseAt * 1000).toLocaleString() : "-"},
        ]}
      />
      {hasPending ? (
        <button
          type="button"
          disabled={!address || cooldownActive || withdrawing || withdrawWait.isLoading}
          onClick={() => withdraw({address: deployment.vault, abi: vaultAbi, functionName: "unstake"})}
          className={btnCls(!address || cooldownActive || withdrawing || withdrawWait.isLoading)}
        >
          {!address
            ? "Connect wallet"
            : cooldownActive
              ? "Cooldown active"
              : withdrawing || withdrawWait.isLoading
                ? "Withdrawing…"
                : "Withdraw stake"}
        </button>
      ) : (
        <button
          type="button"
          disabled={!address || !sharesWei || sharesWei === 0n || requesting || requestWait.isLoading}
          onClick={() => {
            if (!sharesWei) return;
            request({address: deployment.vault, abi: vaultAbi, functionName: "requestUnstake", args: [sharesWei]});
          }}
          className={btnCls(!address || !sharesWei || sharesWei === 0n || requesting || requestWait.isLoading)}
        >
          {!address
            ? "Connect wallet"
            : !sharesWei || sharesWei === 0n
              ? "Enter an amount"
              : requesting || requestWait.isLoading
                ? "Requesting…"
                : "Request unstake (7-day cooldown)"}
        </button>
      )}
      <TxStatus hash={withdrawTx ?? requestTx} />
    </>
  );
}

function ClaimMode({
  deployment,
  address,
  user,
}: {
  deployment: NonNullable<ReturnType<typeof getDeployment>>;
  address: `0x${string}` | undefined;
  user: ReturnType<typeof useUserReads>;
}) {
  const {writeContract, data: tx, isPending} = useWriteContract();
  const wait = useWaitForTransactionReceipt({hash: tx});
  const [p0, p1] = user.pendingRewards ?? [0n, 0n];
  const anyPending = p0 > 0n || p1 > 0n;

  return (
    <>
      <StatRow
        stats={[
          {label: "Pending token0", value: fmtAmount(p0)},
          {label: "Pending token1", value: fmtAmount(p1)},
          {label: "Your stake", value: fmtAmount(user.vaultStake)},
        ]}
      />
      <button
        type="button"
        disabled={!address || !anyPending || isPending || wait.isLoading}
        onClick={() => writeContract({address: deployment.vault, abi: vaultAbi, functionName: "claim"})}
        className={btnCls(!address || !anyPending || isPending || wait.isLoading)}
      >
        {!address
          ? "Connect wallet"
          : !anyPending
            ? "Nothing to claim"
            : isPending || wait.isLoading
              ? "Claiming…"
              : "Claim rewards"}
      </button>
      <TxStatus hash={tx} />
    </>
  );
}

function ModeTabs({mode, setMode}: {mode: Mode; setMode: (m: Mode) => void}) {
  const modes: {id: Mode; label: string}[] = [
    {id: "stake", label: "Stake"},
    {id: "unstake", label: "Unstake"},
    {id: "claim", label: "Claim"},
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

function fmtRewardPair(p: readonly [bigint, bigint] | undefined): string {
  if (!p) return "-";
  return `${fmtAmount(p[0], 18, 2)} / ${fmtAmount(p[1], 18, 2)}`;
}

function btnCls(disabled: boolean) {
  return `block w-full py-3 border border-line font-mono text-[11px] uppercase tracking-[0.22em] transition-colors ${
    disabled ? "text-muted cursor-not-allowed" : "text-white hover:bg-white/5"
  }`;
}
