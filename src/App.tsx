import { useEffect } from "react";
import { useRoute } from "./router";
import { AppState } from "./state";
import { Footer, Nav, TabBar } from "./components/Layout";
import { Home } from "./pages/Home";
import { Market } from "./pages/Market";
import { HashPower } from "./pages/HashPower";
import { WalletPage } from "./pages/Wallet";
import { Claim } from "./pages/Claim";

const PAGES = {
  "/": Home,
  "/market": Market,
  "/hashpower": HashPower,
  "/wallet": WalletPage,
  "/claim": Claim,
};

export default function App() {
  const { route, anchor } = useRoute();
  const Page = PAGES[route];

  // Coming from another page to `#section`, the section only exists after Home renders.
  useEffect(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
  }, [route, anchor]);

  return (
    <AppState>
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
      <Nav route={route} />
      <main id="main" key={route} tabIndex={-1}>
        <Page />
      </main>
      <Footer />
      <TabBar route={route} />
    </AppState>
  );
}
