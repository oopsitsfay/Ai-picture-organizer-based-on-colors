import { useEffect, useState } from "react";

/** Current time in ms, updated every `ms`. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const fmtInt = (n: number) => n.toLocaleString("en-US");

export const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
