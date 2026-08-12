/**
 * Step 3 — execute the refunds.
 *
 * Dry-run by default; nothing is broadcast without --execute. Every confirmed send
 * is written to the state file before the next one starts, so a crashed or
 * interrupted run resumes without ever paying an address twice.
 *
 *   npm run send                          # dry run
 *   npm run send -- --execute             # one tx per recipient
 *   npm run send -- --execute --mode disperse --disperse-address 0x...
 */
import { encodeFunctionData, getAddress, keccak256, parseAbi, toHex, type Address } from 'viem';
import {
  eth,
  fileExists,
  getPublicClient,
  getWalletClient,
  optionalNumber,
  parseArgs,
  readJson,
  writeJson,
  type Plan,
} from './lib.js';

const DISPERSE_ABI = parseAbi([
  'function disperseEther(address[] recipients, uint256[] values) payable',
]);

type SendStatus = 'pending' | 'sent' | 'failed';

interface StateEntry {
  amountWei: string;
  status: SendStatus;
  txHash?: string;
  error?: string;
  at?: string;
}

interface State {
  chainId: number;
  refundFrom: Address;
  planHash: string;
  entries: Record<string, StateEntry>;
}

function hashPlan(plan: Plan): string {
  const canonical = plan.refunds
    .map((refund) => `${refund.address.toLowerCase()}:${refund.amountWei}`)
    .sort()
    .join('|');
  return keccak256(toHex(canonical));
}

function loadState(path: string, plan: Plan, planHash: string): State {
  if (!fileExists(path)) {
    return {
      chainId: plan.chainId,
      refundFrom: plan.refundFrom,
      planHash,
      entries: Object.fromEntries(
        plan.refunds.map((refund) => [
          refund.address.toLowerCase(),
          { amountWei: refund.amountWei, status: 'pending' as SendStatus },
        ]),
      ),
    };
  }

  const state = readJson<State>(path);
  if (state.planHash !== planHash) {
    throw new Error(
      `${path} was created for a different plan. The refund list or amounts changed.\n` +
        'Delete the state file only if you are certain no refunds were sent under the old plan —\n' +
        'otherwise reconcile the sent entries by hand first.',
    );
  }

  // Carry over any recipients added since the state file was written.
  for (const refund of plan.refunds) {
    const key = refund.address.toLowerCase();
    if (!state.entries[key]) {
      state.entries[key] = { amountWei: refund.amountWei, status: 'pending' };
    }
  }
  return state;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const planPath = typeof args.plan === 'string' ? args.plan : 'data/plan.json';
  const statePath = typeof args.state === 'string' ? args.state : 'data/state.json';
  const execute = args.execute === true;
  const mode = (typeof args.mode === 'string' ? args.mode : 'sequential').toLowerCase();
  const batchSize = optionalNumber(args, 'batch-size', 100);
  const confirmations = optionalNumber(args, 'confirmations', 1);
  const limit = optionalNumber(args, 'limit', Number.POSITIVE_INFINITY);
  const stopOnError = args['stop-on-error'] === true;

  if (mode !== 'sequential' && mode !== 'disperse') {
    throw new Error('--mode must be "sequential" or "disperse"');
  }

  const plan = readJson<Plan>(planPath);
  const planHash = hashPlan(plan);
  const state = loadState(statePath, plan, planHash);

  const { client, chainId } = await getPublicClient();
  if (chainId !== plan.chainId) {
    throw new Error(`RPC_URL is chain ${chainId} but the plan targets chain ${plan.chainId}.`);
  }

  const pending = plan.refunds.filter(
    (refund) => state.entries[refund.address.toLowerCase()]?.status !== 'sent',
  );
  const targets = Number.isFinite(limit) ? pending.slice(0, limit) : pending;

  const alreadySent = plan.refunds.length - pending.length;
  const outstandingWei = targets.reduce((sum, refund) => sum + BigInt(refund.amountWei), 0n);
  const balance = await client.getBalance({ address: plan.refundFrom });

  const fees = await client.estimateFeesPerGas();
  const gasPrice = fees.maxFeePerGas ?? fees.gasPrice ?? 0n;
  const txCount = mode === 'sequential' ? targets.length : chunk(targets, batchSize).length;
  const gasPerTx = mode === 'sequential' ? 21_000n : BigInt(35_000 + batchSize * 30_000);
  const estimatedGasWei = gasPrice * gasPerTx * BigInt(txCount);

  process.stdout.write(
    [
      '',
      '─'.repeat(64),
      `Mode              : ${mode}${execute ? '' : '  (DRY RUN — nothing will be broadcast)'}`,
      `From              : ${plan.refundFrom}`,
      `Chain             : ${chainId}`,
      `Already refunded  : ${alreadySent}`,
      `To send now       : ${targets.length} recipients`,
      `Value             : ${eth(outstandingWei)}`,
      `Est. gas          : ~${eth(estimatedGasWei)} across ${txCount} transaction(s)`,
      `Wallet balance    : ${eth(balance)}`,
      '─'.repeat(64),
      '',
    ].join('\n'),
  );

  if (targets.length === 0) {
    process.stdout.write('Nothing pending — every recipient in the plan is already marked sent.\n\n');
    return;
  }

  if (balance < outstandingWei + estimatedGasWei) {
    const short = outstandingWei + estimatedGasWei - balance;
    process.stdout.write(
      `⚠️  Balance is short by ~${eth(short)} including gas.\n` +
        '   Top up, or use --limit N to refund in affordable slices.\n\n',
    );
    if (execute) throw new Error('Refusing to start a run the wallet cannot finish.');
  }

  if (!execute) {
    const preview = targets.slice(0, 10);
    process.stdout.write('First recipients:\n');
    for (const refund of preview) {
      process.stdout.write(
        `  ${refund.address}  ${refund.amountEth} ETH${refund.isContract ? '  [contract]' : ''}\n`,
      );
    }
    if (targets.length > preview.length) {
      process.stdout.write(`  ... and ${targets.length - preview.length} more\n`);
    }
    process.stdout.write('\nRe-run with --execute to broadcast.\n\n');
    return;
  }

  const wallet = await getWalletClient(plan.refundFrom);
  const persist = () => writeJson(statePath, state);

  const markSent = (address: Address, txHash: string) => {
    const entry = state.entries[address.toLowerCase()]!;
    entry.status = 'sent';
    entry.txHash = txHash;
    entry.at = new Date().toISOString();
    delete entry.error;
    persist();
  };

  const markFailed = (address: Address, error: unknown) => {
    const entry = state.entries[address.toLowerCase()]!;
    entry.status = 'failed';
    entry.error = error instanceof Error ? error.message : String(error);
    entry.at = new Date().toISOString();
    persist();
  };

  let sentCount = 0;
  let failedCount = 0;

  if (mode === 'sequential') {
    for (const [index, refund] of targets.entries()) {
      const to = getAddress(refund.address);
      const value = BigInt(refund.amountWei);
      const label = `[${index + 1}/${targets.length}] ${to} ${refund.amountEth} ETH`;

      try {
        const hash = await wallet.sendTransaction({ to, value });
        const receipt = await client.waitForTransactionReceipt({ hash, confirmations });
        if (receipt.status !== 'success') throw new Error(`reverted in ${hash}`);

        markSent(to, hash);
        sentCount++;
        process.stdout.write(`${label}  ✓ ${hash}\n`);
      } catch (error) {
        markFailed(to, error);
        failedCount++;
        process.stdout.write(
          `${label}  ✗ ${error instanceof Error ? error.message.split('\n')[0] : String(error)}\n`,
        );
        if (stopOnError) break;
      }
    }
  } else {
    const disperseArg = args['disperse-address'];
    if (typeof disperseArg !== 'string') {
      throw new Error('--mode disperse requires --disperse-address 0x... (verify it on the explorer first)');
    }
    const disperse = getAddress(disperseArg);
    const code = await client.getCode({ address: disperse });
    if (!code || code === '0x') {
      throw new Error(`No contract code at ${disperse} on chain ${chainId}.`);
    }

    const batches = chunk(targets, batchSize);
    for (const [index, batch] of batches.entries()) {
      const recipients = batch.map((refund) => getAddress(refund.address));
      const values = batch.map((refund) => BigInt(refund.amountWei));
      const total = values.reduce((sum, value) => sum + value, 0n);
      const label = `[batch ${index + 1}/${batches.length}] ${batch.length} recipients, ${eth(total)}`;

      try {
        // Simulate first — one reverting recipient would otherwise burn the whole batch's gas.
        await client.call({
          account: wallet.account,
          to: disperse,
          value: total,
          data: encodeFunctionData({
            abi: DISPERSE_ABI,
            functionName: 'disperseEther',
            args: [recipients, values],
          }),
        });

        const hash = await wallet.writeContract({
          address: disperse,
          abi: DISPERSE_ABI,
          functionName: 'disperseEther',
          args: [recipients, values],
          value: total,
        });
        const receipt = await client.waitForTransactionReceipt({ hash, confirmations });
        if (receipt.status !== 'success') throw new Error(`reverted in ${hash}`);

        for (const recipient of recipients) markSent(recipient, hash);
        sentCount += batch.length;
        process.stdout.write(`${label}  ✓ ${hash}\n`);
      } catch (error) {
        for (const recipient of recipients) markFailed(recipient, error);
        failedCount += batch.length;
        process.stdout.write(
          `${label}  ✗ ${error instanceof Error ? error.message.split('\n')[0] : String(error)}\n`,
        );
        if (stopOnError) break;
      }
    }
  }

  const remaining = plan.refunds.filter(
    (refund) => state.entries[refund.address.toLowerCase()]?.status !== 'sent',
  ).length;

  process.stdout.write(
    [
      '',
      '─'.repeat(64),
      `Sent this run     : ${sentCount}`,
      `Failed this run   : ${failedCount}`,
      `Still outstanding : ${remaining}`,
      `State file        : ${statePath}`,
      '─'.repeat(64),
      remaining > 0 ? '\nRe-run the same command to retry the remainder — sent entries are skipped.\n' : '\nAll refunds complete.\n',
    ].join('\n'),
  );
}

main().catch((error) => {
  process.stderr.write(`\nFailed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
