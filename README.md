# GLASS

*Bitcoin is see-through.*

Paste a Bitcoin address or transaction ID and see what the public chain reveals about it, scored from 0 to 100, with a fix for every leak.

- **Address report:** address reuse, addresses linked by spending together (common-input ownership), change sent back to the same address, round payments that give away change, merged coins, dust, address type, CoinJoin participation. Lists the addresses that probably share an owner and flags each recent transaction.
- **Transaction report:** which inputs get clustered, which output is change and why, CoinJoin detection, legacy scripts, OP_RETURN, fee rate, and the full input → output flow.
- **Grades:** 85+ Frosted · 65+ Tinted · 40+ Clear · under 40 See-through.
- **Fix your privacy:** six habits that defeat the common heuristics.
- **Settings:** point GLASS at your own mempool instance so no third party sees your lookups.

No backend, no accounts, no tracking. The browser talks to a mempool.space-compatible API directly, and the analysis runs locally (`src/lib/analyze.ts`). Results are heuristics, the same ones chain analysts use, not certainties.

Built with Vite, React and TypeScript. Deployed on Vercel from `main`.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm run preview
```

## Editing

| What | Where |
|---|---|
| Name, tagline, default API, example lookups, links | `src/config.ts` (and the title in `index.html`) |
| Heuristics, scoring and wording of findings | `src/lib/analyze.ts` |
| Landing page copy | `src/pages/Home.tsx` |
| Privacy habits | `src/pages/Learn.tsx` |
