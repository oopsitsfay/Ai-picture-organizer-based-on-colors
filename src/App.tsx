import { useEffect } from "react";
import { useRoute } from "./router";
import { Footer, Nav } from "./components/ui";
import { Home } from "./pages/Home";
import { AddressPage, TxPage } from "./pages/Report";
import { Learn, Settings } from "./pages/Learn";

export default function App() {
  const route = useRoute();
  const anchor = route.page === "home" ? route.anchor : null;

  // Coming from another page to `#section`, the section only exists after Home renders.
  useEffect(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
  }, [route.page, anchor]);

  const key = route.page === "address" || route.page === "tx" ? `${route.page}:${route.id}` : route.page;

  return (
    <>
      <a
        href="#main"
        className="skip"
        onClick={(e) => {
          // Keep the hash for routing; just move focus.
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <Nav />
      <main id="main" key={key} tabIndex={-1}>
        {route.page === "home" ? <Home /> : null}
        {route.page === "address" ? <AddressPage id={route.id} /> : null}
        {route.page === "tx" ? <TxPage id={route.id} /> : null}
        {route.page === "learn" ? <Learn /> : null}
        {route.page === "settings" ? <Settings /> : null}
      </main>
      <Footer />
    </>
  );
}
