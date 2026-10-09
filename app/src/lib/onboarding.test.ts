import { describe, expect, it } from "vitest";
import { ONBOARDED, ONBOARDING_KEY, ONBOARDING_STEPS, shouldShowOnboarding, stepDelayMs } from "./onboarding";

describe("shouldShowOnboarding", () => {
  it("初めて（保存なし）なら出す", () => {
    expect(shouldShowOnboarding(null)).toBe(true);
  });

  it("見終わった印があれば出さない", () => {
    expect(ONBOARDED).toBe("1");
    expect(shouldShowOnboarding("1")).toBe(false);
  });

  it("印以外の値（壊れた値・古い値）なら出す", () => {
    expect(shouldShowOnboarding("")).toBe(true);
    expect(shouldShowOnboarding("0")).toBe(true);
    expect(shouldShowOnboarding("true")).toBe(true);
  });

  it("保存のキーは版つき", () => {
    expect(ONBOARDING_KEY).toBe("sokketsu.onboarded.v1");
  });
});

describe("ONBOARDING_STEPS / stepDelayMs", () => {
  it("型付き判断 → 署名の検証 → 確定 の 3 枚", () => {
    expect(ONBOARDING_STEPS.map((s) => s.key)).toEqual(["typed", "verify", "finality"]);
    expect(ONBOARDING_STEPS.map((s) => s.icon)).toEqual(["⚖️", "🔏", "⚡"]);
  });

  it("開く演出の後、0.18 秒ずつずらして跳ねる", () => {
    expect([0, 1, 2].map(stepDelayMs)).toEqual([420, 600, 780]);
  });
});
