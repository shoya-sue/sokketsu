import { describe, expect, it } from "vitest";
import { BOLT, dotMark, inPolygon, litCount } from "./dotmark";

describe("inPolygon", () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  it("内側の点は true、外側は false", () => {
    expect(inPolygon(5, 5, square)).toBe(true);
    expect(inPolygon(15, 5, square)).toBe(false);
    expect(inPolygon(-1, 5, square)).toBe(false);
  });
  it("稲妻の中心付近は内側", () => {
    expect(inPolygon(62, 62, BOLT)).toBe(true);
    expect(inPolygon(20, 20, BOLT)).toBe(false);
  });
});

describe("dotMark", () => {
  it("マーク（判断リングの帯か稲妻）の内側の格子点だけを返す", () => {
    const dots = dotMark(8);
    expect(dots.length).toBeGreaterThan(20);
    for (const d of dots) {
      const r = Math.hypot(d.x - 64, d.y - 64);
      const onRing = r >= 36 && r <= 48;
      expect(onRing || inPolygon(d.x, d.y, BOLT), `${d.x},${d.y}`).toBe(true);
    }
  });
  it("点は時計回りの角度の順に並ぶ（真上から灯り始める）", () => {
    const dots = dotMark(8);
    for (let i = 1; i < dots.length; i++) expect(dots[i].order).toBeGreaterThanOrEqual(dots[i - 1].order);
    expect(dots[0].order).toBeGreaterThanOrEqual(0);
    expect(dots[dots.length - 1].order).toBeLessThan(1);
  });
  it("格子の間隔が細かいほど点が多い", () => {
    expect(dotMark(6).length).toBeGreaterThan(dotMark(10).length);
  });
});

describe("litCount", () => {
  it("済んだ工程の数 / 4 の割合だけ灯す（切り上げ）", () => {
    expect(litCount(100, 0)).toBe(0);
    expect(litCount(100, 1)).toBe(25);
    expect(litCount(10, 1)).toBe(3);
    expect(litCount(100, 4)).toBe(100);
  });
  it("範囲外は 0〜全部にそろえる", () => {
    expect(litCount(100, -1)).toBe(0);
    expect(litCount(100, 9)).toBe(100);
  });
});
