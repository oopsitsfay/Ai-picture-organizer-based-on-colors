import { config } from "../config";

/** Shapes returned by mempool.space-compatible APIs (Esplora). Only the fields we use. */
export type Output = { scriptpubkey_address?: string; scriptpubkey_type: string; value: number };
export type Input = { txid: string; vout: number; prevout: Output | null; is_coinbase: boolean };
export type Tx = {
  txid: string;
  vin: Input[];
  vout: Output[];
  fee: number;
  weight: number;
  status: { confirmed: boolean; block_height?: number; block_time?: number };
};
type Stats = { funded_txo_count: number; funded_txo_sum: number; spent_txo_count: number; spent_txo_sum: number; tx_count: number };
export type AddressInfo = { address: string; chain_stats: Stats; mempool_stats: Stats };
export type Utxo = { txid: string; vout: number; value: number; status: { confirmed: boolean } };

const KEY = "apiBase";

export function getApiBase() {
  try {
    return localStorage.getItem(KEY) || config.apiBase;
  } catch {
    return config.apiBase;
  }
}

export function setApiBase(v: string | null) {
  try {
    if (v && v.trim() && v.trim() !== config.apiBase) localStorage.setItem(KEY, v.trim().replace(/\/+$/, ""));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the default stays in use */
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}${path}`, { signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("Couldn't reach the explorer API. Check your connection or the API in Settings.");
  }
  if (res.status === 400 || res.status === 404) throw new Error("Not found on the Bitcoin mainnet.");
  if (res.status === 429) throw new Error("The explorer is rate-limiting requests. Wait a minute and try again.");
  if (!res.ok) throw new Error(`Explorer API error (${res.status}).`);
  return res.json() as Promise<T>;
}

/** Most recent transactions for an address: the first page plus up to `pages - 1` more confirmed pages. */
async function addressTxs(address: string, pages: number, signal?: AbortSignal) {
  const first = await get<Tx[]>(`/address/${address}/txs`, signal);
  const all = [...first];
  let confirmed = first.filter((t) => t.status.confirmed);
  for (let i = 1; i < pages && confirmed.length >= 25; i++) {
    const next = await get<Tx[]>(`/address/${address}/txs/chain/${confirmed[confirmed.length - 1].txid}`, signal);
    if (!next.length) break;
    all.push(...next);
    confirmed = next;
  }
  return all;
}

export async function fetchAddress(address: string, signal?: AbortSignal) {
  const [info, txs, utxos] = await Promise.all([
    get<AddressInfo>(`/address/${address}`, signal),
    addressTxs(address, 3, signal),
    get<Utxo[]>(`/address/${address}/utxo`, signal).catch(() => [] as Utxo[]),
  ]);
  return { info, txs, utxos };
}

export const fetchTx = (txid: string, signal?: AbortSignal) => get<Tx>(`/tx/${txid}`, signal);
