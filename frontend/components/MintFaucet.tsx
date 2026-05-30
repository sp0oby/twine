"use client";

import {parseUnits} from "viem";
import {useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract} from "wagmi";

import {mockErc20Abi} from "@/lib/abis";
import {fmtAmount} from "@/lib/format";
import {getDeployment} from "@/lib/twine";

import {useUserReads} from "@/hooks/usePool";
import {TxStatusInline} from "./panels/atoms";

/**
 * Testnet faucet: mint mock token0/token1/STRAND straight from their `mint` selector.
 * These are MockERC20 / STRAND deployed by `DeployTestnet.s.sol` — open mint by design on testnet.
 */
export function MintFaucet() {
  const chainId = useChainId();
  const deployment = getDeployment(chainId);
  const {address} = useAccount();
  const user = useUserReads(address);

  if (!deployment) return null;

  return (
    <section className="mt-24">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Test tokens</h2>
      <p className="mt-3 font-mono text-[13px] text-muted">
        Mints 1,000 of the requested token to your address. The mock tokens have an open `mint`
        selector — fine for testnet; obviously not used on mainnet.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        <Mint label="token0" token={deployment.token0} balance={user.bal0} address={address} />
        <Mint label="token1" token={deployment.token1} balance={user.bal1} address={address} />
        <Mint label="STRAND" token={deployment.strand} balance={user.strandBal} address={address} />
      </div>
    </section>
  );
}

function Mint({
  label,
  token,
  balance,
  address,
}: {
  label: string;
  token: `0x${string}`;
  balance: bigint | undefined;
  address: `0x${string}` | undefined;
}) {
  const {writeContract, data: tx, isPending} = useWriteContract();
  const wait = useWaitForTransactionReceipt({hash: tx});
  const disabled = !address || isPending || wait.isLoading;

  return (
    <div className="border border-line px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{label}</div>
      <div className="mt-1 font-mono text-[14px] text-white">{fmtAmount(balance)}</div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!address) return;
          writeContract({
            address: token,
            abi: mockErc20Abi,
            functionName: "mint",
            args: [address, parseUnits("1000", 18)],
          });
        }}
        className={`mt-3 block w-full py-2 border border-line font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
          disabled ? "text-muted cursor-not-allowed" : "text-white hover:bg-white/5"
        }`}
      >
        {!address ? "Connect" : isPending || wait.isLoading ? "Minting…" : "+1000"}
      </button>
      <TxStatusInline hash={tx} />
    </div>
  );
}
