import { config } from "../config";

export type Trait = { type: string; value: string };

export type Piece = {
  /** Collection number, 1-based. */
  number: number;
  /** Inscription ID. Sample pieces get a placeholder. */
  id: string;
  traits: Trait[];
  rarityScore: number;
  /** 1 = rarest. */
  rank: number;
  /** Floor traits this piece carries, with their bonus. */
  floor: { trait: string; bonus: number }[];
  hashPower: number;
};

/** Trait types and their values, with relative weights for the sample collection. */
export const TRAITS: Record<string, [string, number][]> = {
  Background: [
    ["Ash", 30], ["Ember", 22], ["Fog", 22], ["Midnight", 16], ["Dark pool", 7], ["Static", 3],
  ],
  Hood: [
    ["Charcoal", 32], ["Rust", 24], ["Olive", 18], ["Bone", 14], ["Gold thread", 6], ["Void", 6],
  ],
  Mask: [
    ["None", 40], ["Bandana", 22], ["Respirator", 16], ["Plague", 10], ["Static veil", 8], ["Redacted", 4],
  ],
  Eyes: [
    ["Calm", 34], ["Tired", 26], ["Narrow", 20], ["Glow", 12], ["Laser", 5], ["Closed", 3],
  ],
  Mark: [
    ["None", 52], ["₿", 22], ["Shield", 14], ["Key", 9], ["Genesis", 3],
  ],
};

export const TRAIT_TYPES = Object.keys(TRAITS);

const key = (t: Trait) => `${t.type}: ${t.value}`;

/** Small deterministic RNG so the sample collection is identical on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(r: () => number, options: [string, number][]) {
  const total = options.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of options) {
    if ((x -= w) < 0) return v;
  }
  return options[options.length - 1][0];
}

const hex = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join("");

function sampleTraits(): { id: string; traits: Trait[] }[] {
  const r = rng(21_000_000);
  return Array.from({ length: config.collection.sampleSize }, () => ({
    id: `${hex(r, 64)}i0`,
    traits: TRAIT_TYPES.map((type) => ({ type, value: pick(r, TRAITS[type]) })),
  }));
}

/** Hash power for a set of traits, given trait counts across the collection. */
export function scoreTraits(traits: Trait[], counts: Map<string, number>, size: number) {
  const rarityScore = traits.reduce((s, t) => s + size / (counts.get(key(t)) ?? 1), 0);
  const floor = traits
    .map((t) => ({ trait: key(t), bonus: config.hashPower.floorTraits[key(t)] ?? 0 }))
    .filter((f) => f.bonus > 0);
  return { rarityScore, floor };
}

export function hashPowerFor(rarityScore: number, floor: { bonus: number }[], topScore: number) {
  const { base, rarityWeight } = config.hashPower;
  return Math.round(base + rarityWeight * (rarityScore / topScore) + floor.reduce((s, f) => s + f.bonus, 0));
}

export type Collection = {
  pieces: Piece[];
  byId: Map<string, Piece>;
  /** "Type: Value" → number of pieces with it. */
  counts: Map<string, number>;
  topScore: number;
  totalHashPower: number;
};

export function buildCollection(raw: { id: string; traits: Trait[] }[]): Collection {
  const counts = new Map<string, number>();
  for (const p of raw) for (const t of p.traits) counts.set(key(t), (counts.get(key(t)) ?? 0) + 1);

  const scored = raw.map((p, i) => ({ ...p, number: i + 1, ...scoreTraits(p.traits, counts, raw.length) }));
  const topScore = Math.max(...scored.map((p) => p.rarityScore));
  const ranked = [...scored].sort((a, b) => b.rarityScore - a.rarityScore);
  const rankOf = new Map(ranked.map((p, i) => [p.number, i + 1]));

  const pieces: Piece[] = scored.map((p) => ({
    ...p,
    rank: rankOf.get(p.number)!,
    hashPower: hashPowerFor(p.rarityScore, p.floor, topScore),
  }));

  return {
    pieces,
    byId: new Map(pieces.map((p) => [p.id, p])),
    counts,
    topScore,
    totalHashPower: pieces.reduce((s, p) => s + p.hashPower, 0),
  };
}

/**
 * Loads the collection: `public/collection.json` when `sample` is off, otherwise the generated sample.
 * The JSON is an array of `{ id, traits: [{ type, value }] }`.
 */
export async function loadCollection(): Promise<Collection> {
  if (!config.collection.sample) {
    const res = await fetch(`${import.meta.env.BASE_URL}collection.json`);
    if (!res.ok) throw new Error(`collection.json: ${res.status}`);
    return buildCollection(await res.json());
  }
  return buildCollection(sampleTraits());
}

export const traitValue = (p: Piece, type: string) => p.traits.find((t) => t.type === type)?.value ?? "None";
