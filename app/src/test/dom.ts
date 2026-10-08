import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// 画面の部品のテスト（jsdom）で共通に使う準備。vitest の globals を使わないので後始末をここで登録する。
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** prefers-reduced-motion を切り替える（jsdom には matchMedia が無い）。 */
export function setReducedMotion(on: boolean): void {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: on && q.includes("reduce") }));
}
