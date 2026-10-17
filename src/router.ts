import { useEffect, useState } from "react";

export type Route =
  | { page: "home"; anchor: string | null }
  | { page: "address"; id: string }
  | { page: "tx"; id: string }
  | { page: "learn" }
  | { page: "settings" };

/**
 * Hash routing (`#/address/bc1…`) so the site works on any static host without rewrites.
 * Plain anchors like `#how` stay on the home page.
 */
function parse(): Route {
  const h = decodeURIComponent(window.location.hash.slice(1));
  if (!h.startsWith("/")) return { page: "home", anchor: h || null };
  const [, page, id] = h.split("/");
  if (page === "address" && id) return { page, id };
  if (page === "tx" && id) return { page, id: id.toLowerCase() };
  if (page === "learn" || page === "settings") return { page };
  return { page: "home", anchor: null };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      const next = parse();
      if (next.page !== "home" || !next.anchor) window.scrollTo(0, 0);
      setRoute(next);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const to = {
  home: (anchor?: string) => (anchor ? `#${anchor}` : "#top"),
  address: (a: string) => `#/address/${a}`,
  tx: (id: string) => `#/tx/${id}`,
  learn: () => "#/learn",
  settings: () => "#/settings",
};
