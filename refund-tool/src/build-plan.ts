/**
 * Step 2 — turn the ledger into a refund plan.
 *
 * Aggregates ETH paid per address, applies exclusions, flags anything that needs a
 * human look, and writes plan.json plus two CSVs (a readable one and a Safe
 * Transaction Builder import).
 *
 *   npm run plan -- --ledger data/ledger.json
 */
import { formatEther, getAddress, type Address } from 'viem';
import {
  ZERO_ADDRESS,
  envAddress,
  eth,
  getPublicClient,
  mapPool,
  optionalNumber,
  parseArgs,
  readJson,
  toCsv,
  withRetry,
  writeJson,
  writeText,
  type ExcludedEntry,
  type Ledger,
  type Plan,
  type RefundEntry,
} from './lib.js';

async function main(): Promise<void> {
  const args = parseArgs();
  const ledgerPath = typeof args.ledger === 'string' ? args.ledger : 'data/ledger.json';
  const outDir = typeof args['out-dir'] === 'string' ? args['out-dir'] : 'data';
  const refundTo = (typeof args['refund-to'] === 'string' ? args['refund-to'] : 'payer') as
    | 'payer'
    | 'receiver';
  const minWei = BigInt(typeof args['min-wei'] === 'string' ? args['min-wei'] : '0');
  const maxWeiArg = typeof args['max-wei'] === 'string' ? BigInt(args['max-wei']) : null;
  const includeRouted = args['include-routed'] === true;
  const excludeContracts = args['exclude-contracts'] === true;
  const concurrency = optionalNumber(args, 'concurrency', 8);

  if (refundTo !== 'payer' && refundTo !== 'receiver') {
    throw new Error('--refund-to must be "payer" or "receiver"');
  }

  const ledger = readJson<Ledger>(ledgerPath);
  const refundFrom = envAddress('REFUND_FROM');
  const { client, chainId } = await getPublicClient();

  if (chainId !== ledger.chainId) {
    throw new Error(
      `RPC_URL points at chain ${chainId} but the ledger was indexed on chain ${ledger.chainId}.`,
    );
  }

  const totals = new Map<Address, { wei: bigint; txCount: number }>();
  const excluded: ExcludedEntry[] = [];

  const credit = (address: Address, wei: bigint) => {
    const current = totals.get(address) ?? { wei: 0n, txCount: 0 };
    totals.set(address, { wei: current.wei + wei, txCount: current.txCount + 1 });
  };

  let skippedRoutedWei = 0n;
  let skippedRoutedCount = 0;

  for (const tx of ledger.transactions) {
    const value = BigInt(tx.valueWei);
    if (value === 0n) continue;

    if (tx.routed && !includeRouted) {
      skippedRoutedWei += value;
      skippedRoutedCount++;
      excluded.push({
        address: tx.payer,
        amountWei: value.toString(),
        reason: `routed mint via ${tx.calledContract ?? 'contract creation'} in ${tx.txHash} — value may include marketplace fees; re-run with --include-routed to pay it`,
      });
      continue;
    }

    if (refundTo === 'payer') {
      credit(tx.payer, value);
      continue;
    }

    // Receiver mode: split the transaction's ETH across token recipients pro-rata by
    // quantity, giving any integer-division remainder to the first recipient.
    const quantities = tx.receivers.map((r) => BigInt(r.quantity));
    const totalQuantity = quantities.reduce((sum, q) => sum + q, 0n);
    if (totalQuantity === 0n) continue;

    let distributed = 0n;
    tx.receivers.forEach((receiver, index) => {
      const share =
        index === tx.receivers.length - 1
          ? value - distributed
          : (value * (quantities[index] as bigint)) / totalQuantity;
      distributed += share;
      credit(getAddress(receiver.address), share);
    });
  }

  // Drop addresses that must never receive a refund.
  for (const [address, entry] of [...totals]) {
    let reason: string | null = null;
    if (address === ZERO_ADDRESS) reason = 'zero address';
    else if (getAddress(address) === refundFrom) reason = 'is the refund wallet itself';
    else if (entry.wei < minWei) reason = `below --min-wei dust threshold (${entry.wei} wei)`;
    else if (maxWeiArg !== null && entry.wei > maxWeiArg) {
      reason = `exceeds --max-wei safety cap (${eth(entry.wei)}) — verify before paying`;
    }

    if (reason) {
      excluded.push({ address, amountWei: entry.wei.toString(), reason });
      totals.delete(address);
    }
  }

  const addresses = [...totals.keys()];
  process.stdout.write(`Checking ${addresses.length} recipients for contract code...\n`);

  const codeFlags = await mapPool(addresses, concurrency, async (address) => {
    const code = await withRetry(() => client.getCode({ address }));
    return Boolean(code && code !== '0x');
  });

  const refunds: RefundEntry[] = [];
  addresses.forEach((address, index) => {
    const entry = totals.get(address)!;
    const isContract = codeFlags[index] === true;

    if (isContract && excludeContracts) {
      excluded.push({
        address,
        amountWei: entry.wei.toString(),
        reason: 'recipient is a contract and --exclude-contracts was set',
      });
      return;
    }

    refunds.push({
      address,
      amountWei: entry.wei.toString(),
      amountEth: formatEther(entry.wei),
      mintTxCount: entry.txCount,
      isContract,
    });
  });

  refunds.sort((a, b) => (BigInt(b.amountWei) > BigInt(a.amountWei) ? 1 : -1));

  const totalWei = refunds.reduce((sum, refund) => sum + BigInt(refund.amountWei), 0n);
  const contractCount = refunds.filter((refund) => refund.isContract).length;

  const plan: Plan = {
    chainId,
    contract: ledger.contract,
    refundFrom,
    refundTo,
    generatedAt: new Date().toISOString(),
    recipientCount: refunds.length,
    totalWei: totalWei.toString(),
    totalEth: formatEther(totalWei),
    refunds,
    excluded,
  };

  const planPath = `${outDir}/plan.json`;
  writeJson(planPath, plan);

  writeText(
    `${outDir}/plan.csv`,
    toCsv([
      ['address', 'amount_eth', 'amount_wei', 'mint_tx_count', 'is_contract'],
      ...refunds.map((refund) => [
        refund.address,
        refund.amountEth,
        refund.amountWei,
        String(refund.mintTxCount),
        String(refund.isContract),
      ]),
    ]),
  );

  // Safe Transaction Builder CSV: one native-transfer row per recipient.
  writeText(
    `${outDir}/safe-transaction-builder.csv`,
    toCsv([
      ['token_type', 'token_address', 'receiver', 'amount', 'id'],
      ...refunds.map((refund) => ['native', '', refund.address, refund.amountEth, '']),
    ]),
  );

  const balance = await client.getBalance({ address: refundFrom });

  process.stdout.write(
    [
      '',
      '─'.repeat(64),
      `Refund basis      : ${refundTo === 'payer' ? 'address that sent the mint tx' : 'address that received the token'}`,
      `Recipients        : ${refunds.length}`,
      `Total to refund   : ${eth(totalWei)}`,
      `Wallet balance    : ${eth(balance)}`,
      `Contract wallets  : ${contractCount} (verify these can receive ETH)`,
      `Excluded entries  : ${excluded.length}`,
      skippedRoutedCount > 0
        ? `  ↳ routed mints  : ${skippedRoutedCount} worth ${eth(skippedRoutedWei)} — review, then --include-routed`
        : '  ↳ routed mints  : none',
      '─'.repeat(64),
      balance < totalWei
        ? `\n⚠️  Wallet is short by ${eth(totalWei - balance)} before gas. Top it up or split the run.\n`
        : `\n✅ Balance covers the refunds (${eth(balance - totalWei)} spare for gas).\n`,
      `Wrote ${planPath}, ${outDir}/plan.csv, ${outDir}/safe-transaction-builder.csv`,
      '',
      'Review plan.csv line by line, then dry-run:  npm run send',
      '',
    ].join('\n'),
  );
}

main().catch((error) => {
  process.stderr.write(`\nFailed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
