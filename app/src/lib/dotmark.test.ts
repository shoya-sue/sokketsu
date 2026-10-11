import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOLT, clockOrder, dotMark, inMark, inPolygon, litCount } from "./dotmark";

/** logo-mark.svg の稲妻の path（M / L / H / Z だけ）を頂点の列にする。 */
function svgBolt(): [number, number][] {
  const svg = readFileSync(new URL("../../public/logo-mark.svg", import.meta.url), "utf8");
  const d = /<path d="([^"]+)"/.exec(svg)?.[1] ?? "";
  const pts: [number, number][] = [];
  for (const [, cmd, args] of d.matchAll(/([MLHZ])\s*([^MLHZ]*)/g)) {
    const n = args.trim().split(/\s+/).filter(Boolean).map(Number);
    if (cmd === "H") pts.push([n[0], pts[pts.length - 1][1]]);
    else if (cmd !== "Z") pts.push([n[0], n[1]]);
  }
  return pts;
}

describe("BOLT", () => {
  it("マークの SVG の稲妻と同じ頂点", () => {
    expect(BOLT).toEqual(svgBolt());
  });
});

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
  it("辺の上の点：下辺と左辺は内側、上辺と右辺は外側", () => {
    expect(inPolygon(5, 0, square)).toBe(true);
    expect(inPolygon(0, 5, square)).toBe(true);
    expect(inPolygon(5, 10, square)).toBe(false);
    expect(inPolygon(10, 5, square)).toBe(false);
  });
  it("斜めの辺は交点の x で内外が分かれる", () => {
    const tri: [number, number][] = [
      [0, 0],
      [10, 0],
      [0, 10],
    ];
    // y = 4 で斜辺は x = 6
    expect(inPolygon(5.9, 4, tri)).toBe(true);
    expect(inPolygon(6.1, 4, tri)).toBe(false);
    expect(inPolygon(1, 8.9, tri)).toBe(true);
    expect(inPolygon(1, 9.1, tri)).toBe(false);
  });
  it("稲妻の中心付近は内側", () => {
    expect(inPolygon(62, 62, BOLT)).toBe(true);
    expect(inPolygon(20, 20, BOLT)).toBe(false);
  });
});

describe("inMark", () => {
  it("判断リングの帯は内径 36・外径 48 ちょうどを含む", () => {
    expect(inMark(64, 28)).toBe(true);
    expect(inMark(64, 29)).toBe(false);
    expect(inMark(64, 16)).toBe(true);
    expect(inMark(64, 15)).toBe(false);
    expect(inMark(28, 64)).toBe(true);
    expect(inMark(16, 64)).toBe(true);
  });
  it("稲妻の内側も含み、帯と稲妻の間は含まない", () => {
    expect(inMark(62, 62)).toBe(true);
    expect(inMark(40, 64)).toBe(false);
  });
});

describe("clockOrder", () => {
  it("真上 0・右 0.25・真下 0.5・左 0.75（時計回り）", () => {
    expect(clockOrder(64, 0)).toBe(0);
    expect(clockOrder(128, 64)).toBeCloseTo(0.25);
    expect(clockOrder(64, 128)).toBeCloseTo(0.5);
    expect(clockOrder(0, 64)).toBeCloseTo(0.75);
    expect(clockOrder(100, 28)).toBeCloseTo(0.125);
  });
});

describe("dotMark", () => {
  it("格子のうちマークの内側の点を全部、角度の順で返す", () => {
    const want = [];
    for (let y = 4; y < 128; y += 8) for (let x = 4; x < 128; x += 8) if (inMark(x, y)) want.push({ x, y, order: clockOrder(x, y) });
    want.sort((p, q) => p.order - q.order);
    expect(dotMark(8)).toEqual(want);
    expect(dotMark(8)[0]).toEqual({ x: 68, y: 20, order: clockOrder(68, 20) });
  });
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
