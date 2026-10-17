import type { AddressInfo, Output, Tx, Utxo } from "./api";
import { btc, int, sats } from "./format";

export type Level = "bad" | "warn" | "info" | "good";

export type Finding = {
  id: string;
  level: Level;
  title: string;
  detail: string;
  fix?: string;
  /** Score change: negative for leaks, positive for good practice. */
  delta: number;
};

export type Grade = { label: string; blurb: string };

export function grade(score: number): Grade {
  if (score >= 85) return { label: "Frosted", blurb: "Hard to see through. Keep these habits." };
  if (score >= 65) return { label: "Tinted", blurb: "Some of your history shows. A few fixes go a long way." };
  if (score >= 40) return { label: "Clear", blurb: "An analyst can follow most of this." };
  return { label: "See-through", blurb: "This is an open book to anyone watching the chain." };
}

const LEVEL_ORDER: Record<Level, number> = { bad: 0, warn: 1, info: 2, good: 3 };
const sortFindings = (f: Finding[]) => [...f].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.delta - b.delta);
const scoreOf = (f: Finding[]) => Math.max(0, Math.min(100, Math.round(100 + f.reduce((s, x) => s + x.delta, 0))));

/* ---------- shared heuristics ---------- */

const spendable = (o: Output) => o.scriptpubkey_type !== "op_return" && o.value > 0;

/** Largest group of outputs with exactly the same value. */
export function maxEqualOutputs(tx: Tx) {
  const counts = new Map<number, number>();
  for (const o of tx.vout.filter(spendable)) counts.set(o.value, (counts.get(o.value) ?? 0) + 1);
  return Math.max(0, ...counts.values());
}

/** Many inputs and many identical outputs: the CoinJoin pattern, where "who paid whom" can't be read off. */
export const isCoinJoinLike = (tx: Tx) => tx.vin.length >= 5 && maxEqualOutputs(tx) >= 5;

/** A "round" amount: a whole multiple of 0.001 BTC. People pay round numbers; change is rarely round. */
export const isRound = (v: number) => v >= 100_000 && v % 100_000 === 0;

const inputAddresses = (tx: Tx) => [...new Set(tx.vin.map((i) => i.prevout?.scriptpubkey_address).filter((a): a is string => !!a))];

export const typeLabel: Record<string, string> = {
  p2pkh: "Legacy (P2PKH)",
  p2sh: "Script hash (P2SH)",
  v0_p2wpkh: "SegWit (P2WPKH)",
  v0_p2wsh: "SegWit script (P2WSH)",
  v1_p2tr: "Taproot (P2TR)",
  op_return: "Data (OP_RETURN)",
  multisig: "Bare multisig",
  p2pk: "Pay-to-pubkey",
};

function addressType(a: string) {
  if (/^bc1p/i.test(a)) return "v1_p2tr";
  if (/^bc1q/i.test(a)) return a.length > 50 ? "v0_p2wsh" : "v0_p2wpkh";
  if (a.startsWith("3")) return "p2sh";
  return "p2pkh";
}

export type ChangeGuess = { index: number; confidence: "certain" | "likely"; reason: string } | null;

/** Guesses which output is change, the way an analyst would. */
export function guessChange(tx: Tx): ChangeGuess {
  if (isCoinJoinLike(tx)) return null;
  const outs = tx.vout.map((o, index) => ({ o, index })).filter(({ o }) => spendable(o));
  if (outs.length !== 2) return null;
  const ins = new Set(inputAddresses(tx));

  const back = outs.find(({ o }) => o.scriptpubkey_address && ins.has(o.scriptpubkey_address));
  if (back) return { index: back.index, confidence: "certain", reason: "it goes back to an address that funded the transaction" };

  const round = outs.filter(({ o }) => isRound(o.value));
  if (round.length === 1) {
    const other = outs.find((x) => x !== round[0])!;
    return { index: other.index, confidence: "likely", reason: `the other output is a round ${btc(round[0].o.value)}, which looks like the payment` };
  }

  const inTypes = new Set(tx.vin.map((i) => i.prevout?.scriptpubkey_type).filter(Boolean));
  if (inTypes.size === 1) {
    const [t] = [...inTypes];
    const same = outs.filter(({ o }) => o.scriptpubkey_type === t);
    if (same.length === 1) {
      return { index: same[0].index, confidence: "likely", reason: `it's the only output with the same address type as the inputs (${typeLabel[t!] ?? t})` };
    }
  }
  return null;
}

/* ---------- address report ---------- */

export type AddressReport = {
  score: number;
  grade: Grade;
  findings: Finding[];
  /** Addresses this one was spent together with, outside CoinJoins: very likely the same owner. */
  linked: { address: string; times: number }[];
  received: number;
  balance: number;
  txCount: number;
  receives: number;
  scannedTxs: number;
  flags: Map<string, string[]>;
};

export function analyzeAddress(info: AddressInfo, txs: Tx[], utxos: Utxo[]): AddressReport {
  const a = info.address;
  const cs = info.chain_stats;
  const ms = info.mempool_stats;
  const receives = cs.funded_txo_count + ms.funded_txo_count;
  const received = cs.funded_txo_sum + ms.funded_txo_sum;
  const balance = received - cs.spent_txo_sum - ms.spent_txo_sum;
  const txCount = cs.tx_count + ms.tx_count;
  const findings: Finding[] = [];
  const flags = new Map<string, string[]>();
  const flag = (txid: string, f: string) => flags.set(txid, [...(flags.get(txid) ?? []), f]);

  if (txCount === 0) {
    findings.push({
      id: "unused",
      level: "good",
      title: "Never used",
      detail: "This address has no history on the chain, so there's nothing to read yet.",
      fix: "Keep it that way: use it to receive once, then move on to a fresh address.",
      delta: 0,
    });
    return { score: 100, grade: grade(100), findings, linked: [], received, balance, txCount, receives, scannedTxs: 0, flags };
  }

  // 1. Address reuse
  if (receives <= 1) {
    findings.push({ id: "reuse", level: "good", title: "Received once", detail: "One payment in, no reuse. That's the habit that matters most.", delta: 0 });
  } else {
    const delta = -Math.min(35, 8 + receives * 3);
    findings.push({
      id: "reuse",
      level: receives > 3 ? "bad" : "warn",
      title: `Reused ${int(receives)} times`,
      detail: `Every payment to this address is tied together. Anyone who knows one of them (a payer, an exchange, a friend) can see all ${int(receives)}, and the ${btc(received)} total.`,
      fix: "Use a fresh receive address every time. Every modern wallet does this automatically.",
      delta,
    });
  }

  // 2. Common-input ownership + per-transaction leaks where this address spends
  const linked = new Map<string, number>();
  let backToSelf = 0;
  let roundGiveaways = 0;
  let consolidations = 0;
  let coinjoins = 0;

  for (const tx of txs) {
    const spends = tx.vin.some((i) => i.prevout?.scriptpubkey_address === a);
    const cj = isCoinJoinLike(tx);
    if (cj && (spends || tx.vout.some((o) => o.scriptpubkey_address === a))) {
      coinjoins++;
      flag(tx.txid, "CoinJoin-like");
      continue;
    }
    if (!spends) continue;

    const others = inputAddresses(tx).filter((x) => x !== a);
    if (others.length) {
      flag(tx.txid, `Spent with ${others.length} other ${others.length === 1 ? "address" : "addresses"}`);
      for (const o of others) linked.set(o, (linked.get(o) ?? 0) + 1);
    }
    if (tx.vin.length >= 5) {
      consolidations++;
      flag(tx.txid, `${tx.vin.length} inputs merged`);
    }
    if (tx.vout.some((o) => o.scriptpubkey_address === a)) {
      backToSelf++;
      flag(tx.txid, "Change back to same address");
    } else {
      const g = guessChange(tx);
      if (g && g.reason.includes("round")) {
        roundGiveaways++;
        flag(tx.txid, "Round payment reveals change");
      }
    }
  }

  const linkedList = [...linked.entries()].map(([address, times]) => ({ address, times })).sort((x, y) => y.times - x.times);
  if (linkedList.length) {
    findings.push({
      id: "linked",
      level: "bad",
      title: `Linked to ${int(linkedList.length)} other ${linkedList.length === 1 ? "address" : "addresses"}`,
      detail:
        "When coins from several addresses are spent in one transaction, analysts assume one owner holds them all. This is the main way wallets get clustered.",
      fix: "Use coin control to spend from one source at a time, and never mix coins from different sources (KYC exchange, P2P, payments) in one spend.",
      delta: -Math.min(30, 10 + linkedList.length * 2),
    });
  }
  if (backToSelf) {
    findings.push({
      id: "self-change",
      level: "bad",
      title: "Change sent back to the same address",
      detail: `In ${int(backToSelf)} ${backToSelf === 1 ? "transaction" : "transactions"} the leftover came back here. That marks exactly which output was the payment and keeps your whole balance in plain sight.`,
      fix: "Use a wallet that sends change to a new internal address (all HD wallets do).",
      delta: -15,
    });
  }
  if (roundGiveaways) {
    findings.push({
      id: "round",
      level: "warn",
      title: "Round payments give away your change",
      detail: `In ${int(roundGiveaways)} ${roundGiveaways === 1 ? "spend" : "spends"}, one output was a round amount, so the other one is obviously yours.`,
      fix: "Avoid round amounts where you can, or let the recipient pick the amount in sats.",
      delta: -Math.min(15, 5 * roundGiveaways),
    });
  }
  if (consolidations) {
    findings.push({
      id: "consolidation",
      level: "warn",
      title: "Coins merged in one spend",
      detail: `${int(consolidations)} ${consolidations === 1 ? "spend" : "spends"} combined 5 or more inputs, joining their separate histories together for good.`,
      fix: "Consolidate only coins that are already linked, and ideally when fees are low and after a CoinJoin.",
      delta: -8,
    });
  }

  // 3. Dust
  const dust = utxos.filter((u) => u.value < 1000);
  if (dust.length) {
    findings.push({
      id: "dust",
      level: "warn",
      title: `${int(dust.length)} dust ${dust.length === 1 ? "output" : "outputs"} waiting`,
      detail: `Tiny unspent amounts (${dust.map((d) => sats(d.value)).slice(0, 3).join(", ")}${dust.length > 3 ? "…" : ""}) are often sent on purpose: spend them with your other coins and you link everything.`,
      fix: "Freeze these outputs in your wallet's coin control and never spend them.",
      delta: -6,
    });
  }

  // 4. Address type
  const t = addressType(a);
  if (t === "v1_p2tr") {
    findings.push({ id: "type", level: "good", title: "Taproot address", detail: "Taproot spends look alike whether they're simple or complex, which helps you blend in.", delta: 0 });
  } else if (t === "p2pkh" || t === "p2sh") {
    findings.push({
      id: "type",
      level: "info",
      title: `${typeLabel[t]} address`,
      detail: "An older address type. Fewer wallets use it today, which makes your transactions easier to fingerprint.",
      fix: "Move to a wallet that uses Taproot (bc1p) or native SegWit (bc1q) addresses.",
      delta: -5,
    });
  } else {
    findings.push({ id: "type", level: "info", title: `${typeLabel[t]} address`, detail: "The most common address type today: you blend in with the crowd.", delta: 0 });
  }

  // 5. CoinJoin
  if (coinjoins) {
    findings.push({
      id: "coinjoin",
      level: "good",
      title: `${int(coinjoins)} CoinJoin-like ${coinjoins === 1 ? "transaction" : "transactions"}`,
      detail: "Equal outputs across many inputs break the link between who paid and who received.",
      delta: 10,
    });
  }

  // 6. Long history
  if (txCount > 20) {
    findings.push({
      id: "history",
      level: "warn",
      title: `${int(txCount)} transactions on one address`,
      detail: "A long public history on one address is a timeline of your activity: when you get paid, when you spend, how much.",
      fix: "Retire heavily used addresses. Send to fresh ones and stop sharing the old one.",
      delta: -5,
    });
  }

  return {
    score: scoreOf(findings),
    grade: grade(scoreOf(findings)),
    findings: sortFindings(findings),
    linked: linkedList,
    received,
    balance,
    txCount,
    receives,
    scannedTxs: txs.length,
    flags,
  };
}

/* ---------- transaction report ---------- */

export type TxReport = {
  score: number;
  grade: Grade;
  findings: Finding[];
  change: ChangeGuess;
  coinjoin: boolean;
  feeRate: number;
  inputAddrs: string[];
};

export function analyzeTx(tx: Tx): TxReport {
  const findings: Finding[] = [];
  const coinjoin = isCoinJoinLike(tx);
  const inputAddrs = inputAddresses(tx);
  const feeRate = tx.weight ? tx.fee / (tx.weight / 4) : 0;

  if (tx.vin.some((i) => i.is_coinbase)) {
    findings.push({ id: "coinbase", level: "info", title: "Coinbase transaction", detail: "Newly mined coins paid to the miner. No sender to link.", delta: 0 });
  }

  if (coinjoin) {
    findings.push({
      id: "coinjoin",
      level: "good",
      title: `CoinJoin-like: ${maxEqualOutputs(tx)} equal outputs`,
      detail: "Many inputs pay into identical amounts, so it can't be read which input paid which output.",
      delta: 10,
    });
  } else if (inputAddrs.length > 1) {
    findings.push({
      id: "cio",
      level: "bad",
      title: `Links ${int(inputAddrs.length)} addresses together`,
      detail: "All inputs of an ordinary transaction are assumed to belong to the same person. These addresses are now one cluster.",
      fix: "Spend from one source at a time with coin control.",
      delta: -Math.min(30, 10 + inputAddrs.length * 2),
    });
  }

  const change = guessChange(tx);
  if (change) {
    findings.push({
      id: "change",
      level: change.confidence === "certain" ? "bad" : "warn",
      title: `Change is output #${change.index}${change.confidence === "likely" ? " (likely)" : ""}`,
      detail: `An analyst would say output #${change.index} is change because ${change.reason}. That tells them which coins the sender kept.`,
      fix:
        change.confidence === "certain"
          ? "Send change to a new address."
          : "Avoid round amounts and use the same address type as the people you pay (Taproot is a good default).",
      delta: change.confidence === "certain" ? -20 : -10,
    });
  } else if (!coinjoin && tx.vout.filter(spendable).length === 2 && !tx.vin.some((i) => i.is_coinbase)) {
    findings.push({ id: "change", level: "good", title: "No obvious change output", detail: "The common tricks don't reveal which output went back to the sender.", delta: 0 });
  }

  const legacy = tx.vin.some((i) => i.prevout?.scriptpubkey_type === "p2pkh") || tx.vout.some((o) => o.scriptpubkey_type === "p2pkh");
  if (legacy) {
    findings.push({
      id: "legacy",
      level: "info",
      title: "Uses legacy addresses",
      detail: "Older address types are rarer today and make a transaction easier to fingerprint.",
      delta: -5,
    });
  }

  const reused = tx.vout.filter((o) => o.scriptpubkey_address && inputAddrs.includes(o.scriptpubkey_address)).length;
  if (reused && !change) {
    findings.push({ id: "reuse", level: "warn", title: "Pays an address it spends from", detail: "An output goes back to an input address, which reuses it.", delta: -10 });
  }

  if (tx.vout.some((o) => o.scriptpubkey_type === "op_return")) {
    findings.push({ id: "opreturn", level: "info", title: "Carries data (OP_RETURN)", detail: "This transaction embeds data, which makes it stand out.", delta: -2 });
  }

  const score = scoreOf(findings);
  return { score, grade: grade(score), findings: sortFindings(findings), change, coinjoin, feeRate, inputAddrs };
}
