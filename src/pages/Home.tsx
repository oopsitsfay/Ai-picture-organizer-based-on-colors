import { config, show } from "../config";
import { href, type Route } from "../router";
import { fmtInt } from "../lib/useNow";
import { fmtToken, totalWeeks, weeklyEmission } from "../lib/emission";
import { Countdown } from "../components/Countdown";
import { Ledger } from "../components/Ledger";
import { SectionHead } from "../components/Layout";

const { name, ticker, piece, token, btcHalving, collection } = config;
const halvingBlock = fmtInt(btcHalving.block);
const hashRule = token.hashPower.toLowerCase();

function Hero() {
  const stats = [
    { v: fmtInt(token.maxSupply), l: `${ticker} max supply` },
    { v: token.claimCadence, l: "Claims" },
    { v: `Block ${halvingBlock}`, l: "Mining ends" },
  ];
  return (
    <section id="top" className="hero">
      <div className="hero-grid">
        <div>
          <p className="eyebrow">
            <span className="pulse" aria-hidden /> BTC + privacy · Ordinals
          </p>
          <h1>
            Bitcoin,
            <br />
            <em>kept quiet.</em>
          </h1>
          <p className="lede">{config.description}</p>
          <div className="actions">
            <a className="btn btn-accent" href={href("/market")}>
              Open the market <span aria-hidden>→</span>
            </a>
            <a className="btn btn-ghost" href={href("/", "guide")}>
              Quick guide <span aria-hidden>↓</span>
            </a>
          </div>
        </div>
        <Ledger />
      </div>
      <dl className="stats">
        {stats.map((s) => (
          <div key={s.l}>
            <dt>{s.l}</dt>
            <dd>{s.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Narrative() {
  const pillars = [
    {
      title: "Bitcoin is the base.",
      body: `The hardest money on the most secure chain. ${name} lives there as Ordinals, and ${ticker} copies Bitcoin's rules: a ${fmtInt(token.maxSupply)} cap, a fixed schedule, and a hard stop at the halving.`,
    },
    {
      title: "Privacy is the trend.",
      body: `Privacy is back as one of the loudest themes in the market. Bitcoin + privacy is where it goes next, and ${name} is built around that from day one.`,
    },
    {
      title: "Quiet by design.",
      body: `No sign-ups, no KYC, no lock-ups. Your ${piece} stays in your own wallet and mines there. Nothing to announce, nothing to show.`,
    },
  ];
  return (
    <section id="narrative" className="section">
      <SectionHead
        index="01"
        eyebrow="The narrative"
        title={
          <>
            BTC <span className="accent">+</span> privacy.
          </>
        }
        sub="Two of the strongest ideas in crypto, in one collection."
      />
      <div className="grid-3">
        {pillars.map((p, i) => (
          <article key={p.title} className="card pillar">
            <span className="index">{String(i + 1).padStart(2, "0")}</span>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Mine() {
  const steps = [
    { title: "Hold", body: `Every ${piece} is a miner. Hold one in your own wallet and it produces ${ticker}.` },
    { title: "Hash power", body: `Set by ${hashRule}. Rarer pieces and floor traits mine more.` },
    { title: "Claim weekly", body: `${fmtToken(weeklyEmission, 0)} ${ticker} is shared each week by hash power. Claim ${token.claimCadence.toLowerCase()}.` },
    { title: "Halving", body: `Mining stops at Bitcoin block ${halvingBlock}, after ${totalWeeks} weeks. Then the supply is final.` },
  ];
  return (
    <section id="mine" className="section section-alt">
      <div className="split">
        <SectionHead
          index="02"
          eyebrow="The mine"
          title="Hold. Mine. Claim."
          sub={`${ticker} runs on Bitcoin's clock. Mining is open until the next halving, then it closes for good.`}
        />
        <Countdown />
      </div>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.title} className="card">
            <span className="index">{String(i + 1).padStart(2, "0")}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Guide() {
  const steps: { title: string; body: string; route: Route; label: string }[] = [
    {
      title: `Get a ${piece}`,
      body: `Browse the collection, sort by rarity or hash power, and pick one up${config.links.marketplaceName ? ` on ${config.links.marketplaceName}` : ""}.`,
      route: "/market",
      label: "Market",
    },
    {
      title: "Check its hash power",
      body: `Hash power is set by ${hashRule}. Look up any piece, or build a trait set, before you buy.`,
      route: "/hashpower",
      label: "Hash power",
    },
    {
      title: "Link your wallet",
      body: "Connect the wallet that holds your pieces, then scan it to see what it produces each week.",
      route: "/wallet",
      label: "Scan wallet",
    },
    {
      title: "Claim once a week",
      body: `Come back weekly and claim your ${ticker}, until block ${halvingBlock}.`,
      route: "/claim",
      label: "Claim",
    },
  ];
  return (
    <section id="guide" className="section">
      <SectionHead index="03" eyebrow="Quick guide" title={`Playing with ${name}`} sub="Four steps, start to claim." />
      <ol className="guide">
        {steps.map((s, i) => (
          <li key={s.title}>
            <span className="guide-num">{i + 1}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
            <a className="btn btn-ghost" href={href(s.route)}>
              {s.label} <span aria-hidden>→</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Tokenomics() {
  const rows = [
    { l: "Ticker", v: ticker },
    { l: "Max supply", v: fmtInt(token.maxSupply) },
    { l: "Per week", v: `${fmtToken(weeklyEmission, 0)} ${ticker}` },
    { l: "Mining ends", v: `Next BTC halving · block ${halvingBlock}` },
    { l: "Hash power", v: token.hashPower },
    { l: "Claims", v: token.claimCadence },
    { l: "Collection size", v: collection.size },
    { l: "Mint price", v: collection.mintPrice },
  ];
  return (
    <section id="token" className="section section-alt">
      <SectionHead index="04" eyebrow="Numbers" title={ticker} sub="Capped like Bitcoin. Mined, then done." />
      <dl className="table">
        {rows.map((r) => (
          <div key={r.l}>
            <dt>{r.l}</dt>
            <dd className={r.v ? undefined : "tbd"}>{show(r.v)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: `Is ${name} a privacy coin?`,
      a: `No. ${name} is an Ordinals collection, and Bitcoin is a public ledger. The privacy side is the narrative and the culture: no sign-ups, no KYC, nothing to show off. It is not a tool for hiding funds.`,
    },
    {
      q: "Why does mining end at the halving?",
      a: `It ties ${ticker} to Bitcoin's own clock. A fixed window means a fixed supply, and the people who hold early mine the most.`,
    },
    {
      q: "How is hash power set?",
      a: `By ${hashRule}. Rarity sets most of it, and floor traits add a flat bonus on top. The hash power page shows the full breakdown for any piece.`,
    },
    {
      q: "When can I claim?",
      a: `${token.claimCadence}, from the claim page, until block ${halvingBlock}. Each week's ${ticker} is split across all pieces by hash power.`,
    },
  ];
  return (
    <section id="faq" className="section">
      <SectionHead index="05" eyebrow="FAQ" title="Asked quietly." />
      <div className="faq">
        {items.map((it) => (
          <details key={it.q} className="card">
            <summary>
              {it.q}
              <span className="plus" aria-hidden />
            </summary>
            <p>{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function Home() {
  return (
    <>
      <Hero />
      <Narrative />
      <Mine />
      <Guide />
      <Tokenomics />
      <Faq />
    </>
  );
}
