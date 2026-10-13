import { lazy } from "react";

// ウォレット一式は初回表示に要らないので、あとから読み込む。App とは walletStore でつなぐ（#77）。
export const WalletRoot = lazy(() => import("./WalletRoot"));
