export const btc = (sats: number) => {
  const v = sats / 1e8;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 8 })} BTC`;
};

export const sats = (n: number) => `${n.toLocaleString("en-US")} sats`;

export const int = (n: number) => n.toLocaleString("en-US");

export const short = (s: string, head = 8, tail = 6) => (s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s);

export const date = (unix?: number) =>
  unix ? new Date(unix * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Unconfirmed";

export const isTxid = (s: string) => /^[0-9a-f]{64}$/i.test(s.trim());

/** Mainnet addresses only: legacy (1), P2SH (3), segwit / taproot (bc1). */
export const isAddress = (s: string) =>
  /^bc1[02-9ac-hj-np-z]{11,87}$/.test(s.trim().toLowerCase()) || /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(s.trim());

export const isTestnet = (s: string) => /^(tb1|bcrt1|[mn2])/i.test(s.trim());
