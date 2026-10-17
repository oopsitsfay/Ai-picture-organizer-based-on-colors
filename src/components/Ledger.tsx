import { config } from "../config";

/** Deterministic pseudo-random hex so the ledger looks the same on every load. */
function hex(seed: number, len: number) {
  let s = seed * 9301 + 49297;
  let out = "";
  for (let i = 0; i < len; i++) {
    s = (s * 9301 + 49297) % 233280;
    out += "0123456789abcdef"[Math.floor((s / 233280) * 16)];
  }
  return out;
}

const ROWS = Array.from({ length: 9 }, (_, i) => ({
  txid: `${hex(i + 3, 6)}…${hex(i + 41, 4)}`,
  amount: (((i * 7919) % 1000) / 1000 + (i % 3)).toFixed(4),
  // Rows that get shielded, with staggered timing.
  hidden: [1, 3, 4, 7].includes(i),
}));

/** Decorative hero visual: a ledger where some lines redact themselves. */
export function Ledger() {
  return (
    <div className="card ledger" aria-hidden>
      <div className="ledger-head">
        <span>
          <span className="dot" /> mempool
        </span>
        <span>block {(config.btcHalving.block - 74_812).toLocaleString("en-US")}</span>
      </div>
      <ul>
        {ROWS.map((r, i) => (
          <li key={r.txid} className={r.hidden ? "shielded" : undefined}>
            <span className="txid">{r.txid}</span>
            <span className="amt">{r.amount} BTC</span>
            {r.hidden ? <span className="bar" style={{ animationDelay: `${i * 0.7}s` }} /> : null}
          </li>
        ))}
      </ul>
      <div className="ledger-foot">
        <span>{config.ticker}</span>
        <span className="redacted">██████████</span>
      </div>
    </div>
  );
}
