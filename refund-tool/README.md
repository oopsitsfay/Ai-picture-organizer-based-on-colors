# Mint Refund Tool

Batch-refunds mint fees from a treasury wallet back to the people who paid them.

Refund source wallet: `0x057b7c1d644464f4d0E11796Da092cAc59FA9386`

The job splits into three steps, and each one writes a file you can inspect before
moving to the next. Nothing is broadcast until you explicitly pass `--execute`.

```
index-mints.ts  →  ledger.json   who minted, in which tx, paying how much
build-plan.ts   →  plan.json     one row per address: exactly what they get back
send.ts         →  state.json    what actually got paid, resumable
```

## Setup

```bash
cd refund-tool
npm install
cp .env.example .env      # fill in RPC_URL; PRIVATE_KEY only when you're ready to send
```

Use a paid or archive RPC endpoint. Public endpoints rate-limit historical log
queries hard, and step 1 is one long log scan.

## Robinhood Chain notes

| | |
| --- | --- |
| Chain ID | `4663` |
| Public RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Native currency | ETH |
| Explorer | `robinhoodchain.blockscout.com` |

Two things about this chain change how you run step 1:

**Block times are ~100ms.** Mainnet opened 1 July 2026, so the chain is already tens
of millions of blocks deep. Scanning from block 0 means thousands of `eth_getLogs`
calls. **Get the collection's deploy block from Blockscout and pass it explicitly** —
it turns a very long scan into a short one:

```bash
npm run index -- --contract 0xYourCollection --from-block <deploy block>
```

`--from-block auto` also works (it binary-searches the deploy block in ~25 calls),
but only against an archive endpoint.

**Providers cap `eth_getLogs` around 10,000 blocks.** That is the default here. Any
window the provider still rejects splits itself in half automatically, so a wrong
guess costs a retry rather than a failed run. If your endpoint allows wider windows,
raise `--block-span` — it is the single biggest lever on scan time. If you get rate
limited, lower `--log-concurrency` (default 12).

**Use sequential mode to send.** Disperse-style batching helps on L1 where gas is
expensive; on a six-week-old L2 there is unlikely to be an audited disperse contract
deployed, and pointing the tool at an unverified one risks the entire batch value.
Gas here is cheap enough that one transaction per minter is both simpler and safer.

## Step 1 — index the mints

```bash
npm run index -- --contract 0xYourCollection --from-block auto
```

Finds every mint (`Transfer` / `TransferSingle` / `TransferBatch` from the zero
address), then resolves each mint transaction to its sender and its ETH value.

| Flag | Default | Notes |
| --- | --- | --- |
| `--contract` | required | The NFT collection that was minted |
| `--from-block` | `auto` | `auto` binary-searches the deploy block (needs an archive node) |
| `--to-block` | latest | |
| `--standard` | `auto` | `erc721`, `erc1155`, or `auto` for both |
| `--block-span` | `10000` | Log window; windows that are rejected split themselves in half |
| `--log-concurrency` | `12` | Parallel log windows — lower it if you get rate-limited |
| `--concurrency` | `8` | Parallel tx lookups |

## Step 2 — build the refund plan

```bash
npm run plan -- --ledger data/ledger.json
```

Aggregates ETH per address and writes `plan.json`, a human-readable `plan.csv`, and
`safe-transaction-builder.csv` for the Safe path. It prints the total against the
wallet's live balance so you know up front whether the wallet covers it.

| Flag | Default | Notes |
| --- | --- | --- |
| `--refund-to` | `payer` | `payer` = whoever sent the mint tx; `receiver` = whoever got the token |
| `--min-wei` | `0` | Drop dust refunds that would cost more in gas than they return |
| `--max-wei` | none | Safety cap — anything above it is excluded for manual review |
| `--include-routed` | off | Include mints made through an aggregator (see caveats) |
| `--exclude-contracts` | off | Hold back contract recipients instead of paying them |

**Read `plan.csv` line by line before continuing.** This is the file that decides
who gets paid what.

## Step 3 — send

Dry run first — this is the default, and it prints totals, gas estimate, and the
first recipients without touching the network state:

```bash
npm run send
```

Then pick a path:

**Sequential** — one plain transfer per recipient. No contract to trust, works on
every chain, and a single bad recipient can't affect anyone else. More gas.

```bash
npm run send -- --execute
```

**Disperse** — many recipients per transaction, roughly 40–60% cheaper on L1. It
needs a deployed disperse-style contract exposing
`disperseEther(address[], uint256[])`. **Verify the address on the block explorer
yourself** — pointing this at the wrong contract sends the whole batch value there.

```bash
npm run send -- --execute --mode disperse --disperse-address 0x... --batch-size 100
```

**Safe / multisig / hardware wallet** — skip `send.ts` entirely. Import
`data/safe-transaction-builder.csv` into the Safe Transaction Builder app and sign
the bundle there. `PRIVATE_KEY` stays empty in this path.

| Flag | Default | Notes |
| --- | --- | --- |
| `--execute` | off | Required to broadcast. Without it, everything is a dry run |
| `--mode` | `sequential` | or `disperse` |
| `--batch-size` | `100` | Recipients per disperse tx |
| `--limit` | all | Refund only the first N pending — useful for a small live test |
| `--confirmations` | `1` | Blocks to wait before marking a refund sent |
| `--stop-on-error` | off | Halt on first failure instead of continuing |

### Do a live test first

```bash
npm run send -- --execute --limit 1
```

One real refund, one real receipt. Confirm it on the explorer, then run the rest.

## Safety properties

- **Dry run by default.** `--execute` is the only thing that broadcasts.
- **No double-pays.** Each confirmed send is written to `state.json` before the next
  starts. Re-running skips anything already marked sent, so a crash, a rate-limit,
  or a Ctrl-C is safe to resume from.
- **The plan is pinned.** `state.json` stores a hash of the plan's addresses and
  amounts. If the plan changes underneath a partially-executed run, the tool refuses
  to continue rather than paying against a mismatched list.
- **Key must match.** The tool derives the address from `PRIVATE_KEY` and aborts
  unless it equals `REFUND_FROM`.
- **Chain must match.** The ledger, plan, and RPC chain ids are checked at every step.
- **Balance preflight.** A run the wallet cannot finish is refused before the first
  transaction, not discovered halfway through.
- **Disperse batches are simulated** before broadcast, so one recipient that rejects
  ETH fails the simulation instead of burning the batch's gas.
- **Receipts are checked.** A mined-but-reverted transaction is recorded as failed,
  never as sent.

## Caveats worth reading before you pay anyone

**Routed mints.** If someone minted through an aggregator or marketplace router, the
transaction value includes that platform's fees, so it is *more* than your contract
received. These are excluded by default and listed in `plan.json` under `excluded`.
Review them, then decide: refund the full amount they spent, or only your share.
`--include-routed` pays the full transaction value.

**Payer vs. receiver.** Default is `--refund-to payer`, the address that sent the
transaction and actually lost the money. That is usually correct. It differs from
the token holder for gifted mints, and for mints made through a smart wallet where
the token went elsewhere.

**Zero-value mints** are skipped — free mints, or mints paid in an ERC-20. If your
mint priced in USDC or another token, this tool does not cover it; the ledger is
still valid but the refund leg would need an ERC-20 transfer instead.

**Contract recipients** are flagged `is_contract` in the CSV. Some are smart wallets
that receive ETH fine; some are contracts that reject it; some are exchange deposit
addresses where a refund may be unrecoverable for the user. Sequential mode isolates
these failures. Disperse mode does not — use `--exclude-contracts` there.

**Secondary buyers get nothing.** This refunds mint fees to original minters. Anyone
who bought on the secondary market never paid you a mint fee and won't appear.

**Contract-paid mints.** If the collection refunded overpayment during minting, the
transaction value overstates what was actually kept. Cross-check the total in
`plan.json` against what the wallet actually received before executing.
