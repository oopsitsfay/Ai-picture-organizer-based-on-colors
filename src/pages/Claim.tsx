import { useState } from "react";
import { config } from "../config";
import { useApp } from "../state";
import { fmtToken, totalWeeks, weekAt, weeklyEmission, weeklyFor, WEEK } from "../lib/emission";
import { fmtDate, fmtInt, useNow } from "../lib/useNow";
import { signMessage } from "../lib/wallet";
import { href } from "../router";
import { SampleNote, SectionHead } from "../components/Layout";
import { Connect } from "./Wallet";

const DAY = 86_400_000;
const STORE = "claimed";

function fmtLeft(ms: number) {
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

/** Weeks this browser has claimed, per address. Only used to show "Claimed"; the claim API is the record. */
function readClaimed(address: string): number[] {
  try {
    return (JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, number[]>)[address] ?? [];
  } catch {
    return [];
  }
}
function writeClaimed(address: string, weeks: number[]) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, number[]>;
    localStorage.setItem(STORE, JSON.stringify({ ...all, [address]: weeks }));
  } catch {
    /* storage unavailable */
  }
}

export function Claim() {
  const { wallet } = useApp();
  const now = useNow(1000);
  const week = weekAt(now);
  const progress = week.started ? (week.n - 1 + Math.min(1, (now - week.startsAt) / WEEK)) / totalWeeks : 0;

  return (
    <section className="section page">
      <SectionHead
        index="C"
        eyebrow="Claim"
        title="Once a week."
        sub={`${fmtToken(weeklyEmission, 0)} ${config.ticker} is split by hash power every week, until the halving.`}
      />
      <SampleNote />

      <div className="claim-grid">
        <div className="card">
          <p className="eyebrow">{week.ended ? "Mining closed" : week.started ? `Week ${week.n} of ${totalWeeks}` : "Mining starts in"}</p>
          <p className="big-num">
            {week.ended ? "Done" : week.started ? fmtLeft(week.endsAt - now) : fmtLeft(week.startsAt - now)}
          </p>
          <p className="muted">
            {week.ended
              ? `The halving has passed. ${config.ticker} supply is final.`
              : week.started
                ? `until week ${week.n} closes and becomes claimable · ${fmtDate(week.endsAt)}`
                : `First week opens ${fmtDate(week.startsAt)}`}
          </p>
          <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Mining progress to the halving">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="muted small">
            {(progress * 100).toFixed(1)}% of {fmtInt(config.token.maxSupply)} {config.ticker} mined · ends at block {fmtInt(config.btcHalving.block)}
          </p>
        </div>
        <ClaimBox key={wallet?.address ?? "none"} />
      </div>

      <Schedule current={week.n} />
    </section>
  );
}

function ClaimBox() {
  const { wallet, scan, collection } = useApp();
  const now = useNow(1000);
  const week = weekAt(now);
  const [claimed, setClaimed] = useState<number[]>(() => (wallet ? readClaimed(wallet.address) : []));
  const [state, setState] = useState<{ status: "idle" | "signing" | "sending" | "error" | "done"; msg?: string }>({ status: "idle" });

  if (!wallet) {
    return (
      <div className="card">
        <h3>Link a wallet to claim</h3>
        <Connect />
      </div>
    );
  }
  if (!collection || scan.status !== "done") {
    return (
      <div className="card">
        <h3>Your claim</h3>
        <p className="muted">{scan.status === "error" ? scan.error : "Scanning your wallet…"}</p>
      </div>
    );
  }

  const hp = scan.pieces.reduce((s, p) => s + p.hashPower, 0);
  const weekly = weeklyFor(hp, collection.totalHashPower);
  // The last finished week is the one you can claim.
  const claimWeek = week.ended ? totalWeeks : week.n - 1;
  const already = claimed.includes(claimWeek);
  const canClaim = claimWeek >= 1 && hp > 0 && !already;

  const reason = !config.claimApi
    ? "Claims open at launch."
    : wallet.kind === "watch"
      ? "This address is view-only. Connect UniSat or Xverse to sign the claim."
      : claimWeek < 1
        ? "Nothing to claim until the first week closes."
        : hp === 0
          ? `No ${config.name} pieces in this wallet.`
          : already
            ? `Week ${claimWeek} is claimed. Next claim ${fmtDate(week.endsAt)}.`
            : null;

  const claim = async () => {
    if (!config.claimApi) return;
    const message = [
      `${config.name} weekly claim`,
      `Address: ${wallet.address}`,
      `Week: ${claimWeek}`,
      `Pieces: ${scan.pieces.map((p) => p.id).join(",")}`,
      `Issued: ${new Date().toISOString()}`,
    ].join("\n");
    try {
      setState({ status: "signing" });
      const signature = await signMessage(wallet, message);
      setState({ status: "sending" });
      const res = await fetch(config.claimApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address, week: claimWeek, message, signature }),
      });
      if (!res.ok) throw new Error((await res.text()) || `Claim failed (${res.status}).`);
      const next = [...claimed, claimWeek];
      setClaimed(next);
      writeClaimed(wallet.address, next);
      setState({ status: "done", msg: `Week ${claimWeek} claimed.` });
    } catch (e) {
      setState({ status: "error", msg: (e as Error).message });
    }
  };

  return (
    <div className="card claim-box">
      <p className="eyebrow">{claimWeek >= 1 ? `Claimable · week ${claimWeek}` : "Claimable"}</p>
      <p className="big-num">
        {fmtToken(claimWeek >= 1 && !already ? weekly : 0)} <small>{config.ticker}</small>
      </p>
      <p className="muted">
        {scan.pieces.length} {scan.pieces.length === 1 ? "piece" : "pieces"} · {fmtInt(hp)} hash power · {fmtToken(weekly)} per week
      </p>
      <button
        type="button"
        className="btn btn-accent claim-btn"
        disabled={!canClaim || !!reason || state.status === "signing" || state.status === "sending"}
        onClick={claim}
      >
        {state.status === "signing" ? "Sign in your wallet…" : state.status === "sending" ? "Submitting…" : `Claim ${config.ticker}`}
      </button>
      {reason ? <p className="muted small">{reason}</p> : null}
      {state.status === "error" ? <p className="error small">{state.msg}</p> : null}
      {state.status === "done" ? <p className="ok small">{state.msg}</p> : null}
      <a className="link small" href={href("/wallet")}>
        Wallet details →
      </a>
    </div>
  );
}

function Schedule({ current }: { current: number }) {
  const start = Date.parse(config.mining.start);
  const from = Math.max(1, current - 1);
  const rows = Array.from({ length: Math.min(6, totalWeeks - from + 1) }, (_, i) => from + i);
  return (
    <div className="schedule">
      <h3>Schedule</h3>
      <table>
        <thead>
          <tr>
            <th>Week</th>
            <th>Opens</th>
            <th>Claimable from</th>
            <th>Emission</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n) => (
            <tr key={n} className={n === current ? "current" : undefined}>
              <td>
                {n}
                {n === current ? <span className="tag">Now</span> : null}
              </td>
              <td>{fmtDate(start + (n - 1) * WEEK)}</td>
              <td>{fmtDate(Math.min(Date.parse(config.btcHalving.estimate), start + n * WEEK))}</td>
              <td>
                {fmtToken(weeklyEmission, 0)} {config.ticker}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        {totalWeeks} weeks in total. The last week closes at the halving, block {fmtInt(config.btcHalving.block)}.
      </p>
    </div>
  );
}
