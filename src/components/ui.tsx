import { useState } from "react";
import { config } from "../config";
import { to } from "../router";
import { isAddress, isTestnet, isTxid } from "../lib/format";
import type { Finding, Grade } from "../lib/analyze";

export function Nav() {
  return (
    <nav className="nav" aria-label="Primary">
      <a href={to.home()} className="logo">
        <span className="logo-mark" aria-hidden />
        {config.name}
      </a>
      <ul>
        <li>
          <a href={to.home("how")}>How it works</a>
        </li>
        <li>
          <a href={to.learn()}>Fix your privacy</a>
        </li>
        <li>
          <a href={to.settings()}>Settings</a>
        </li>
      </ul>
      <a className="btn btn-accent btn-sm" href={to.home("scan")}>
        Scan
      </a>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <p className="closing">
        Bitcoin is public.
        <br />
        <em>You don't have to be.</em>
      </p>
      <div className="footer-row">
        <p className="fine">
          © {config.name}. Lookups go straight from your browser to a block explorer; {config.name} has no server and stores
          nothing. Results are heuristics, the same ones chain analysts use, not certainties.
        </p>
        <ul className="footer-links">
          {config.links.x ? (
            <li>
              <a href={config.links.x} target="_blank" rel="noopener noreferrer">
                X ↗
              </a>
            </li>
          ) : null}
          {config.links.github ? (
            <li>
              <a href={config.links.github} target="_blank" rel="noopener noreferrer">
                Source ↗
              </a>
            </li>
          ) : null}
          <li>
            <a href={to.settings()}>Use your own node</a>
          </li>
        </ul>
      </div>
      <p className="wordmark" aria-hidden>
        {config.name}
      </p>
    </footer>
  );
}

/** Address or txid input that routes to the right report. */
export function ScanBox({ autoFocus, compact }: { autoFocus?: boolean; compact?: boolean }) {
  const [v, setV] = useState("");
  const [error, setError] = useState<string | null>(null);

  const go = (raw: string) => {
    const s = raw.trim();
    if (isTxid(s)) window.location.hash = to.tx(s.toLowerCase());
    else if (isAddress(s)) window.location.hash = to.address(/^bc1/i.test(s) ? s.toLowerCase() : s);
    else if (isTestnet(s)) setError("That's a testnet address. GLASS reads Bitcoin mainnet.");
    else setError("Paste a Bitcoin address (1…, 3…, bc1…) or a 64-character transaction ID.");
  };

  return (
    <form
      className={compact ? "scan scan-compact" : "scan"}
      onSubmit={(e) => {
        e.preventDefault();
        go(v);
      }}
    >
      <div className="scan-field">
        <svg viewBox="0 0 24 24" className="scan-icon" aria-hidden>
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          value={v}
          onChange={(e) => {
            setV(e.target.value);
            setError(null);
          }}
          placeholder="Bitcoin address or transaction ID"
          aria-label="Bitcoin address or transaction ID"
          spellCheck={false}
          autoComplete="off"
          autoFocus={autoFocus}
        />
        <button type="submit" className="btn btn-accent">
          See through it
        </button>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {!compact ? (
        <p className="examples">
          Try one:{" "}
          {config.examples.map((ex) => (
            <button key={ex.value} type="button" className="chip" onClick={() => go(ex.value)}>
              {ex.label}
            </button>
          ))}
        </p>
      ) : null}
    </form>
  );
}

/** Ring gauge for a 0–100 privacy score. */
export function Gauge({ score, grade }: { score: number; grade: Grade }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = score >= 85 ? "good" : score >= 65 ? "ok" : score >= 40 ? "warn" : "bad";
  return (
    <div className={`gauge gauge-${tone}`}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} className="gauge-track" />
        <circle cx="60" cy="60" r={r} className="gauge-fill" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="gauge-text">
        <span className="gauge-num">{score}</span>
        <span className="gauge-label">{grade.label}</span>
      </div>
    </div>
  );
}

const ICON: Record<Finding["level"], string> = { bad: "!", warn: "!", info: "i", good: "✓" };

export function Findings({ items }: { items: Finding[] }) {
  return (
    <ul className="findings">
      {items.map((f) => (
        <li key={f.id} className={`finding finding-${f.level}`}>
          <span className="finding-icon" aria-hidden>
            {ICON[f.level]}
          </span>
          <div>
            <h3>
              {f.title}
              {f.delta ? <span className="delta">{f.delta > 0 ? `+${f.delta}` : f.delta}</span> : null}
            </h3>
            <p>{f.detail}</p>
            {f.fix ? (
              <p className="fix">
                <strong>Fix:</strong> {f.fix}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Reminder that the lookup itself is visible to the explorer. */
export function LookupNote() {
  return (
    <p className="note">
      This lookup went to your block explorer, which saw your IP and what you searched. For your own wallets, use Tor or{" "}
      <a href={to.settings()}>point {config.name} at your own node</a>.
    </p>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="loading" role="status">
      <span className="loading-bar" aria-hidden />
      {label}
    </div>
  );
}

export function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}
