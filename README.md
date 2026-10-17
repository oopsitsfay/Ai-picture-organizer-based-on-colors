# SHADE

*Bitcoin, kept quiet.*

A BTC + privacy Ordinals collection that mines `$SHADE`: 21,000,000 max supply, claimed once a week,
until the next Bitcoin halving (block 1,050,000). Hash power comes from rarity + floor traits.

Pages (hash routes, so it runs on any static host):

| Page | What it does |
|---|---|
| `#/` | Landing: narrative, how the mine works, halving countdown, quick guide, numbers, FAQ |
| `#/market` | Browse the collection: sort by rarity / hash power, filter by trait, open a piece for its full breakdown |
| `#/hashpower` | Look up any piece, or build a trait set, and see its hash power, rank and weekly production |
| `#/wallet` | Connect UniSat or Xverse (or paste an address) and scan it for pieces and production |
| `#/claim` | Weekly schedule, what's claimable, and a signed claim submitted to `claimApi` |

Built with Vite, React and TypeScript. No backend.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm run preview
```

## Editing content

Everything lives in [`src/config.ts`](src/config.ts). `null` renders as "TBD".

| What | Config |
|---|---|
| Project name, ticker, what a piece is called | `name`, `ticker`, `piece` |
| Tagline, description, footer sign-off | `tagline`, `description`, `closingLine` |
| Supply, claim cadence, hash power rule | `token` |
| Halving block and estimated date (countdown) | `btcHalving` |
| Collection size, mint price, inscription ID | `collection` |
| X, marketplace, hash power tool, claim page | `links` |

| Mining start (week 1) | `mining.start` |
| Hash power formula and floor trait bonuses | `hashPower` |
| Claim endpoint | `claimApi` |
| Link to one piece on the marketplace | `links.marketplaceItem` (`{id}` = inscription ID) |

The page `<title>` and meta description in `index.html` should match the config.

## Going live

The site starts on a **generated sample collection** (`collection.sample: true`) so every page works before launch. A banner says so on the market, hash power, wallet and claim pages.

1. **Collection.** Put the real list in `public/collection.json` as `[{ "id": "<inscription id>", "traits": [{ "type": "Mask", "value": "Redacted" }, …] }, …]` and set `collection.sample` to `false`. Rarity, ranks and hash power are computed from it. Update `TRAITS` in `src/data/collection.ts` to match the real trait types and values (used for filters and the trait builder), and `src/components/PieceArt.tsx` or real images for the art.
2. **Wallet scan.** With the sample off, a wallet's inscriptions come from the public Hiro Ordinals API and are matched against `collection.json`.
3. **Claims.** Set `claimApi`. The claim button has the connected wallet sign a message (address, week, piece IDs) and POSTs `{ address, week, message, signature }` as JSON. The backend must verify the signature, check holdings at the week's close, prevent double claims and send the tokens. That backend isn't part of this repo, and claims stay closed until it exists.
