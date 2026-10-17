import { useMemo, useState } from "react";
import { config } from "../config";
import { useApp } from "../state";
import { hashPowerFor, scoreTraits, TRAIT_TYPES, TRAITS, type Collection, type Trait } from "../data/collection";
import { fmtToken, weeklyFor } from "../lib/emission";
import { fmtInt } from "../lib/useNow";
import { PieceArt } from "../components/PieceArt";
import { SampleNote, SectionHead } from "../components/Layout";

/** `#/hashpower?n=12` opens the tool on piece #12. */
function initialNumber() {
  const n = Number(new URLSearchParams(window.location.hash.split("?")[1]).get("n"));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function HashPower() {
  const { collection, collectionError } = useApp();
  return (
    <section className="section page">
      <SectionHead
        index="H"
        eyebrow="Hash power"
        title="Rarity + floor traits."
        sub="Look up any piece, or build a trait set and see what it would mine."
      />
      <SampleNote />
      {collectionError ? <p className="error">Couldn't load the collection: {collectionError}</p> : null}
      {collection ? <Tool c={collection} /> : !collectionError ? <p className="muted">Loading collection…</p> : null}
      <Formula />
    </section>
  );
}

function Tool({ c }: { c: Collection }) {
  const [mode, setMode] = useState<"lookup" | "build">("lookup");
  const [num, setNum] = useState(() => Math.min(initialNumber(), c.pieces.length));
  const [built, setBuilt] = useState<Record<string, string>>(() =>
    Object.fromEntries(TRAIT_TYPES.map((t) => [t, TRAITS[t][0][0]])),
  );

  const traits: Trait[] = useMemo(
    () => (mode === "lookup" ? c.pieces[num - 1].traits : TRAIT_TYPES.map((type) => ({ type, value: built[type] }))),
    [mode, num, built, c],
  );

  const result = useMemo(() => {
    const { rarityScore, floor } = scoreTraits(traits, c.counts, c.pieces.length);
    const hp = hashPowerFor(rarityScore, floor, c.topScore);
    const rank = c.pieces.filter((p) => p.rarityScore > rarityScore + 1e-9).length + 1;
    // A built set that isn't in the collection adds its hash power to the network.
    const inCollection = mode === "lookup";
    const network = inCollection ? c.totalHashPower : c.totalHashPower + hp;
    return { rarityScore, floor, hp, rank, share: hp / network, weekly: weeklyFor(hp, network) };
  }, [traits, c, mode]);

  const { base, rarityWeight } = config.hashPower;
  const floorSum = result.floor.reduce((s, f) => s + f.bonus, 0);
  const rarityPart = result.hp - base - floorSum;
  const max = base + rarityWeight + Object.values(config.hashPower.floorTraits).sort((a, b) => b - a).slice(0, TRAIT_TYPES.length).reduce((s, v) => s + v, 0);

  return (
    <div className="tool">
      <div className="card tool-input">
        <div className="segmented" role="tablist" aria-label="Mode">
          <button type="button" role="tab" aria-selected={mode === "lookup"} onClick={() => setMode("lookup")}>
            Look up a piece
          </button>
          <button type="button" role="tab" aria-selected={mode === "build"} onClick={() => setMode("build")}>
            Build traits
          </button>
        </div>

        {mode === "lookup" ? (
          <label className="field">
            <span>Piece number (1–{fmtInt(c.pieces.length)})</span>
            <div className="stepper">
              <button type="button" onClick={() => setNum((n) => Math.max(1, n - 1))} aria-label="Previous piece">
                −
              </button>
              <input
                type="number"
                min={1}
                max={c.pieces.length}
                value={num}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  if (n >= 1 && n <= c.pieces.length) setNum(n);
                }}
              />
              <button type="button" onClick={() => setNum((n) => Math.min(c.pieces.length, n + 1))} aria-label="Next piece">
                +
              </button>
            </div>
          </label>
        ) : null}

        <div className="trait-fields">
          {TRAIT_TYPES.map((type) => {
            const value = traits.find((t) => t.type === type)!.value;
            const bonus = config.hashPower.floorTraits[`${type}: ${value}`];
            return (
              <label key={type} className="field">
                <span>
                  {type}
                  {bonus ? <em className="accent"> floor +{bonus}</em> : null}
                </span>
                <select value={value} disabled={mode === "lookup"} onChange={(e) => setBuilt((b) => ({ ...b, [type]: e.target.value }))}>
                  {TRAITS[type].map(([v]) => {
                    const n = c.counts.get(`${type}: ${v}`) ?? 0;
                    return (
                      <option key={v} value={v}>
                        {v} · {((n / c.pieces.length) * 100).toFixed(1)}%
                      </option>
                    );
                  })}
                </select>
              </label>
            );
          })}
        </div>
      </div>

      <div className="card tool-result">
        <PieceArt traits={traits} className="tool-art" title={mode === "lookup" ? `${config.piece} #${num}` : "Built trait set"} />
        <div>
          <p className="eyebrow">{mode === "lookup" ? `${config.piece} #${num}` : "Built trait set"}</p>
          <div className="hp-total">
            <span>{fmtInt(result.hp)}</span> hash power
          </div>
          <div className="meter" aria-hidden>
            <span className="meter-base" style={{ width: `${(base / max) * 100}%` }} />
            <span className="meter-rarity" style={{ width: `${(rarityPart / max) * 100}%` }} />
            <span className="meter-floor" style={{ width: `${(floorSum / max) * 100}%` }} />
          </div>
          <ul className="breakdown">
            <li>
              <span>Base</span>
              <span>{base}</span>
            </li>
            <li>
              <span>Rarity · score {result.rarityScore.toFixed(1)}</span>
              <span>{rarityPart}</span>
            </li>
            <li className={floorSum ? "accent" : undefined}>
              <span>Floor traits{result.floor.length ? ` · ${result.floor.map((f) => f.trait.split(": ")[1]).join(", ")}` : ""}</span>
              <span>+{floorSum}</span>
            </li>
          </ul>
          <dl className="mini-stats">
            <div>
              <dt>Rarity rank</dt>
              <dd>
                {fmtInt(result.rank)} / {fmtInt(c.pieces.length)}
              </dd>
            </div>
            <div>
              <dt>Network share</dt>
              <dd>{(result.share * 100).toFixed(3)}%</dd>
            </div>
            <div>
              <dt>Per week</dt>
              <dd>
                {fmtToken(result.weekly)} {config.ticker}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function Formula() {
  const { base, rarityWeight, floorTraits } = config.hashPower;
  return (
    <div className="formula">
      <div className="card">
        <h3>How it's calculated</h3>
        <p className="mono formula-line">
          hash power = {base} + {rarityWeight} × (rarity score ÷ top score) + floor bonuses
        </p>
        <p className="muted">
          A trait's rarity is the collection size divided by how many pieces share it. A piece's rarity score adds those up across
          its traits, so rarer combinations score higher. The rarest piece gets the full {rarityWeight}. Floor traits trade above
          the collection floor and add a flat bonus each.
        </p>
      </div>
      <div className="card">
        <h3>Floor traits</h3>
        <ul className="breakdown">
          {Object.entries(floorTraits)
            .sort((a, b) => b[1] - a[1])
            .map(([t, b]) => (
              <li key={t}>
                <span>{t}</span>
                <span className="accent">+{b}</span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
