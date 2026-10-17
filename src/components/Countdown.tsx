import { config } from "../config";
import { fmtDate, fmtInt, useNow } from "../lib/useNow";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;

/** Time left until the next Bitcoin halving, from the estimated date in the config. */
export function Countdown() {
  const now = useNow(1000);
  const { block, estimate } = config.btcHalving;
  const at = Date.parse(estimate);
  const left = Math.max(0, at - now);
  const parts = [
    { v: Math.floor(left / DAY), l: "days" },
    { v: Math.floor((left % DAY) / HOUR), l: "hrs" },
    { v: Math.floor((left % HOUR) / MIN), l: "min" },
  ];

  return (
    <div className="card countdown">
      <p className="eyebrow">Mine closes at the next BTC halving</p>
      <div className="countdown-row" role="timer" aria-label={`${parts[0].v} days left`}>
        {parts.map((p) => (
          <div key={p.l}>
            <span className="countdown-num">{String(p.v).padStart(p.l === "days" ? 1 : 2, "0")}</span>
            <span className="countdown-unit">{p.l}</span>
          </div>
        ))}
      </div>
      <dl className="countdown-meta">
        <div>
          <dt>Block</dt>
          <dd>{fmtInt(block)}</dd>
        </div>
        <div>
          <dt>Estimated</dt>
          <dd>~{fmtDate(at)}</dd>
        </div>
      </dl>
    </div>
  );
}
