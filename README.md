# SHADE

*Bitcoin, kept quiet.*

A single-page site for a BTC + privacy Ordinals collection that mines `$SHADE`:
21,000,000 max supply, claimed once a week, until the next Bitcoin halving (block 1,050,000).

Sections: Hero → Narrative (BTC + privacy) → The mine (with halving countdown) → Quick guide → `$SHADE` numbers → FAQ → Links.

Built with Vite, React and TypeScript. No wallet connection; the site links out to the marketplace, hash power tool and claim page.

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

The page `<title>` and meta description in `index.html` should match the config.
