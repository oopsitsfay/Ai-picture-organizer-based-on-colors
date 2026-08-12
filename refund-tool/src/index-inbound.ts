/**
 * Step 1, alternative — build the ledger from inbound payments to the wallet.
 *
 * Use this when mint fees were paid straight to the treasury address rather than
 * through an NFT contract, so there are no Transfer events to scan. It enumerates
 * every successful incoming ETH transfer via the chain's Blockscout API and
 * attributes each one to its sender.
 *
 *   npm run index:inbound
 *   npm run index:inbound -- --address 0xTreasury --from-block 1234567
 *
 * Output is the same ledger shape index-mints.ts produces, so build-plan.ts and
 * send.ts work against it unchanged.
 */
import { formatEther, getAddress, parseEther, type Address } from 'viem';
import {
  envAddress,
  eth,
  getPublicClient,
  optionalNumber,
  parseArgs,
  requireAddress,
  sleep,
  withRetry,
  writeJson,
  type Ledger,
  type MintTx,
} from './lib.js';

interface BlockscoutTx {
  hash: string;
  from?: { hash?: string } | null;
  to?: { hash?: string } | null;
  value?: string | null;
  status?: string | null;
  result?: string | null;
  block_number?: number | null;
  timestamp?: string | null;
}

interface BlockscoutPage {
  items?: BlockscoutTx[];
  next_page_params?: Record<string, unknown> | null;
}

function isSuccessful(tx: BlockscoutTx): boolean {
  // Blockscout v2 reports "ok"/"error" in `status` and "success"/a revert reason in
  // `result`. Treat a tx as successful only when nothing says otherwise.
  if (tx.status && tx.status !== 'ok') return false;
  if (tx.result && tx.result.toLowerCase() !== 'success') return false;
  return true;
}

async function fetchPage(url: string): Promise<BlockscoutPage> {
  return withRetry(async () => {
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`explorer returned ${response.status} ${response.statusText} for ${url}`);
    }
    return (await response.json()) as BlockscoutPage;
  });
}

async function main(): Promise<void> {
  const args = parseArgs();
  const address = typeof args.address === 'string'
    ? requireAddress(args.address, '--address')
    : envAddress('REFUND_FROM');

  const explorerBase = (
    typeof args.explorer === 'string'
      ? args.explorer
      : process.env.EXPLORER_API ?? 'https://robinhoodchain.blockscout.com'
  ).replace(/\/+$/, '');

  const fromBlock = typeof args['from-block'] === 'string' ? BigInt(args['from-block']) : 0n;
  const toBlock = typeof args['to-block'] === 'string' ? BigInt(args['to-block']) : null;
  // Qualifying-payment filters. `--exact-eth` takes one or more accepted amounts
  // ("0.001,0.002") so a mint whose price changed, or had tiers, is handled in one
  // pass. Each wallet is still refunded exactly what it sent unless build-plan is
  // run with --flat-eth.
  const exactWeiSet =
    typeof args['exact-eth'] === 'string'
      ? args['exact-eth']
          .split(',')
          .map((part) => part.trim())
          .filter((part) => part.length > 0)
          .map((part) => parseEther(part))
      : null;
  const minWei = typeof args['min-eth'] === 'string' ? parseEther(args['min-eth']) : null;
  const maxWei = typeof args['max-eth'] === 'string' ? parseEther(args['max-eth']) : null;

  // Recency window. `--since-days 30` keeps the last 30 days; `--since 2026-07-01`
  // takes an explicit cutoff. Payments older than the cutoff are dropped.
  let sinceMs: number | null = null;
  if (typeof args['since-days'] === 'string') {
    sinceMs = Date.now() - Number(args['since-days']) * 86_400_000;
    if (!Number.isFinite(sinceMs)) throw new Error('--since-days must be a number');
  } else if (typeof args.since === 'string') {
    const parsed = Date.parse(args.since);
    if (Number.isNaN(parsed)) throw new Error(`--since is not a valid date: ${args.since}`);
    sinceMs = parsed;
  }

  const maxPages = optionalNumber(args, 'max-pages', 1000);
  const pauseMs = optionalNumber(args, 'pause-ms', 120);
  const out = typeof args.out === 'string' ? args.out : 'data/ledger.json';

  const { chainId } = await getPublicClient();

  process.stdout.write(
    [
      '',
      `Chain    : ${chainId}`,
      `Wallet   : ${address}`,
      `Explorer : ${explorerBase}`,
      `Filter   : ${
        exactWeiSet !== null
          ? `payments of exactly ${exactWeiSet.map((v) => formatEther(v)).join(' or ')} ETH`
          : minWei !== null || maxWei !== null
            ? `payments between ${minWei !== null ? formatEther(minWei) : '0'} and ${maxWei !== null ? formatEther(maxWei) : '∞'} ETH`
            : 'every non-zero payment'
      }`,
      `Window   : ${sinceMs !== null ? `payments since ${new Date(sinceMs).toISOString()}` : 'all history'}`,
      `Reading inbound ETH transfers...`,
      '',
    ].join('\n'),
  );

  const transactions: MintTx[] = [];
  const seen = new Set<string>();
  let nextParams: Record<string, unknown> | null | undefined = null;
  let page = 0;
  let skippedFailed = 0;
  let skippedZero = 0;
  let skippedOutgoing = 0;
  let skippedAmount = 0;
  let skippedOld = 0;
  let undatedKept = 0;
  let reachedCutoff = false;
  /** value in wei -> how many payments of exactly that amount arrived */
  const distribution = new Map<string, number>();

  while (page < maxPages) {
    const query = new URLSearchParams({ filter: 'to' });
    for (const [key, value] of Object.entries(nextParams ?? {})) {
      if (value !== null && value !== undefined) query.set(key, String(value));
    }

    const url = `${explorerBase}/api/v2/addresses/${address}/transactions?${query.toString()}`;
    const data: BlockscoutPage = await fetchPage(url);
    const items = data.items ?? [];
    page++;

    for (const tx of items) {
      const from = tx.from?.hash;
      const to = tx.to?.hash;
      const value = BigInt(tx.value ?? '0');
      const blockNumber = BigInt(tx.block_number ?? 0);

      // `filter=to` should already exclude these, but the ledger decides who gets
      // paid — verify rather than trust.
      if (!from || !to || getAddress(to) !== address) {
        skippedOutgoing++;
        continue;
      }
      if (getAddress(from) === address) {
        skippedOutgoing++;
        continue;
      }
      if (!isSuccessful(tx)) {
        skippedFailed++;
        continue;
      }
      if (value === 0n) {
        skippedZero++;
        continue;
      }
      // Record every real payment before filtering, so the distribution report can
      // show what was actually paid even when a filter is narrowing the result.
      const key = value.toString();
      distribution.set(key, (distribution.get(key) ?? 0) + 1);

      if (exactWeiSet !== null && !exactWeiSet.some((accepted) => accepted === value)) {
        skippedAmount++;
        continue;
      }
      if (minWei !== null && value < minWei) {
        skippedAmount++;
        continue;
      }
      if (maxWei !== null && value > maxWei) {
        skippedAmount++;
        continue;
      }
      if (sinceMs !== null) {
        const ts = tx.timestamp ? Date.parse(tx.timestamp) : NaN;
        if (Number.isNaN(ts)) {
          // No usable timestamp: keep it rather than silently dropping a real payer,
          // and surface the count so the gap is visible.
          undatedKept++;
        } else if (ts < sinceMs) {
          skippedOld++;
          // Blockscout returns newest first, so everything after this is older too.
          reachedCutoff = true;
          continue;
        }
      }
      if (blockNumber < fromBlock) continue;
      if (toBlock !== null && blockNumber > toBlock) continue;
      if (seen.has(tx.hash)) continue;
      seen.add(tx.hash);

      const payer = getAddress(from) as Address;
      transactions.push({
        txHash: tx.hash,
        blockNumber: blockNumber.toString(),
        payer,
        calledContract: address,
        valueWei: value.toString(),
        ...(tx.timestamp ? { timestamp: tx.timestamp } : {}),
        receivers: [{ address: payer, quantity: '1' }],
        routed: false,
      });
    }

    process.stdout.write(`  page ${page}: ${items.length} txs, ${transactions.length} payments kept\n`);

    nextParams = data.next_page_params;
    if (reachedCutoff) {
      process.stdout.write('  reached the --since cutoff, stopping pagination\n');
      break;
    }
    if (!nextParams || items.length === 0) break;
    await sleep(pauseMs);
  }

  if (page >= maxPages && nextParams) {
    process.stdout.write(
      `\n⚠️  Stopped at the --max-pages limit (${maxPages}) with more history available.\n` +
        `   The ledger is INCOMPLETE — raise --max-pages and re-run before refunding.\n`,
    );
  }

  const renderDistribution = (limit = 15): string => {
    const rows = [...distribution.entries()]
      .sort((a, b) => b[1] - a[1] || (BigInt(b[0]) > BigInt(a[0]) ? 1 : -1))
      .slice(0, limit);
    const width = Math.max(...rows.map(([wei]) => formatEther(BigInt(wei)).length), 6);
    const lines = rows.map(
      ([wei, count]) => `  ${formatEther(BigInt(wei)).padStart(width)} ETH  ×${count}`,
    );
    if (distribution.size > rows.length) {
      lines.push(`  ... and ${distribution.size - rows.length} other distinct amounts`);
    }
    return lines.join('\n');
  };

  if (transactions.length === 0) {
    if (distribution.size > 0) {
      throw new Error(
        'No payments matched the amount filter, but the wallet did receive ETH.\n' +
          'Amounts actually received:\n' +
          `${renderDistribution()}\n\n` +
          'Re-run with --exact-eth set to one of these (comma-separate to accept several),\n' +
          'or drop the filter entirely to include every payment.',
      );
    }
    throw new Error(
      'No inbound ETH payments found. Check --address and --explorer, or use ' +
        '`npm run index` instead if the mint went through an NFT contract.',
    );
  }

  transactions.sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)));

  const totalValue = transactions.reduce((sum, tx) => sum + BigInt(tx.valueWei), 0n);
  const uniquePayers = new Set(transactions.map((tx) => tx.payer)).size;

  const ledger: Ledger = {
    chainId,
    contract: address,
    fromBlock: fromBlock.toString(),
    toBlock: (toBlock ?? BigInt(transactions[transactions.length - 1]!.blockNumber)).toString(),
    standard: 'inbound-eth',
    mintTxCount: transactions.length,
    totalValueWei: totalValue.toString(),
    transactions,
  };

  writeJson(out, ledger);

  process.stdout.write(
    [
      '',
      '─'.repeat(64),
      `Payments found    : ${transactions.length}`,
      `Unique payers     : ${uniquePayers}`,
      `Total received    : ${eth(totalValue)}`,
      `Skipped (failed)  : ${skippedFailed}`,
      `Skipped (0 value) : ${skippedZero}`,
      `Skipped (not in)  : ${skippedOutgoing}`,
      `Skipped (amount)  : ${skippedAmount}`,
      `Skipped (too old) : ${skippedOld}`,
      ...(undatedKept > 0 ? [`Kept, undated     : ${undatedKept} (no timestamp from explorer)`] : []),
      `Ledger written to : ${out}`,
      '─'.repeat(64),
      '',
      'Payment amounts received by this wallet (before the amount filter):',
      renderDistribution(),
      '',
      '⚠️  This counts direct transactions only. ETH arriving via a contract',
      '   (an internal transaction) is not included — cross-check the total',
      '   against the wallet balance on the explorer before refunding.',
      '',
      `Next: npm run plan -- --ledger ${out}`,
      '',
    ].join('\n'),
  );
}

main().catch((error) => {
  process.stderr.write(`\nFailed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
