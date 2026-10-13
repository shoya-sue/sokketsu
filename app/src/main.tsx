import "./polyfill";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./cockpit.css";
import "./hudkit.css";
import App from "./App.tsx";
import { LangProvider } from "./lang.tsx";
import { loadProgram } from "./chain";
import { preloadFx } from "./lib/fx";
import { WalletRoot } from "./lazyWallet";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
    <Suspense fallback={null}>
      <WalletRoot />
    </Suspense>
  </StrictMode>,
);

// anchor と紙吹雪は初回表示のあとに先読みしておく（デモを押したときに待たせない）。失敗しても使うときに読み直す。
setTimeout(() => {
  void loadProgram().catch(() => {});
  void preloadFx().catch(() => {});
}, 0);
