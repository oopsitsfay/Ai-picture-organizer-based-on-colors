import { useEffect, useMemo, useState } from "react";
import { fetchAddress, fetchTx, type AddressInfo, type Tx, type Utxo } from "../lib/api";
import { analyzeAddress, analyzeTx, typeLabel } from "../lib/analyze";
import { btc, date, int, short } from "../lib/format";
import { to } from "../router";
import { Copy, Findings, Gauge, Loading, LookupNote, ScanBox } from "../components/ui";

type Load<T> = { status: "loading" } | { status: "error"; error: string } | { status: "done"; data: T };

function useLoad<T>(fn: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  useEffect(() => {
    const ac = new AbortController();
    setState({ status: "loading" });
    fn(ac.signal).then(
      (data) => setState({ status: "done", data }),
      (e: Error) => !ac.signal.aborted && setState({ status: "error", error: e.message }),
    );
    return () => ac.abort();
  }, [key]);
  return state;
}

function Shell({ kind, id, children }: { kind: string; id: string; children: React.ReactNode }) {
  return (
    <section className="section page">
      <ScanBox compact />
      <header className="report-head">
        <p className="eyebrow">{kind}</p>
        <p className="report-id mono">
          <span>{id}</span>
          <Copy text={id} />
        </p>
      </header>
      {children}
    </section>
  );
}

function Failed({ error }: { error: string }) {
  return (
    <div className="card empty">
      <h3>Couldn't read that.</h3>
      <p className="muted">{error}</p>
    </div>
  );
}

/* ---------- address ---------- */

export function AddressPage({ id }: { id: string }) {
  const state = useLoad((s) => fetchAddress(id, s), id);
  return (
    <Shell kind="Address" id={id}>
      {state.status === "loading" ? <Loading label="Reading the chain…" /> : null}
      {state.status === "error" ? <Failed error={state.error} /> : null}
      {state.status === "done" ? <AddressBody {...state.data} /> : null}
    </Shell>
  );
}

function AddressBody({ info, txs, utxos }: { info: AddressInfo; txs: Tx[]; utxos: Utxo[] }) {
  const r = useMemo(() => analyzeAddress(info, txs, utxos), [info, txs, utxos]);
  const stats = [
    { l: "Received", v: btc(r.received) },
    { l: "Balance", v: btc(r.balance) },
    { l: "Payments in", v: int(r.receives) },
    { l: "Transactions", v: int(r.txCount) },
  ];

  return (
    <>
      <div className="score-row">
        <div className="card glass-card score-card">
          <Gauge score={r.score} grade={r.grade} />
          <div>
            <p className="eyebrow">Privacy score</p>
            <h2 className="score-title">{r.grade.label}</h2>
            <p className="muted">{r.grade.blurb}</p>
          </div>
        </div>
        <dl className="card visible">
          <p className="eyebrow">Visible to anyone</p>
          {stats.map((s) => (
            <div key={s.l}>
              <dt>{s.l}</dt>
              <dd>{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <h2 className="block-title">What leaks</h2>
      <Findings items={r.findings} />

      {r.linked.length ? (
        <>
          <h2 className="block-title">Probably the same owner</h2>
          <p className="muted block-sub">Spent in the same transaction as this address. Click one to see how far the cluster goes.</p>
          <ul className="linked">
            {r.linked.slice(0, 24).map((l) => (
              <li key={l.address}>
                <a href={to.address(l.address)} className="mono">
                  {short(l.address, 10, 8)}
                </a>
                <span className="muted">
                  {l.times}× together
                </span>
              </li>
            ))}
          </ul>
          {r.linked.length > 24 ? <p className="muted small">+ {int(r.linked.length - 24)} more</p> : null}
        </>
      ) : null}

      {txs.length ? (
        <>
          <h2 className="block-title">Recent transactions</h2>
          <p className="muted block-sub">
            {r.scannedTxs < r.txCount
              ? `Checked the most recent ${int(r.scannedTxs)} of ${int(r.txCount)} transactions.`
              : `All ${int(r.scannedTxs)} transactions checked.`}
          </p>
          <ul className="txs">
            {txs.slice(0, 30).map((t) => {
              const flags = r.flags.get(t.txid) ?? [];
              const net =
                t.vout.filter((o) => o.scriptpubkey_address === info.address).reduce((s, o) => s + o.value, 0) -
                t.vin.filter((i) => i.prevout?.scriptpubkey_address === info.address).reduce((s, i) => s + (i.prevout?.value ?? 0), 0);
              return (
                <li key={t.txid}>
                  <a href={to.tx(t.txid)} className="mono">
                    {short(t.txid, 10, 8)}
                  </a>
                  <span className="muted small">{date(t.status.block_time)}</span>
                  <span className={net >= 0 ? "amt in" : "amt out"}>
                    {net >= 0 ? "+" : "−"}
                    {btc(Math.abs(net))}
                  </span>
                  <span className="tx-flags">
                    {flags.map((f) => (
                      <span key={f} className={f === "CoinJoin-like" ? "flag flag-good" : "flag"}>
                        {f}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <LookupNote />
    </>
  );
}

/* ---------- transaction ---------- */

export function TxPage({ id }: { id: string }) {
  const state = useLoad((s) => fetchTx(id, s), id);
  return (
    <Shell kind="Transaction" id={id}>
      {state.status === "loading" ? <Loading label="Reading the transaction…" /> : null}
      {state.status === "error" ? <Failed error={state.error} /> : null}
      {state.status === "done" ? <TxBody tx={state.data} /> : null}
    </Shell>
  );
}

function TxBody({ tx }: { tx: Tx }) {
  const r = useMemo(() => analyzeTx(tx), [tx]);
  const total = tx.vout.reduce((s, o) => s + o.value, 0);
  const stats = [
    { l: "Moved", v: btc(total) },
    { l: "Fee", v: `${btc(tx.fee)} · ${r.feeRate.toFixed(1)} sat/vB` },
    { l: "Inputs → outputs", v: `${tx.vin.length} → ${tx.vout.length}` },
    { l: "Confirmed", v: tx.status.confirmed ? `${date(tx.status.block_time)} · block ${int(tx.status.block_height ?? 0)}` : "In mempool" },
  ];

  return (
    <>
      <div className="score-row">
        <div className="card glass-card score-card">
          <Gauge score={r.score} grade={r.grade} />
          <div>
            <p className="eyebrow">Privacy score</p>
            <h2 className="score-title">{r.grade.label}</h2>
            <p className="muted">{r.grade.blurb}</p>
          </div>
        </div>
        <dl className="card visible">
          <p className="eyebrow">Visible to anyone</p>
          {stats.map((s) => (
            <div key={s.l}>
              <dt>{s.l}</dt>
              <dd>{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <h2 className="block-title">What leaks</h2>
      {r.findings.length ? <Findings items={r.findings} /> : <p className="muted">Nothing stands out in this transaction.</p>}

      <h2 className="block-title">Flow</h2>
      <div className="flow">
        <div>
          <p className="eyebrow">Inputs · {tx.vin.length}</p>
          <ul className="io">
            {tx.vin.slice(0, 40).map((i, n) => (
              <li key={`${i.txid}:${i.vout}`}>
                <span className="io-n">{n}</span>
                {i.is_coinbase ? (
                  <span className="muted">New coins (coinbase)</span>
                ) : i.prevout?.scriptpubkey_address ? (
                  <a href={to.address(i.prevout.scriptpubkey_address)} className="mono">
                    {short(i.prevout.scriptpubkey_address)}
                  </a>
                ) : (
                  <span className="muted">{typeLabel[i.prevout?.scriptpubkey_type ?? ""] ?? "Unknown"}</span>
                )}
                <span className="io-v">{i.prevout ? btc(i.prevout.value) : ""}</span>
              </li>
            ))}
          </ul>
          {tx.vin.length > 40 ? <p className="muted small">+ {tx.vin.length - 40} more</p> : null}
        </div>
        <div className="flow-arrow" aria-hidden>
          →
        </div>
        <div>
          <p className="eyebrow">Outputs · {tx.vout.length}</p>
          <ul className="io">
            {tx.vout.slice(0, 40).map((o, n) => (
              <li key={n} className={r.change?.index === n ? "io-change" : undefined}>
                <span className="io-n">{n}</span>
                {o.scriptpubkey_address ? (
                  <a href={to.address(o.scriptpubkey_address)} className="mono">
                    {short(o.scriptpubkey_address)}
                  </a>
                ) : (
                  <span className="muted">{typeLabel[o.scriptpubkey_type] ?? o.scriptpubkey_type}</span>
                )}
                <span className="io-v">
                  {r.change?.index === n ? <span className="flag">change{r.change.confidence === "likely" ? "?" : ""}</span> : null}
                  {btc(o.value)}
                </span>
              </li>
            ))}
          </ul>
          {tx.vout.length > 40 ? <p className="muted small">+ {tx.vout.length - 40} more</p> : null}
        </div>
      </div>

      <LookupNote />
    </>
  );
}
