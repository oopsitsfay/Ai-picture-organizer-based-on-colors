import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  getAddress,
  http,
  isAddress,
  type Address,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/** Minimal `--key value` / `--flag` parser. Values that look like flags are treated as booleans. */
export function parseArgs(argv: string[] = process.argv.slice(2)): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function requireString(args: Record<string, string | true>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

export function optionalNumber(
  args: Record<string, string | true>,
  key: string,
  fallback: number,
): number {
  const value = args[key];
  if (typeof value !== 'string') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${key} must be a number, got "${value}"`);
  return parsed;
}

export function requireAddress(value: string, label: string): Address {
  if (!isAddress(value)) throw new Error(`${label} is not a valid address: ${value}`);
  return getAddress(value);
}

export function envAddress(key: string): Address {
  const raw = process.env[key];
  if (!raw) throw new Error(`Missing ${key} in environment (see .env.example)`);
  return requireAddress(raw, key);
}

/**
 * A public client for an arbitrary EVM chain. The chain id is read from the RPC
 * rather than hardcoded, so the same tool works on mainnet and every L2.
 */
export async function getPublicClient(): Promise<{ client: PublicClient; chainId: number }> {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('Missing RPC_URL in environment (see .env.example)');

  const bootstrap = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await bootstrap.getChainId();
  const chain = defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  return { client: createPublicClient({ chain, transport: http(rpcUrl) }), chainId };
}

/** Wallet client whose derived address must match REFUND_FROM, so a wrong key aborts loudly. */
export async function getWalletClient(expectedFrom: Address) {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error('PRIVATE_KEY is not set — required to broadcast transactions');

  const normalized = key.startsWith('0x') ? key : `0x${key}`;
  const account = privateKeyToAccount(normalized as `0x${string}`);
  if (getAddress(account.address) !== getAddress(expectedFrom)) {
    throw new Error(
      `PRIVATE_KEY derives ${account.address} but REFUND_FROM is ${expectedFrom}. Refusing to send.`,
    );
  }

  const rpcUrl = process.env.RPC_URL!;
  const { chainId } = await getPublicClient();
  const chain = defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  return createWalletClient({ account, chain, transport: http(rpcUrl) });
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}

export function eth(wei: bigint): string {
  return `${formatEther(wei)} ETH`;
}

/** Runs `worker` over `items` with bounded concurrency, preserving input order. */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index] as T, index);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a call with exponential backoff. Providers rate-limit aggressively on
 * historical log queries, and a transient 429 should not kill a long index run.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5, baseDelayMs = 500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  const escape = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  return `${rows.map((row) => row.map(escape).join(',')).join('\n')}\n`;
}

export interface MintTx {
  txHash: string;
  blockNumber: string;
  /** The address that sent the mint transaction and paid the ETH. */
  payer: Address;
  /** Direct call target. When this is not the collection, the mint was routed. */
  calledContract: Address | null;
  valueWei: string;
  /** Recipients of minted tokens in this tx, with quantity each. */
  receivers: { address: Address; quantity: string }[];
  /** Value did not go straight to the collection — may include marketplace fees. */
  routed: boolean;
}

export interface Ledger {
  chainId: number;
  contract: Address;
  fromBlock: string;
  toBlock: string;
  standard: string;
  mintTxCount: number;
  totalValueWei: string;
  transactions: MintTx[];
}

export interface RefundEntry {
  address: Address;
  amountWei: string;
  amountEth: string;
  mintTxCount: number;
  isContract: boolean;
}

export interface ExcludedEntry {
  address: Address;
  amountWei: string;
  reason: string;
}

export interface Plan {
  chainId: number;
  contract: Address;
  refundFrom: Address;
  refundTo: 'payer' | 'receiver';
  generatedAt: string;
  recipientCount: number;
  totalWei: string;
  totalEth: string;
  refunds: RefundEntry[];
  excluded: ExcludedEntry[];
}
