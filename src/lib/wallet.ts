import { config } from "../config";
import type { Collection, Piece } from "../data/collection";

export type WalletKind = "unisat" | "xverse" | "watch";
export type Wallet = { address: string; kind: WalletKind };

type Unisat = {
  requestAccounts(): Promise<string[]>;
  signMessage(message: string): Promise<string>;
};
type XverseProvider = {
  request(method: string, params: unknown): Promise<{ result?: unknown; error?: { message: string } }>;
};

declare global {
  interface Window {
    unisat?: Unisat;
    XverseProviders?: { BitcoinProvider?: XverseProvider };
  }
}

export const hasUnisat = () => typeof window !== "undefined" && !!window.unisat;
export const hasXverse = () => typeof window !== "undefined" && !!window.XverseProviders?.BitcoinProvider;

/** Loose check for mainnet/testnet Bitcoin addresses (legacy, P2SH, segwit, taproot). */
export const isBtcAddress = (a: string) => /^(bc1|tb1)[02-9ac-hj-np-z]{11,87}$|^[13mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a.trim());

export async function connect(kind: Exclude<WalletKind, "watch">): Promise<Wallet> {
  if (kind === "unisat") {
    if (!window.unisat) throw new Error("UniSat isn't installed in this browser.");
    const [address] = await window.unisat.requestAccounts();
    if (!address) throw new Error("UniSat didn't return an address.");
    return { address, kind };
  }
  const p = window.XverseProviders?.BitcoinProvider;
  if (!p) throw new Error("Xverse isn't installed in this browser.");
  const res = await p.request("getAccounts", { purposes: ["ordinals"], message: `Connect to ${config.name}` });
  if (res.error) throw new Error(res.error.message);
  const accounts = (res.result ?? []) as { address: string; purpose?: string }[];
  const ord = accounts.find((a) => a.purpose === "ordinals") ?? accounts[0];
  if (!ord) throw new Error("Xverse didn't return an address.");
  return { address: ord.address, kind };
}

export async function signMessage(w: Wallet, message: string): Promise<string> {
  if (w.kind === "unisat" && window.unisat) return window.unisat.signMessage(message);
  const p = window.XverseProviders?.BitcoinProvider;
  if (w.kind === "xverse" && p) {
    const res = await p.request("signMessage", { address: w.address, message });
    if (res.error) throw new Error(res.error.message);
    const r = res.result as { signature?: string } | string;
    return typeof r === "string" ? r : (r.signature ?? "");
  }
  throw new Error("Connect UniSat or Xverse to sign. A pasted address can only be viewed.");
}

/** Deterministic 32-bit hash of a string. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Finds the collection pieces held by `address`.
 * Sample mode: a stable, made-up set of pieces per address, so the flow can be tried end to end.
 * Live mode: the address's inscriptions from the Hiro Ordinals API, matched against the collection.
 */
export async function scanHoldings(address: string, c: Collection, signal?: AbortSignal): Promise<Piece[]> {
  if (config.collection.sample) {
    await new Promise((r) => setTimeout(r, 700));
    let h = hash(address);
    const count = 1 + (h % 5);
    const out = new Set<Piece>();
    while (out.size < count) {
      h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
      out.add(c.pieces[h % c.pieces.length]);
    }
    return [...out];
  }

  const held: Piece[] = [];
  for (let offset = 0; ; offset += 60) {
    const res = await fetch(`https://api.hiro.so/ordinals/v1/inscriptions?address=${encodeURIComponent(address)}&limit=60&offset=${offset}`, { signal });
    if (!res.ok) throw new Error(`Inscription lookup failed (${res.status}).`);
    const page = (await res.json()) as { total: number; results: { id: string }[] };
    for (const r of page.results) {
      const p = c.byId.get(r.id);
      if (p) held.push(p);
    }
    if (offset + 60 >= page.total) break;
  }
  return held;
}

export const shortAddr = (a: string) => (a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
