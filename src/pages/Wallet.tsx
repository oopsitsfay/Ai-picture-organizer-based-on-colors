import { useState } from "react";
import { config } from "../config";
import { useApp } from "../state";
import { connect, hasUnisat, hasXverse, isBtcAddress, shortAddr, type WalletKind } from "../lib/wallet";
import { fmtToken, totalWeeks, weekAt, weeklyFor, WEEK } from "../lib/emission";
import { fmtInt, useNow } from "../lib/useNow";
import { href } from "../router";
import type { Collection, Piece } from "../data/collection";
import { PieceArt } from "../components/PieceArt";
import { SampleNote, SectionHead } from "../components/Layout";
import { PieceDialog } from "./Market";

export function WalletPage() {
  const { wallet } = useApp();
  return (
    <section className="section page">
      <SectionHead
        index="W"
        eyebrow="Wallet"
        title="Scan your wallet."
        sub={`Link the wallet that holds your pieces and see what it produces in ${config.ticker}.`}
      />
      <SampleNote />
      {wallet ? <Holdings /> : <Connect />}
    </section>
  );
}

export function Connect() {
  const { setWallet } = useApp();
  const [busy, setBusy] = useState<WalletKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watch, setWatch] = useState("");

  const go = async (kind: "unisat" | "xverse") => {
    setBusy(kind);
    setError(null);
    try {
      setWallet(await connect(kind));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const wallets = [
    { kind: "unisat" as const, name: "UniSat", found: hasUnisat() },
    { kind: "xverse" as const, name: "Xverse", found: hasXverse() },
  ];

  return (
    <div className="connect">
      <div className="card">
        <h3>Connect</h3>
        <p className="muted">Connecting only reads your address. Signing a claim is a separate step, and nothing is ever sent from your wallet.</p>
        <div className="wallet-buttons">
          {wallets.map((w) => (
            <button key={w.kind} type="button" className="btn btn-ghost wallet-btn" disabled={!!busy} onClick={() => go(w.kind)}>
              {busy === w.kind ? "Connecting…" : w.name}
              <span className="tag">{w.found ? "Detected" : "Not found"}</span>
            </button>
          ))}
        </div>
      </div>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          const a = watch.trim();
          if (!isBtcAddress(a)) return setError("That doesn't look like a Bitcoin address.");
          setError(null);
          setWallet({ address: a, kind: "watch" });
        }}
      >
        <h3>Or paste an address</h3>
        <p className="muted">View-only. Good for checking any wallet's production. You'll need to connect to claim.</p>
        <div className="inline-form">
          <input value={watch} onChange={(e) => setWatch(e.target.value)} placeholder="bc1p…" aria-label="Bitcoin address" spellCheck={false} />
          <button type="submit" className="btn btn-accent">
            Scan
          </button>
        </div>
      </form>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Holdings() {
  const { wallet, setWallet, scan, rescan, collection } = useApp();
  const now = useNow(1000);
  const [open, setOpen] = useState<Piece | null>(null);
  if (!wallet || !collection) return null;

  const pieces = [...scan.pieces].sort((a, b) => b.hashPower - a.hashPower);
  const hp = pieces.reduce((s, p) => s + p.hashPower, 0);
  const weekly = weeklyFor(hp, collection.totalHashPower);
  const week = weekAt(now);
  const thisWeek = week.started && !week.ended ? weekly * Math.min(1, (now - week.startsAt) / WEEK) : 0;
  const weeksLeft = week.started ? totalWeeks - week.n + 1 : totalWeeks;

  return (
    <>
      <div className="wallet-bar card">
        <div>
          <p className="eyebrow">{wallet.kind === "watch" ? "Watching" : `Connected · ${wallet.kind === "unisat" ? "UniSat" : "Xverse"}`}</p>
          <p className="mono wallet-addr" title={wallet.address}>
            {shortAddr(wallet.address)}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={rescan} disabled={scan.status === "scanning"}>
            {scan.status === "scanning" ? "Scanning…" : "Rescan"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWallet(null)}>
            Disconnect
          </button>
        </div>
      </div>

      {scan.status === "scanning" ? <ScanLoader /> : null}
      {scan.status === "error" ? <p className="error">{scan.error}</p> : null}

      {scan.status === "done" ? (
        <>
          <dl className="stats stats-4">
            <div>
              <dt>Pieces held</dt>
              <dd>{pieces.length}</dd>
            </div>
            <div>
              <dt>Your hash power</dt>
              <dd>{fmtInt(hp)}</dd>
            </div>
            <div>
              <dt>Per week</dt>
              <dd>
                {fmtToken(weekly)} <small>{config.ticker}</small>
              </dd>
            </div>
            <div>
              <dt>Mined this week</dt>
              <dd className="ticking">
                {fmtToken(thisWeek, 4)} <small>{config.ticker}</small>
              </dd>
            </div>
          </dl>

          {pieces.length ? (
            <>
              <p className="muted wallet-summary">
                {(hp / collection.totalHashPower * 100).toFixed(3)}% of network hash power. Held to the halving, that's about{" "}
                <span className="text">
                  {fmtToken(weekly * weeksLeft, 0)} {config.ticker}
                </span>{" "}
                over the remaining {weeksLeft} weeks.
              </p>
              <ul className="pieces">
                {pieces.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="piece" onClick={() => setOpen(p)}>
                      <PieceArt traits={p.traits} className="piece-art" />
                      <span className="piece-meta">
                        <span className="piece-num">#{p.number}</span>
                        <span className="piece-rank">Rank {fmtInt(p.rank)}</span>
                      </span>
                      <span className="piece-hp">
                        <span>{fmtInt(p.hashPower)}</span> HP · {fmtToken(weeklyFor(p.hashPower, collection.totalHashPower))}/wk
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="actions">
                <a className="btn btn-accent" href={href("/claim")}>
                  Go to claim →
                </a>
              </div>
            </>
          ) : (
            <EmptyWallet />
          )}
        </>
      ) : null}

      {open ? <PieceDialog p={open} c={collection as Collection} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function ScanLoader() {
  return (
    <div className="card scan-loader" role="status">
      <span className="scan-line" aria-hidden />
      Scanning inscriptions…
    </div>
  );
}

function EmptyWallet() {
  return (
    <div className="card empty">
      <h3>No {config.name} pieces in this wallet.</h3>
      <p className="muted">If you just bought one, give the transfer a block or two and rescan.</p>
      <a className="btn btn-accent btn-sm" href={href("/market")}>
        Browse the market →
      </a>
    </div>
  );
}
