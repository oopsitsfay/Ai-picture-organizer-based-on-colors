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

  collection: {
    size: null as string | null,
    mintPrice: null as string | null,
    /** Parent inscription / collection ID, shown in the footer. */
    inscriptionId: null as string | null,
  },

  links: {
    x: null as string | null,
    /** Marketplace where the collection trades, e.g. Magic Eden or another Ordinals market. */
    marketplace: null as string | null,
    marketplaceName: null as string | null,
    /** Tool that shows each piece's hash power from its rarity and traits. */
    hashTool: null as string | null,
    /** Page where holders link a wallet, check production and claim. */
    claim: null as string | null,
  },
};

export const TBD = "TBD";
export const show = (v: string | null | undefined) => (v && v.trim() ? v : TBD);
