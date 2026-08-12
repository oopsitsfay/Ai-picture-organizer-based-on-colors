/**
 * Step 1 — build the ledger.
 *
 * Scans the collection for mint events (Transfer / TransferSingle / TransferBatch
 * originating from the zero address), then resolves each mint transaction to the
 * address that paid and how much ETH it sent.
 *
 *   npm run index -- --contract 0xCollection --from-block auto
 */
import { getAddress, parseAbiItem, type Address, type PublicClient } from 'viem';
import {
  ZERO_ADDRESS,
  eth,
  getPublicClient,
  mapPool,
  optionalNumber,
  parseArgs,
  requireAddress,
  requireString,
  withRetry,
  writeJson,
  type Ledger,
  type MintTx,
} from './lib.js';

const ERC721_TRANSFER = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
);
const ERC1155_SINGLE = parseAbiItem(
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
);
const ERC1155_BATCH = parseAbiItem(
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
);

interface RawMint {
  txHash: string;
  blockNumber: bigint;
  receiver: Address;
  quantity: bigint;
}

/**
 * Binary-searches for the block where the contract first has bytecode. Requires an
 * archive node; callers fall back to an explicit --from-block when this fails.
 */
async function findDeployBlock(client: PublicClient, contract: Address): Promise<bigint> {
  const latest = await client.getBlockNumber();

  const codeAt = async (blockNumber: bigint) => {
    const code = await withRetry(() => client.getCode({ address: contract, blockNumber }));
    return Boolean(code && code !== '0x');
  };

  if (!(await codeAt(latest))) {
    throw new Error(`No contract code at ${contract} on the latest block — wrong address or chain?`);
  }

  let low = 0n;
  let high = latest;
  while (low < high) {
    const mid = (low + high) / 2n;
    if (await codeAt(mid)) high = mid;
    else low = mid + 1n;
  }
  return low;
}

/** getLogs over a block range, halving the window whenever a provider rejects the span. */
async function getLogsChunked(
  client: PublicClient,
  contract: Address,
  event: typeof ERC721_TRANSFER | typeof ERC1155_SINGLE | typeof ERC1155_BATCH,
  fromBlock: bigint,
  toBlock: bigint,
  initialSpan: bigint,
): Promise<any[]> {
  const collected: any[] = [];
  let cursor = fromBlock;
  let span = initialSpan;

  while (cursor <= toBlock) {
    const end = cursor + span - 1n > toBlock ? toBlock : cursor + span - 1n;
    try {
      const logs = await withRetry(
        () =>
          client.getLogs({
            address: contract,
            event: event as any,
            args: { from: ZERO_ADDRESS } as any,
            fromBlock: cursor,
            toBlock: end,
          }),
        3,
      );
      collected.push(...logs);
      cursor = end + 1n;
      // Creep the window back up after a success so one bad range does not slow the whole scan.
      if (span < initialSpan) span *= 2n;
    } catch (error) {
      if (span <= 1n) throw error;
      span /= 2n;
      process.stderr.write(`  range too large near block ${cursor}, retrying with span ${span}\n`);
    }
  }

  return collected;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const contract = requireAddress(requireString(args, 'contract'), '--contract');
  const standard = (typeof args.standard === 'string' ? args.standard : 'auto').toLowerCase();
  const span = BigInt(optionalNumber(args, 'block-span', 2000));
  const concurrency = optionalNumber(args, 'concurrency', 8);
  const out = typeof args.out === 'string' ? args.out : 'data/ledger.json';

  const { client, chainId } = await getPublicClient();
  const latest = await client.getBlockNumber();

  let fromBlock: bigint;
  const fromArg = args['from-block'];
  if (typeof fromArg === 'string' && fromArg !== 'auto') {
    fromBlock = BigInt(fromArg);
  } else {
    process.stdout.write('Locating contract deploy block...\n');
    fromBlock = await findDeployBlock(client, contract);
    process.stdout.write(`  deployed at block ${fromBlock}\n`);
  }

  const toBlock = typeof args['to-block'] === 'string' ? BigInt(args['to-block']) : latest;

  process.stdout.write(
    `\nChain ${chainId} | collection ${contract}\nScanning blocks ${fromBlock} → ${toBlock}\n\n`,
  );

  const raw: RawMint[] = [];

  if (standard === 'auto' || standard === 'erc721') {
    process.stdout.write('Scanning ERC-721 Transfer mints...\n');
    const logs = await getLogsChunked(client, contract, ERC721_TRANSFER, fromBlock, toBlock, span);
    for (const log of logs) {
      raw.push({
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        receiver: getAddress(log.args.to),
        quantity: 1n,
      });
    }
    process.stdout.write(`  ${logs.length} ERC-721 mint events\n`);
  }

  if (standard === 'auto' || standard === 'erc1155') {
    process.stdout.write('Scanning ERC-1155 mints...\n');
    const singles = await getLogsChunked(client, contract, ERC1155_SINGLE, fromBlock, toBlock, span);
    for (const log of singles) {
      raw.push({
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        receiver: getAddress(log.args.to),
        quantity: log.args.value as bigint,
      });
    }

    const batches = await getLogsChunked(client, contract, ERC1155_BATCH, fromBlock, toBlock, span);
    for (const log of batches) {
      const values = log.args.values as bigint[];
      const total = values.reduce((sum, value) => sum + value, 0n);
      raw.push({
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        receiver: getAddress(log.args.to),
        quantity: total,
      });
    }
    process.stdout.write(`  ${singles.length} TransferSingle, ${batches.length} TransferBatch\n`);
  }

  if (raw.length === 0) {
    throw new Error(
      'No mint events found. Check --contract, --from-block, and that --standard matches the collection.',
    );
  }

  // Group mint events by transaction — one tx can mint several tokens, and the ETH
  // it paid belongs to the transaction, not to each individual token.
  const byTx = new Map<string, RawMint[]>();
  for (const mint of raw) {
    const bucket = byTx.get(mint.txHash);
    if (bucket) bucket.push(mint);
    else byTx.set(mint.txHash, [mint]);
  }

  const hashes = [...byTx.keys()];
  process.stdout.write(`\nResolving ${hashes.length} mint transactions...\n`);

  let done = 0;
  const transactions = await mapPool(hashes, concurrency, async (hash) => {
    const tx = await withRetry(() => client.getTransaction({ hash: hash as `0x${string}` }));
    const mints = byTx.get(hash)!;

    // Merge repeat receivers inside the same transaction.
    const receiverTotals = new Map<Address, bigint>();
    for (const mint of mints) {
      receiverTotals.set(mint.receiver, (receiverTotals.get(mint.receiver) ?? 0n) + mint.quantity);
    }

    const calledContract = tx.to ? getAddress(tx.to) : null;
    const entry: MintTx = {
      txHash: hash,
      blockNumber: (mints[0] as RawMint).blockNumber.toString(),
      payer: getAddress(tx.from),
      calledContract,
      valueWei: tx.value.toString(),
      receivers: [...receiverTotals].map(([address, quantity]) => ({
        address,
        quantity: quantity.toString(),
      })),
      routed: calledContract === null || calledContract !== contract,
    };

    done++;
    if (done % 50 === 0) process.stdout.write(`  ${done}/${hashes.length}\n`);
    return entry;
  });

  transactions.sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)));

  const totalValue = transactions.reduce((sum, tx) => sum + BigInt(tx.valueWei), 0n);
  const routedCount = transactions.filter((tx) => tx.routed).length;
  const freeCount = transactions.filter((tx) => BigInt(tx.valueWei) === 0n).length;

  const ledger: Ledger = {
    chainId,
    contract,
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    standard,
    mintTxCount: transactions.length,
    totalValueWei: totalValue.toString(),
    transactions,
  };

  writeJson(out, ledger);

  process.stdout.write(
    [
      '',
      '─'.repeat(60),
      `Mint transactions : ${transactions.length}`,
      `Total ETH paid    : ${eth(totalValue)}`,
      `Zero-value mints  : ${freeCount}  (free mints, or paid in an ERC-20)`,
      `Routed mints      : ${routedCount}  (via aggregator/router — value may include their fees)`,
      `Ledger written to : ${out}`,
      '─'.repeat(60),
      '',
      'Next: npm run plan -- --ledger ' + out,
      '',
    ].join('\n'),
  );
}

main().catch((error) => {
  process.stderr.write(`\nFailed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
