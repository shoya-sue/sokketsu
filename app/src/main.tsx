import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./index.css";
import "./cockpit.css";
import "./hudkit.css";
import App from "./App.tsx";
import { LangProvider } from "./lang.tsx";
import { RPC_URL } from "./chain";

// ウォレットは Wallet Standard 対応のもの（Phantom・Solflare・Backpack など）を自動で検出する。
// 送信はアプリ側の Connection で行うので、ここでは接続と署名だけを使う。
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <LangProvider>
            <App />
          </LangProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>,
);
