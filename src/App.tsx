import { config, show, TBD } from "./config";
import { fmtInt } from "./useNow";
import { Countdown } from "./components/Countdown";
import { Ledger } from "./components/Ledger";

const { name, ticker, piece, token, btcHalving, collection, links } = config;
const halvingBlock = fmtInt(btcHalving.block);
const closingWords = config.closingLine.split(" ");
const closingLast = closingWords.pop();
const closingLead = closingWords.join(" ");

const NAV = [
  { id: "narrative", label: "Narrative" },
  { id: "mine", label: "The mine" },
  { id: "guide", label: "Quick guide" },
  { id: "token", label: ticker },
  { id: "faq", label: "FAQ" },
];

function LinkOrTbd({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? (
    <a className="btn btn-ghost" href={href} target="_blank" rel="noopener noreferrer">
      {children} <span aria-hidden>↗</span>
    </a>
  ) : (
    <span className="btn btn-ghost is-disabled" aria-disabled="true">
      {children} <span className="tag">{TBD}</span>
    </span>
  );
}

function SectionHead({ index, eyebrow, title, sub }: { index: string; eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <header className="section-head">
      <p className="eyebrow">
        <span className="accent">{index}</span>
        <span className="rule" />
        {eyebrow}
      </p>
      <h2>{title}</h2>
      {sub ? <p className="lede">{sub}</p> : null}
    </header>
  );
}

function Nav() {
  return (
    <nav className="nav" aria-label="Primary">
      <a href="#top" className="logo">
        {name}
        <span className="logo-dot" aria-hidden />
      </a>
      <ul>
        {NAV.map((n) => (
          <li key={n.id}>
            <a href={`#${n.id}`}>{n.label}</a>
          </li>
        ))}
      </ul>
      {links.marketplace ? (
        <a className="btn btn-accent btn-sm" href={links.marketplace} target="_blank" rel="noopener noreferrer">
          Get a {piece}
        </a>
      ) : (
        <span className="btn btn-accent btn-sm is-disabled">Soon</span>
      )}
    </nav>
  );
}

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
            {links.marketplace ? (
              <a className="btn btn-accent" href={links.marketplace} target="_blank" rel="noopener noreferrer">
                Get a {piece} <span aria-hidden>↗</span>
              </a>
            ) : (
              <span className="btn btn-accent is-disabled" aria-disabled="true">
                Get a {piece} <span className="tag">Soon</span>
              </span>
            )}
            <a className="btn btn-ghost" href="#guide">
              Quick guide <span aria-hidden>→</span>
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
      body: `The hardest money on the most secure chain. ${name} lives there as Ordinals, and ${ticker} copies Bitcoin's rules: a ${fmtInt(token.maxSupply)} cap, emissions that only go down, and a hard stop at the halving.`,
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
    { title: "Hash power", body: `Set by ${token.hashPower.toLowerCase()}. Rarer pieces and stronger traits mine more.` },
    { title: "Claim weekly", body: `Production adds up over the week. Claim ${token.claimCadence.toLowerCase()}.` },
    { title: "Halving", body: `Mining stops at Bitcoin block ${halvingBlock}. After that, the supply is final.` },
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
  const steps = [
    {
      title: `Get a ${piece}`,
      body: `The collection trades as Ordinals${links.marketplaceName ? ` on ${links.marketplaceName}` : ""}.`,
      link: { href: links.marketplace, label: "Marketplace" },
    },
    {
      title: "Check its hash power",
      body: `Hash power is set by ${token.hashPower.toLowerCase()}. Look up any piece before you buy.`,
      link: { href: links.hashTool, label: "Hash power tool" },
    },
    {
      title: "Link your wallet",
      body: "Connect the wallet that holds your pieces, then scan it to see what it is producing.",
      link: { href: links.claim, label: "Check production" },
    },
    {
      title: "Claim once a week",
      body: `Come back weekly and claim your ${ticker}, until block ${halvingBlock}.`,
      link: { href: links.claim, label: "Claim" },
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
            <LinkOrTbd href={s.link.href}>{s.link.label}</LinkOrTbd>
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
    { l: "Claims", v: token.claimCadence },
    { l: "Mining ends", v: `Next BTC halving · block ${halvingBlock}` },
    { l: "Hash power", v: token.hashPower },
    { l: "Collection size", v: collection.size },
    { l: "Mint price", v: collection.mintPrice },
    { l: "Chain", v: "Bitcoin (Ordinals)" },
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
      a: `By ${token.hashPower.toLowerCase()}. Every piece has its own number, and you can look it up before you buy.`,
    },
    {
      q: "When can I claim?",
      a: `${token.claimCadence}, from the claim page, until block ${halvingBlock}.`,
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

function Footer() {
  const items = [
    { l: "X", href: links.x, v: links.x ? links.x.replace(/^https?:\/\/(www\.)?/, "") : null },
    { l: "Marketplace", href: links.marketplace, v: links.marketplaceName ?? (links.marketplace ? "Open" : null) },
    { l: "Collection inscription", href: null, v: collection.inscriptionId },
  ];
  return (
    <footer className="footer">
      <p className="closing">
        {closingLead} <em>{closingLast}</em>
      </p>
      <ul className="footer-links">
        {items.map((it) => (
          <li key={it.l}>
            <span>{it.l}</span>
            {it.href && it.v ? (
              <a href={it.href} target="_blank" rel="noopener noreferrer">
                {it.v} ↗
              </a>
            ) : (
              <span className={it.v ? "mono" : "mono tbd"}>{show(it.v)}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="fine">
        © {name}. Nothing here is financial advice. Bitcoin and Ordinals transactions are public.
      </p>
      <p className="wordmark" aria-hidden>
        {name}
      </p>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <a href="#narrative" className="skip">
        Skip to content
      </a>
      <Nav />
      <main>
        <Hero />
        <Narrative />
        <Mine />
        <Guide />
        <Tokenomics />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
