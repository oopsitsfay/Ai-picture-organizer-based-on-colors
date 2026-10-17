import { useState } from "react";
import { config } from "../config";
import { getApiBase, setApiBase } from "../lib/api";
import { to } from "../router";

const HABITS = [
  {
    title: "A fresh address for every payment",
    body: "Reuse is the easiest leak to avoid. Every HD wallet (Sparrow, BlueWallet, Bitcoin Core, most hardware wallets) gives you a new address each time. Don't post one address in your bio.",
  },
  {
    title: "Spend one source at a time",
    body: "Spending coins together tells the world they're yours. Use coin control and label coins by where they came from. Never mix KYC exchange coins with ones you got privately in the same spend.",
  },
  {
    title: "Freeze dust",
    body: "Tiny unexpected amounts are often sent to make you link your coins. Freeze them in coin control and leave them alone.",
  },
  {
    title: "Make change hard to spot",
    body: "Round amounts, mixed address types and change sent back to the same address all point at your change. Use Taproot or SegWit, avoid round sends where you can, and let your wallet handle change addresses.",
  },
  {
    title: "Break the trail",
    body: "CoinJoin mixes your coins with others into identical outputs, and PayJoin hides who paid what in a normal-looking payment. Both make the common heuristics fail.",
  },
  {
    title: "Run your own node, use Tor",
    body: "Looking up your own address on a public explorer, including through this site, tells that explorer which addresses you care about. Your own node plus Tor removes that link entirely.",
  },
];

export function Learn() {
  return (
    <section className="section page">
      <header className="section-head">
        <p className="eyebrow">
          <span className="accent">→</span>
          <span className="rule" />
          Fix your privacy
        </p>
        <h2>Six habits that frost the glass.</h2>
        <p className="lede">No new coin, no app to trust. Just how you use Bitcoin.</p>
      </header>
      <ol className="habits">
        {HABITS.map((h, i) => (
          <li key={h.title} className="card glass-card">
            <span className="index">{String(i + 1).padStart(2, "0")}</span>
            <h3>{h.title}</h3>
            <p>{h.body}</p>
          </li>
        ))}
      </ol>
      <div className="actions">
        <a className="btn btn-accent" href={to.home("scan")}>
          Scan an address →
        </a>
      </div>
    </section>
  );
}

export function Settings() {
  const [v, setV] = useState(getApiBase);
  const [saved, setSaved] = useState(false);
  const isDefault = v.trim().replace(/\/+$/, "") === config.apiBase;

  return (
    <section className="section page">
      <header className="section-head">
        <p className="eyebrow">
          <span className="accent">⚙</span>
          <span className="rule" />
          Settings
        </p>
        <h2>Use your own node.</h2>
        <p className="lede">
          {config.name} works with any mempool.space-compatible API. Point it at your own mempool instance (Umbrel, Start9, RaspiBlitz
          and others ship one) and no third party sees your lookups.
        </p>
      </header>
      <form
        className="card settings"
        onSubmit={(e) => {
          e.preventDefault();
          setApiBase(v);
          setV(getApiBase());
          setSaved(true);
        }}
      >
        <label className="field">
          <span>Explorer API</span>
          <input
            value={v}
            onChange={(e) => {
              setV(e.target.value);
              setSaved(false);
            }}
            placeholder={config.apiBase}
            spellCheck={false}
          />
        </label>
        <p className="muted small">
          Example: <code>http://umbrel.local:3006/api</code>. The API must allow requests from this site (CORS). Saved in this browser
          only.
        </p>
        <div className="actions">
          <button type="submit" className="btn btn-accent">
            Save
          </button>
          {!isDefault ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setApiBase(null);
                setV(config.apiBase);
                setSaved(true);
              }}
            >
              Reset to mempool.space
            </button>
          ) : null}
        </div>
        {saved ? <p className="ok small">Saved. New scans use {getApiBase()}.</p> : null}
      </form>
    </section>
  );
}
