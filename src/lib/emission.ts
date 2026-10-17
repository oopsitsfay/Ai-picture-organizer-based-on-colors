import { config } from "../config";

export const WEEK = 7 * 86_400_000;

const start = Date.parse(config.mining.start);
const end = Date.parse(config.btcHalving.estimate);

/** Number of weekly claim periods from mining start to the halving. */
export const totalWeeks = Math.max(1, Math.ceil((end - start) / WEEK));

/** $ emitted to the whole collection each week. */
export const weeklyEmission = config.token.maxSupply / totalWeeks;

export type Week = {
  /** 1-based week number; 0 before mining starts. */
  n: number;
  startsAt: number;
  endsAt: number;
  started: boolean;
  ended: boolean;
};

export function weekAt(now: number): Week {
  if (now < start) return { n: 0, startsAt: start, endsAt: start, started: false, ended: false };
  const n = Math.min(totalWeeks, Math.floor((now - start) / WEEK) + 1);
  const startsAt = start + (n - 1) * WEEK;
  return { n, startsAt, endsAt: Math.min(end, startsAt + WEEK), started: true, ended: now >= end };
}

/** A holder's weekly $ production from their share of total hash power. */
export const weeklyFor = (hashPower: number, totalHashPower: number) => (weeklyEmission * hashPower) / totalHashPower;

export const fmtToken = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
