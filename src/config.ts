/**
 * Single source of truth for the site.
 *
 * Rename the project, set links and fill numbers here. `null` renders as "TBD".
 * The page title and description in index.html should match `name` / `description`.
 */
export const config = {
  name: "SHADE",
  ticker: "$SHADE",
  /** What one piece of the collection is called. */
  piece: "Shade",
  tagline: "Bitcoin, kept quiet.",
  /** Footer sign-off. The last word is set in the accent colour. */
  closingLine: "Stay in the shade.",
  description:
    "An Ordinals collection that mines $SHADE on Bitcoin. 21,000,000 supply, claimed once a week, until the next halving.",

  token: {
    maxSupply: 21_000_000,
    claimCadence: "Once a week",
    hashPower: "Rarity + floor traits",
  },

  /** Mining runs until this block. `estimate` is approximate (~10 min blocks); update it as the block nears. */
  btcHalving: {
    block: 1_050_000,
    estimate: "2028-04-15T00:00:00Z",
  },

  /**
   * Weekly claim schedule. Mining starts at `start`; the supply is split evenly across every
   * week from `start` to the halving. Week boundaries fall on the same weekday/time as `start`.
   */
  mining: {
    start: "2026-10-19T00:00:00Z", // [TBD] launch
  },

  collection: {
    /**
     * `true` while the real collection metadata isn't in yet: the market, hash power tool and
     * wallet scan run on a generated sample collection of `sampleSize` pieces.
     * Set to false and put the real list in `public/collection.json` (see README).
     */
    sample: true,
    sampleSize: 2100,
    size: null as string | null,
    mintPrice: null as string | null,
    /** Parent inscription / collection ID, shown in the footer. */
    inscriptionId: null as string | null,
  },

  /**
   * Hash power = rarity part + floor trait bonuses.
   * Rarity part: `rarityWeight` × (piece rarity score ÷ top rarity score), so the rarest piece gets the full weight.
   * Floor traits: traits that trade above the collection floor add a flat bonus each.
   */
  hashPower: {
    base: 10,
    rarityWeight: 90,
    floorTraits: {
      "Mask: Redacted": 40,
      "Eyes: Laser": 35,
      "Hood: Gold thread": 30,
      "Mark: Genesis": 50,
      "Background: Dark pool": 20,
    } as Record<string, number>,
  },

  /** Optional endpoint that accepts signed weekly claims (POST JSON). Claims stay closed while null. */
  claimApi: null as string | null,

  links: {
    x: null as string | null,
    /** Marketplace where the collection trades, e.g. Magic Eden or another Ordinals market. */
    marketplace: null as string | null,
    marketplaceName: null as string | null,
    /** Link to one piece on the marketplace. `{id}` is replaced with the inscription ID. */
    marketplaceItem: null as string | null,
  },
};

export const TBD = "TBD";
export const show = (v: string | null | undefined) => (v && v.trim() ? v : TBD);
