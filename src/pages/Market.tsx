import { useEffect, useMemo, useRef, useState } from "react";
import { config } from "../config";
import { useApp } from "../state";
import { TRAIT_TYPES, TRAITS, type Collection, type Piece } from "../data/collection";
import { fmtToken, weeklyEmission, weeklyFor } from "../lib/emission";
import { fmtInt } from "../lib/useNow";
import { href } from "../router";
import { PieceArt } from "../components/PieceArt";
import { SampleNote, SectionHead } from "../components/Layout";

type Sort = "rank" | "hash" | "number";
const PAGE = 48;

export function Market() {
  const { collection, collectionError } = useApp();
  return (
    <section className="section page">
      <SectionHead
        index="M"
        eyebrow="Market"
        title="The collection."
        sub={`Every ${config.piece}, ranked by rarity and hash power. Filter by trait, open one for the full breakdown.`}
      />
      <SampleNote />
      {collectionError ? <p className="error">Couldn't load the collection: {collectionError}</p> : null}
      {collection ? <Browser c={collection} /> : !collectionError ? <p className="muted">Loading collection…</p> : null}
    </section>
  );
}

function Browser({ c }: { c: Collection }) {
  const [sort, setSort] = useState<Sort>("rank");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [floorOnly, setFloorOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Piece | null>(null);

  const list = useMemo(() => {
    const q = query.replace(/^#/, "").trim();
    const out = c.pieces.filter(
      (p) =>
        (!q || String(p.number).startsWith(q) || p.id.startsWith(q)) &&
        (!floorOnly || p.floor.length > 0) &&
        Object.entries(filters).every(([type, v]) => p.traits.some((t) => t.type === type && t.value === v)),
    );
    const by: Record<Sort, (a: Piece, b: Piece) => number> = {
      rank: (a, b) => a.rank - b.rank,
      hash: (a, b) => b.hashPower - a.hashPower || a.rank - b.rank,
      number: (a, b) => a.number - b.number,
    };
    return out.sort(by[sort]);
  }, [c, sort, filters, floorOnly, query]);

  useEffect(() => setShown(PAGE), [sort, filters, floorOnly, query]);

  const floorCount = useMemo(() => c.pieces.filter((p) => p.floor.length).length, [c]);
  const stats = [
    { l: "Pieces", v: fmtInt(c.pieces.length) },
    { l: "Network hash power", v: fmtInt(c.totalHashPower) },
    { l: `${config.ticker} per week`, v: fmtToken(weeklyEmission, 0) },
    { l: "With floor traits", v: fmtInt(floorCount) },
  ];

  return (
    <>
      <dl className="stats stats-4">
        {stats.map((s) => (
          <div key={s.l}>
            <dt>{s.l}</dt>
            <dd>{s.v}</dd>
          </div>
        ))}
      </dl>

      <div className="controls">
        <label className="field">
          <span>Search</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="# or inscription ID" inputMode="search" />
        </label>
        <label className="field">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="rank">Rarity</option>
            <option value="hash">Hash power</option>
            <option value="number">Number</option>
          </select>
        </label>
        {TRAIT_TYPES.map((type) => (
          <label key={type} className="field">
            <span>{type}</span>
            <select
              value={filters[type] ?? ""}
              onChange={(e) =>
                setFilters((f) => {
                  const next = { ...f };
                  if (e.target.value) next[type] = e.target.value;
                  else delete next[type];
                  return next;
                })
              }
            >
              <option value="">All</option>
              {TRAITS[type].map(([v]) => (
                <option key={v} value={v}>
                  {v} ({fmtInt(c.counts.get(`${type}: ${v}`) ?? 0)})
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={floorOnly} onChange={(e) => setFloorOnly(e.target.checked)} />
          Floor traits only
        </label>
      </div>

      <p className="muted result-count">
        {fmtInt(list.length)} {list.length === 1 ? "piece" : "pieces"}
        {Object.keys(filters).length || floorOnly || query ? (
          <button
            type="button"
            className="link"
            onClick={() => {
              setFilters({});
              setFloorOnly(false);
              setQuery("");
            }}
          >
            Clear filters
          </button>
        ) : null}
      </p>

      <ul className="pieces">
        {list.slice(0, shown).map((p) => (
          <li key={p.id}>
            <button type="button" className="piece" onClick={() => setOpen(p)}>
              <PieceArt traits={p.traits} className="piece-art" />
              <span className="piece-meta">
                <span className="piece-num">#{p.number}</span>
                <span className="piece-rank">Rank {fmtInt(p.rank)}</span>
              </span>
              <span className="piece-hp">
                <span>{fmtInt(p.hashPower)}</span> HP
                {p.floor.length ? <span className="floor-dot" title="Has floor traits" /> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {shown < list.length ? (
        <div className="more">
          <button type="button" className="btn btn-ghost" onClick={() => setShown((s) => s + PAGE)}>
            Show more
          </button>
        </div>
      ) : null}

      {open ? <PieceDialog p={open} c={c} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

export function PieceDialog({ p, c, onClose }: { p: Piece; c: Collection; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const { base, rarityWeight } = config.hashPower;
  const rarityPart = p.hashPower - base - p.floor.reduce((s, f) => s + f.bonus, 0);
  const item = config.links.marketplaceItem?.replace("{id}", p.id);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-labelledby="piece-title"
    >
      <div className="dialog-body">
        <button type="button" className="dialog-close" onClick={() => ref.current?.close()} aria-label="Close">
          ×
        </button>
        <PieceArt traits={p.traits} className="dialog-art" title={`${config.piece} #${p.number}`} />
        <div>
          <p className="eyebrow">Rank {fmtInt(p.rank)} of {fmtInt(c.pieces.length)}</p>
          <h3 id="piece-title" className="dialog-title">
            {config.piece} #{p.number}
          </h3>
          <p className="mono muted small break">{p.id}</p>

          <div className="hp-total">
            <span>{fmtInt(p.hashPower)}</span> hash power
          </div>
          <ul className="breakdown">
            <li>
              <span>Base</span>
              <span>{base}</span>
            </li>
            <li>
              <span>Rarity ({Math.round((p.rarityScore / c.topScore) * 100)}% of top × {rarityWeight})</span>
              <span>{rarityPart}</span>
            </li>
            {p.floor.map((f) => (
              <li key={f.trait} className="accent">
                <span>Floor trait · {f.trait}</span>
                <span>+{f.bonus}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">
            ≈ {fmtToken(weeklyFor(p.hashPower, c.totalHashPower))} {config.ticker} per week at current network hash power.
          </p>

          <table className="traits">
            <tbody>
              {p.traits.map((t) => {
                const n = c.counts.get(`${t.type}: ${t.value}`) ?? 0;
                return (
                  <tr key={t.type}>
                    <th>{t.type}</th>
                    <td>{t.value}</td>
                    <td className="muted">{((n / c.pieces.length) * 100).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="actions">
            {item ? (
              <a className="btn btn-accent btn-sm" href={item} target="_blank" rel="noopener noreferrer">
                View on {config.links.marketplaceName ?? "marketplace"} ↗
              </a>
            ) : (
              <span className="btn btn-accent btn-sm is-disabled">
                Marketplace <span className="tag">TBD</span>
              </span>
            )}
            <a className="btn btn-ghost btn-sm" href={`${href("/hashpower")}?n=${p.number}`} onClick={() => ref.current?.close()}>
              Hash power tool
            </a>
          </div>
        </div>
      </div>
    </dialog>
  );
}
