import { describe, expect, it } from "vitest";
import { RING_COUNT, ringsBroken, thresholdRing } from "./rings";

describe("rings（判断リングの輪が外れる本数）", () => {
  it("輪は 12 本", () => expect(RING_COUNT).toBe(12));
  it("確率に比例して外れる（切り捨て）", () => {
    expect(ringsBroken(0)).toBe(0);
    expect(ringsBroken(0.5)).toBe(6);
    expect(ringsBroken(0.95)).toBe(11);
    expect(ringsBroken(1)).toBe(12);
  });
  it("範囲外の確率は 0〜12 に収める", () => {
    expect(ringsBroken(-1)).toBe(0);
    expect(ringsBroken(2)).toBe(12);
  });
  it("閾値 70% の輪は 9 本目（切り上げ）。届いたかの判定と一致する", () => {
    expect(thresholdRing(0.7)).toBe(9);
    expect(ringsBroken(0.7) >= thresholdRing(0.7)).toBe(false); // 0.7*12=8.4 → 8 本
    expect(ringsBroken(0.75) >= thresholdRing(0.7)).toBe(true);
  });
});
