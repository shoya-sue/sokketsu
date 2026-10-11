import { describe, expect, it } from "vitest";
import { COMBO_SEGMENTS, comboSegments, ringDashOffset, slotBars } from "./gauges";

describe("comboSegments", () => {
  it("コンボの数だけ点け、5 段で頭打ち", () => {
    expect(COMBO_SEGMENTS).toBe(5);
    expect(comboSegments(0)).toEqual([false, false, false, false, false]);
    expect(comboSegments(2)).toEqual([true, true, false, false, false]);
    expect(comboSegments(5)).toEqual([true, true, true, true, true]);
    expect(comboSegments(9)).toEqual([true, true, true, true, true]);
  });
  it("負の値は 0 として扱う", () => {
    expect(comboSegments(-3).every((s) => !s)).toBe(true);
  });
});

describe("ringDashOffset", () => {
  it("進み 0 なら全周ぶん、1 なら 0 だけずらす", () => {
    expect(ringDashOffset(0, 100)).toBe(100);
    expect(ringDashOffset(1, 100)).toBe(0);
    expect(ringDashOffset(0.25, 100)).toBe(75);
  });
  it("0〜1 の外は端にそろえる", () => {
    expect(ringDashOffset(-1, 100)).toBe(100);
    expect(ringDashOffset(2, 100)).toBe(0);
  });
});

describe("slotBars", () => {
  it("slot の下の桁から n 本の高さ（0.2〜1）", () => {
    expect(slotBars(509130078, 4)).toEqual([0.84, 0.76, 0.2, 0.2]);
  });
  it("slot が無ければ最低の高さで並べる", () => {
    expect(slotBars(null, 3)).toEqual([0.2, 0.2, 0.2]);
  });
  it("桁が足りなければ 0 として扱う", () => {
    expect(slotBars(7, 3)).toEqual([0.76, 0.2, 0.2]);
  });
});
