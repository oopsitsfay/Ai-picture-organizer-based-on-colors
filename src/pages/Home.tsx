import { config } from "../config";
import { to } from "../router";
import { ScanBox } from "../components/ui";

/** Decorative: a transaction graph where some links light up, the way an analyst clusters addresses. */
function Graph() {
  const nodes = [
    { x: 40, y: 60 }, { x: 120, y: 30 }, { x: 210, y: 70 }, { x: 300, y: 40 },
    { x: 80, y: 150 }, { x: 170, y: 140 }, { x: 260, y: 160 }, { x: 340, y: 120 },
    { x: 50, y: 240 }, { x: 140, y: 230 }, { x: 230, y: 250 }, { x: 320, y: 220 },
  ];
  const edges = [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 2], [5, 6], [6, 7], [3, 7], [4, 8], [8, 9], [9, 5], [9, 10], [10, 6], [10, 11], [11, 7]];
  const hot = new Set([3, 9, 10]); // edges inside the cluster
  const inCluster = [0, 4, 8, 9];
  return (
    <svg viewBox="0 0 380 290" className="graph" aria-hidden>
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} className={hot.has(i) ? "edge edge-hot" : "edge"} style={{ animationDelay: `${i * 0.25}s` }} />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={inCluster.includes(i) ? 7 : 5} className={inCluster.includes(i) ? "node node-hot" : "node"} />
      ))}
      <rect x="22" y="40" width="136" height="216" rx="18" className="cluster" />
      <text x="26" y="282" className="graph-label">
        cluster #4,812 · same owner?
      </text>
    </svg>
  );
}

export function Home() {
  const sees = [
    {
      title: "Every payment, forever",
      body: "Amounts, times and addresses are public the moment they confirm, and they never go away. Chain analysis firms read them for a living.",
    },
    {
      title: "One slip links it all",
      body: "Spend two coins together and they're assumed to be yours. Reuse an address and every payment to it is joined. Clusters grow from there.",
    },
    {
      title: "Then a name gets attached",
      body: "All it takes is one link to an exchange account, an invoice or a post. After that, the whole cluster has your name on it.",
    },
  ];
  const checks = [
    ["Address reuse", "Payments tied together through one address."],
    ["Linked addresses", "Coins spent together, so analysts treat them as one owner."],
    ["Change detection", "Round amounts, matching address types and change sent back home."],
    ["Coin merging", "Many inputs collapsed into one spend."],
    ["Dust", "Tiny amounts sent to trick you into linking your coins."],
    ["Address type", "Older formats that make you easier to fingerprint."],
    ["CoinJoin", "Equal-output transactions that actually break the trail. These raise your score."],
  ];

  return (
    <>
      <section id="top" className="hero">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">
              <span className="pulse" aria-hidden /> BTC + privacy
            </p>
            <h1>
              Bitcoin is
              <br />
              <em>see&#8209;through.</em>
            </h1>
            <p className="lede">{config.description}</p>
          </div>
          <Graph />
        </div>
        <div id="scan" className="hero-scan">
          <ScanBox />
        </div>
      </section>

      <section className="section">
        <header className="section-head">
          <p className="eyebrow">
            <span className="accent">01</span>
            <span className="rule" />
            What the chain sees
          </p>
          <h2>
            Pseudonymous <span className="dim">is not</span> private.
          </h2>
        </header>
        <div className="grid-3">
          {sees.map((s, i) => (
            <article key={s.title} className="card glass-card">
              <span className="index">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="section section-alt">
        <div className="split">
          <header className="section-head">
            <p className="eyebrow">
              <span className="accent">02</span>
              <span className="rule" />
              How it works
            </p>
            <h2>Read your wallet like an analyst would.</h2>
            <p className="lede">
              {config.name} runs the same public heuristics chain analysts use, then scores what's left exposed from 0 to 100 and
              tells you how to fix each leak.
            </p>
            <ul className="grades">
              <li className="g-good">
                <b>85+</b> Frosted
              </li>
              <li className="g-ok">
                <b>65+</b> Tinted
              </li>
              <li className="g-warn">
                <b>40+</b> Clear
              </li>
              <li className="g-bad">
                <b>&lt;40</b> See-through
              </li>
            </ul>
          </header>
          <ol className="checks">
            {checks.map(([t, d]) => (
              <li key={t}>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="promise card glass-card">
          <div>
            <p className="eyebrow">
              <span className="accent">03</span>
              <span className="rule" />
              No server
            </p>
            <h2 className="promise-title">We don't see your scans.</h2>
          </div>
          <div className="promise-body">
            <p>
              {config.name} is a static page. Your browser asks a block explorer directly, and the analysis runs on your device. No
              accounts, no tracking, nothing stored.
            </p>
            <p>
              The explorer still sees the request, so for your own wallets, use Tor or point {config.name} at your own node in{" "}
              <a href={to.settings()}>Settings</a>.
            </p>
            <a className="btn btn-ghost" href={to.learn()}>
              How to fix your privacy →
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
