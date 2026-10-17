import { useEffect, useState } from "react";

export type Route = "/" | "/market" | "/hashpower" | "/wallet" | "/claim";

const ROUTES: Route[] = ["/", "/market", "/hashpower", "/wallet", "/claim"];

/**
 * Hash routing (`#/market`) so the site works on any static host without rewrites.
 * Plain section anchors like `#guide` stay on the home page.
 */
function parse(): { route: Route; anchor: string | null } {
  const h = window.location.hash.slice(1);
  if (h.startsWith("/")) {
    const path = h.split("?")[0] as Route;
    return { route: ROUTES.includes(path) ? path : "/", anchor: null };
  }
  return { route: "/", anchor: h || null };
}

export function useRoute() {
  const [state, setState] = useState(parse);
  useEffect(() => {
    const on = () => {
      const next = parse();
      setState((prev) => {
        if (next.route !== prev.route && !next.anchor) window.scrollTo(0, 0);
        return next;
      });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return state;
}

/** Link to a page; `anchor` jumps to a section on the home page. */
export const href = (route: Route, anchor?: string) => (route === "/" ? (anchor ? `#${anchor}` : "#top") : `#${route}`);
