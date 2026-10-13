import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { RPC_URL } from "./chain";
import { useWalletState, walletStore } from "./lib/walletStore";

/** 接続状態をストアへ写し、App が用意した差し込み口に接続ボタンを描く。 */
function Bridge() {
  const { publicKey, signTransaction, disconnect } = useWallet();
  const { slot } = useWalletState();
  useEffect(() => walletStore.set({ publicKey, signTransaction, disconnect }), [publicKey, signTransaction, disconnect]);
  return slot ? createPortal(<WalletMultiButton />, slot) : null;
}

// ウォレットは Wallet Standard 対応のもの（Phantom・Solflare・Backpack など）を自動で検出する。
// 送信はアプリ側の Connection で行うので、ここでは接続と署名だけを使う。
// 初回表示に要らないので、main.tsx から遅延読み込みする（#77）。
export default function WalletRoot() {
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <Bridge />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
