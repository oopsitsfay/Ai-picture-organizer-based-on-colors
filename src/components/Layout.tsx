import { config, show } from "../config";
import { href, type Route } from "../router";
import { useApp } from "../state";
import { shortAddr } from "../lib/wallet";

const NAV: { route: Route; label: string }[] = [
  { route: "/market", label: "Market" },
  { route: "/hashpower", label: "Hash power" },
  { route: "/wallet", label: "Wallet" },
  { route: "/claim", label: "Claim" },
];

export function SectionHead({ index, eyebrow, title, sub }: { index: string; eyebrow: string; title: React.ReactNode; sub?: string }) {
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

/** Banner shown on data pages while the site runs on the generated sample collection. */
export function SampleNote() {
  if (!config.collection.sample) return null;
  return (
    <p className="note">
      <span className="tag">Sample</span> Running on a generated sample of {config.collection.sampleSize.toLocaleString("en-US")} pieces until the
      real collection is added. Numbers show how it works, not live values.
    </p>
  );
}

export function Nav({ route }: { route: Route }) {
  const { wallet } = useApp();
  return (
    <nav className="nav" aria-label="Primary">
      <a href={href("/")} className="logo">
        {config.name}
        <span className="logo-dot" aria-hidden />
      </a>
      <ul>
        {NAV.map((n) => (
          <li key={n.route}>
            <a href={href(n.route)} aria-current={route === n.route ? "page" : undefined}>
              {n.label}
            </a>
          </li>
        ))}
      </ul>
      <a className="btn btn-accent btn-sm" href={href("/wallet")}>
        {wallet ? shortAddr(wallet.address) : "Link wallet"}
      </a>
    </nav>
  );
}

/** Bottom tab bar on phones, where the top nav links are hidden. */
export function TabBar({ route }: { route: Route }) {
  return (
    <nav className="tabbar" aria-label="Pages">
      {[{ route: "/" as Route, label: "Home" }, ...NAV].map((n) => (
        <a key={n.route} href={href(n.route)} aria-current={route === n.route ? "page" : undefined}>
          {n.label}
        </a>
      ))}
    </nav>
  );
}

export function Footer() {
  const { links, collection, name } = config;
  const words = config.closingLine.split(" ");
  const last = words.pop();
  const items = [
    { l: "X", href: links.x, v: links.x ? links.x.replace(/^https?:\/\/(www\.)?/, "") : null },
    { l: "Marketplace", href: links.marketplace, v: links.marketplaceName ?? (links.marketplace ? "Open" : null) },
    { l: "Collection inscription", href: null, v: collection.inscriptionId },
  ];
  return (
    <footer className="footer">
      <p className="closing">
        {words.join(" ")} <em>{last}</em>
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
      <p className="fine">© {name}. Nothing here is financial advice. Bitcoin and Ordinals transactions are public.</p>
      <p className="wordmark" aria-hidden>
        {name}
      </p>
    </footer>
  );
}
