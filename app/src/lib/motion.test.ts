import { afterEach, describe, expect, it, vi } from "vitest";
import { prefersReducedMotion } from "./motion";

afterEach(() => vi.unstubAllGlobals());

describe("prefersReducedMotion", () => {
  it("matchMedia が reduce を返せば true", () => {
    vi.stubGlobal("window", { matchMedia: (q: string) => ({ matches: q.includes("reduce") }) });
    expect(prefersReducedMotion()).toBe(true);
  });
  it("window そのものが無い環境（SSR・Node）では false", () => {
    vi.stubGlobal("window", undefined);
    expect(prefersReducedMotion()).toBe(false);
  });
  it("matchMedia が無い環境では false（動かす側に倒す）", () => {
    vi.stubGlobal("window", {});
    expect(prefersReducedMotion()).toBe(false);
  });
});
