import { describe, expect, it, vi } from "vitest";
import { Keypair } from "@solana/web3.js";
import { createWalletStore } from "./walletStore";

describe("walletStore", () => {
  it("読み込み前は未接続（publicKey も署名も無い）", () => {
    const s = createWalletStore();
    expect(s.get().publicKey).toBeNull();
    expect(s.get().signTransaction).toBeUndefined();
    expect(s.get().slot).toBeNull();
  });

  it("set は新しいオブジェクトに置き換え、購読者に知らせる", () => {
    const s = createWalletStore();
    const before = s.get();
    const listener = vi.fn();
    s.subscribe(listener);
    const publicKey = Keypair.generate().publicKey;
    s.set({ publicKey });
    expect(s.get()).not.toBe(before);
    expect(before.publicKey).toBeNull();
    expect(s.get().publicKey).toBe(publicKey);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("差し込み口は他の値を残したまま差し替える", () => {
    const s = createWalletStore();
    const publicKey = Keypair.generate().publicKey;
    s.set({ publicKey });
    const el = {} as HTMLElement;
    s.set({ slot: el });
    expect(s.get().slot).toBe(el);
    expect(s.get().publicKey).toBe(publicKey);
  });

  it("同じ値なら知らせない（描画のたびの差し込み口の登録で回り続けない）", () => {
    const s = createWalletStore();
    const el = {} as HTMLElement;
    s.set({ slot: el });
    const listener = vi.fn();
    s.subscribe(listener);
    s.set({ slot: el });
    expect(listener).not.toHaveBeenCalled();
  });

  it("まとめて渡した値の一部だけが変わっても反映する（接続のたびに 3 つまとめて渡す）", () => {
    const s = createWalletStore();
    const disconnect = s.get().disconnect;
    const listener = vi.fn();
    s.subscribe(listener);
    const publicKey = Keypair.generate().publicKey;
    s.set({ publicKey, disconnect });
    expect(s.get().publicKey).toBe(publicKey);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("購読を解除したら知らせない", () => {
    const s = createWalletStore();
    const listener = vi.fn();
    const off = s.subscribe(listener);
    off();
    s.set({ slot: {} as HTMLElement });
    expect(listener).not.toHaveBeenCalled();
  });

  it("disconnect は読み込み前でも呼べる（何もしない）", async () => {
    await expect(createWalletStore().get().disconnect()).resolves.toBeUndefined();
  });
});
