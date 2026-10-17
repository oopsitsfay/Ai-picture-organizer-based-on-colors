import type { Trait } from "../data/collection";

const BG: Record<string, [string, string]> = {
  Ash: ["#3a3632", "#24211f"],
  Ember: ["#5a2a12", "#2a140a"],
  Fog: ["#55585a", "#2f3133"],
  Midnight: ["#1b2440", "#0c1020"],
  "Dark pool": ["#0e2a2a", "#050f10"],
  Static: ["#2a2a2a", "#111"],
};

const HOOD: Record<string, string> = {
  Charcoal: "#2b2927",
  Rust: "#8a3d1c",
  Olive: "#4d5332",
  Bone: "#cfc6b6",
  "Gold thread": "#b88a2a",
  Void: "#070606",
};

const EYE = "#f2ece3";
const BTC = "#f7931a";

/** Procedural art for a piece: a hooded figure whose face stays in the dark. */
export function PieceArt({ traits, title, className }: { traits: Trait[]; title?: string; className?: string }) {
  const t = Object.fromEntries(traits.map((x) => [x.type, x.value]));
  const [bgA, bgB] = BG[t.Background] ?? BG.Ash;
  const hood = HOOD[t.Hood] ?? HOOD.Charcoal;
  const gid = `g-${traits.map((x) => x.value).join("-").replace(/[^a-z0-9-]/gi, "")}`;
  const eyesHidden = t.Mask === "Redacted";

  return (
    <svg viewBox="0 0 200 200" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={gid} cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor={bgA} />
          <stop offset="1" stopColor={bgB} />
        </radialGradient>
      </defs>
      <rect width="200" height="200" fill={`url(#${gid})`} />
      {t.Background === "Static" &&
        Array.from({ length: 20 }, (_, i) => (
          <rect key={i} x="0" y={i * 10 + 2} width="200" height="1.5" fill="#fff" opacity={0.04 + (i % 3) * 0.02} />
        ))}
      {t.Background === "Dark pool" && <ellipse cx="100" cy="196" rx="90" ry="14" fill="#1f5454" opacity=".5" />}

      {/* shoulders + hood */}
      <path d="M22 200c4-38 30-58 78-58s74 20 78 58z" fill={hood} />
      <path d="M100 30c-38 0-58 30-58 66 0 26 10 46 26 56h64c16-10 26-30 26-56 0-36-20-66-58-66z" fill={hood} />
      {t.Hood === "Gold thread" && (
        <path d="M100 34c-34 0-52 28-52 62" fill="none" stroke="#f6d77a" strokeWidth="2" strokeDasharray="4 4" opacity=".8" />
      )}
      {/* face in shadow */}
      <ellipse cx="100" cy="100" rx="34" ry="40" fill="#050404" />
      <ellipse cx="100" cy="92" rx="34" ry="30" fill="#000" opacity=".5" />

      {!eyesHidden && <Eyes kind={t.Eyes} />}
      <Mask kind={t.Mask} />
      <Mark kind={t.Mark} />
    </svg>
  );
}

function Eyes({ kind }: { kind: string }) {
  const L = 86;
  const R = 114;
  const Y = 96;
  switch (kind) {
    case "Tired":
      return (
        <g fill={EYE}>
          <path d={`M${L - 6} ${Y}h12v3a6 3 0 0 1-12 0z`} />
          <path d={`M${R - 6} ${Y}h12v3a6 3 0 0 1-12 0z`} />
        </g>
      );
    case "Narrow":
      return (
        <g fill={EYE}>
          <rect x={L - 7} y={Y - 1} width="14" height="2.5" rx="1.2" />
          <rect x={R - 7} y={Y - 1} width="14" height="2.5" rx="1.2" />
        </g>
      );
    case "Glow":
      return (
        <g fill={BTC}>
          <circle cx={L} cy={Y} r="9" opacity=".18" />
          <circle cx={R} cy={Y} r="9" opacity=".18" />
          <circle cx={L} cy={Y} r="3.6" />
          <circle cx={R} cy={Y} r="3.6" />
        </g>
      );
    case "Laser":
      return (
        <g>
          <path d={`M${L} ${Y}L-10 ${Y + 40}`} stroke="#ff3b30" strokeWidth="3" opacity=".75" />
          <path d={`M${R} ${Y}L210 ${Y + 40}`} stroke="#ff3b30" strokeWidth="3" opacity=".75" />
          <circle cx={L} cy={Y} r="4" fill="#ff6b5e" />
          <circle cx={R} cy={Y} r="4" fill="#ff6b5e" />
        </g>
      );
    case "Closed":
      return (
        <g fill="none" stroke={EYE} strokeWidth="2" strokeLinecap="round">
          <path d={`M${L - 6} ${Y}q6 5 12 0`} />
          <path d={`M${R - 6} ${Y}q6 5 12 0`} />
        </g>
      );
    default:
      return (
        <g fill={EYE}>
          <circle cx={L} cy={Y} r="3.4" />
          <circle cx={R} cy={Y} r="3.4" />
        </g>
      );
  }
}

function Mask({ kind }: { kind: string }) {
  switch (kind) {
    case "Bandana":
      return <path d="M68 108h64l-10 26c-6 8-14 10-22 10s-16-2-22-10z" fill="#7a1f1f" />;
    case "Respirator":
      return (
        <g>
          <rect x="80" y="110" width="40" height="22" rx="10" fill="#3a3a3a" />
          <circle cx="78" cy="122" r="7" fill="#2a2a2a" stroke="#555" />
          <circle cx="122" cy="122" r="7" fill="#2a2a2a" stroke="#555" />
        </g>
      );
    case "Plague":
      return <path d="M88 104c8-2 16-2 24 0l-8 40c-3 4-5 4-8 0z" fill="#d8cfbf" />;
    case "Static veil":
      return (
        <g opacity=".85">
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x="68" y={104 + i * 4} width="64" height="2" fill={i % 2 ? "#9a948c" : "#5a5650"} />
          ))}
        </g>
      );
    case "Redacted":
      return <rect x="66" y="88" width="68" height="16" rx="2" fill="#000" stroke={BTC} strokeWidth="1.5" />;
    default:
      return null;
  }
}

function Mark({ kind }: { kind: string }) {
  const x = 100;
  const y = 176;
  switch (kind) {
    case "₿":
      return (
        <text x={x} y={y + 6} textAnchor="middle" fontSize="20" fontWeight="700" fill={BTC} fontFamily="Inter Tight, sans-serif">
          ₿
        </text>
      );
    case "Shield":
      return <path d={`M${x} ${y - 11}l9 3.5v6c0 5-4 8.5-9 10.5-5-2-9-5.5-9-10.5v-6z`} fill="none" stroke={BTC} strokeWidth="2" />;
    case "Key":
      return (
        <g fill="none" stroke={BTC} strokeWidth="2">
          <circle cx={x - 6} cy={y} r="5" />
          <path d={`M${x - 1} ${y}h12m-4 0v4m4-4v4`} />
        </g>
      );
    case "Genesis":
      return (
        <g>
          <rect x={x - 12} y={y - 10} width="24" height="20" rx="3" fill={BTC} />
          <text x={x} y={y + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#0b0a09" fontFamily="JetBrains Mono, monospace">
            0
          </text>
        </g>
      );
    default:
      return null;
  }
}
