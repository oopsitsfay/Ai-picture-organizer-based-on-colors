import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loadCollection, type Collection, type Piece } from "./data/collection";
import { scanHoldings, type Wallet } from "./lib/wallet";

type Scan = { status: "idle" | "scanning" | "done" | "error"; pieces: Piece[]; error?: string };

type State = {
  collection: Collection | null;
  collectionError: string | null;
  wallet: Wallet | null;
  setWallet: (w: Wallet | null) => void;
  scan: Scan;
  rescan: () => void;
};

const Ctx = createContext<State | null>(null);
const STORE = "wallet";

function readStored(): Wallet | null {
  try {
    const v = localStorage.getItem(STORE);
    return v ? (JSON.parse(v) as Wallet) : null;
  } catch {
    return null;
  }
}

export function AppState({ children }: { children: React.ReactNode }) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [wallet, setWalletState] = useState<Wallet | null>(readStored);
  const [scan, setScan] = useState<Scan>({ status: "idle", pieces: [] });
  const [scanKey, setScanKey] = useState(0);

  useEffect(() => {
    loadCollection().then(setCollection, (e: Error) => setCollectionError(e.message));
  }, []);

  const setWallet = useCallback((w: Wallet | null) => {
    setWalletState(w);
    try {
      if (w) localStorage.setItem(STORE, JSON.stringify(w));
      else localStorage.removeItem(STORE);
    } catch {
      /* storage unavailable; the wallet just won't be remembered */
    }
  }, []);

  useEffect(() => {
    if (!wallet || !collection) {
      setScan({ status: "idle", pieces: [] });
      return;
    }
    const ac = new AbortController();
    setScan({ status: "scanning", pieces: [] });
    scanHoldings(wallet.address, collection, ac.signal).then(
      (pieces) => setScan({ status: "done", pieces }),
      (e: Error) => !ac.signal.aborted && setScan({ status: "error", pieces: [], error: e.message }),
    );
    return () => ac.abort();
  }, [wallet, collection, scanKey]);

  const rescan = useCallback(() => setScanKey((k) => k + 1), []);

  return <Ctx.Provider value={{ collection, collectionError, wallet, setWallet, scan, rescan }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppState");
  return v;
}
