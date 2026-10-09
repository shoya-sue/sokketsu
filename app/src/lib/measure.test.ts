import { describe, expect, it } from "vitest";
import { breakdown, stairPoints } from "./measure";

describe("breakdown（確定までの内訳）", () => {
  it("送信 → processed → finalized の 3 点と 2 区間を返す", () => {
    const b = breakdown({ processedMs: 312, finalizedMs: 826 });
    expect(b.events).toEqual([
      { key: "sent", at: 0 },
      { key: "processed", at: 312 },
      { key: "finalized", at: 826 },
    ]);
    expect(b.segments).toEqual([
      { key: "processed", from: 0, to: 312 },
      { key: "finalized", from: 312, to: 826 },
    ]);
  });
  it("表示の窓は 1 秒単位で切り上げる（1 秒未満なら 1 秒）", () => {
    expect(breakdown({ processedMs: 312, finalizedMs: 826 }).windowMs).toBe(1000);
    expect(breakdown({ processedMs: 900, finalizedMs: 2693 }).windowMs).toBe(3000);
  });
  it("processed を観測できなかったときは finalized だけの 1 区間", () => {
    const b = breakdown({ processedMs: null, finalizedMs: 700 });
    expect(b.events.map((e) => e.key)).toEqual(["sent", "finalized"]);
    expect(b.segments).toEqual([{ key: "finalized", from: 0, to: 700 }]);
  });
  it("値は整数に丸める（表示とタイムラインの ms を一致させる）", () => {
    const b = breakdown({ processedMs: 311.6, finalizedMs: 825.5 });
    expect(b.events.map((e) => e.at)).toEqual([0, 312, 826]);
  });
});

describe("stairPoints（確定段階の階段グラフ）", () => {
  it("時刻を x、段階（0=送信, 1=processed, 2=finalized）を y にした SVG の points", () => {
    const b = breakdown({ processedMs: 250, finalizedMs: 500 });
    // 窓 1000ms・幅 100・高さ 20 → x は 0, 25, 50、y は 20, 10, 0（上ほど確定）
    expect(stairPoints(b, 100, 20)).toBe("0,20 25,20 25,10 50,10 50,0 100,0");
  });
});
