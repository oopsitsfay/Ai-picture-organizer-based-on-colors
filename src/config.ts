/** Site-wide settings. Rename the project here (and in index.html). */
export const config = {
  name: "GLASS",
  tagline: "Bitcoin is see-through.",
  description:
    "Paste a Bitcoin address or transaction and see what the public chain reveals: linked addresses, change, reuse, dust. Then fix it.",

  /** Default block explorer API (mempool.space-compatible). Users can point this at their own node in Settings. */
  apiBase: "https://mempool.space/api",

  /** Public, well-known examples for the "try one" buttons. */
  examples: [
    { label: "Genesis address", value: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" },
    { label: "Pizza transaction", value: "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d" },
  ],

  links: {
    x: null as string | null,
    github: "https://github.com/oopsitsfay/Ai-picture-organizer-based-on-colors" as string | null,
  },
};
