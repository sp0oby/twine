import {formatUnits} from "viem";

/** Format a BigInt amount with token decimals, trimmed to `frac` decimal places. */
export function fmtAmount(value: bigint | undefined, decimals = 18, frac = 4): string {
  if (value === undefined) return "-";
  const s = formatUnits(value, decimals);
  const [whole, fracStr = ""] = s.split(".");
  if (frac === 0) return whole ?? "0";
  return `${whole}.${fracStr.slice(0, frac).padEnd(frac, "0")}`;
}

/** Format a signed bps drift like `+413` or `-1671`. */
export function fmtDriftBps(drift: bigint | undefined): string {
  if (drift === undefined) return "-";
  const sign = drift > 0n ? "+" : drift < 0n ? "" : "";
  return `${sign}${drift.toString()}`;
}

/** Truncate any 0x address for compact display. */
export function shortAddr(addr: string | undefined): string {
  if (!addr || addr.length < 10) return addr ?? "-";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
