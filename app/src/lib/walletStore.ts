import { useSyncExternalStore } from "react";
import type { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

/**
 * ウォレットの接続状態。ウォレット一式（wallet-adapter・モバイル用アダプタ）は初回表示のあとに
 * 遅延読み込みするので、App はこのストア経由で状態を受け取り、接続ボタンを描く差し込み口（slot）を渡す。
 */
export type WalletState = {
  publicKey: PublicKey | null;
  signTransaction?: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  disconnect: () => Promise<void>;
  slot: HTMLElement | null;
};

const INITIAL: WalletState = { publicKey: null, disconnect: async () => {}, slot: null };

export function createWalletStore() {
  let state = INITIAL;
  const listeners = new Set<() => void>();
  return {
    get: (): WalletState => state,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (patch: Partial<WalletState>): void => {
      const changed = (Object.keys(patch) as (keyof WalletState)[]).some((k) => patch[k] !== state[k]);
      if (!changed) return;
      state = { ...state, ...patch };
      for (const l of listeners) l();
    },
  };
}

export const walletStore = createWalletStore();

/** React から購読する。 */
export const useWalletState = (): WalletState => useSyncExternalStore(walletStore.subscribe, walletStore.get);

/**
 * 接続ボタンの差し込み口を登録する ref コールバック。モジュールの定数にしておく。
 * 描画のたびに作り直すと、React が「null → 要素」と毎回呼び直し、ストアを購読する側が描画し直して回り続ける。
 */
export const setWalletSlot = (el: HTMLElement | null): void => walletStore.set({ slot: el });
