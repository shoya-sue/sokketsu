import { describe, expect, it } from "vitest";
import {
  DROP_MAX_SPEED,
  DROP_MIN_SPEED,
  RAIN_COL_PX,
  TOWER_BFT_MS,
  energyOf,
  hexDump,
  rainGlyphs,
  recentBlocks,
  seedDrops,
  stepDrops,
  tickerItems,
  timecode,
} from "./overdrive";
import type { Phase } from "./phase";

/** 決まった列を順に返す乱数。 */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("energyOf", () => {
  it("待機中がいちばん弱く、確定がいちばん強い", () => {
    expect(energyOf("idle")).toBe(0.35);
    expect(energyOf("released")).toBe(1);
  });
  it("判断中は待機より強く、確定より弱い", () => {
    expect(energyOf("judging")).toBeGreaterThan(energyOf("idle"));
    expect(energyOf("judging")).toBeLessThan(energyOf("released"));
  });
  it("どの段階も 0〜1 に収まる", () => {
    const phases: Phase[] = [
      "idle",
      "depositing",
      "judging",
      "holding",
      "stopped",
      "releasing",
      "released",
      "refunding",
      "refunded",
      "error",
    ];
    for (const p of phases) {
      expect(energyOf(p), p).toBeGreaterThan(0);
      expect(energyOf(p), p).toBeLessThanOrEqual(1);
    }
  });
});

describe("tickerItems", () => {
  it("slot・直近の確定・中央値・Tower BFT との比を出す", () => {
    const items = tickerItems({ phase: "released", slot: 509130078, lastMs: [731, 797, 900] });
    expect(items).toContain("SLOT 509,130,078");
    expect(items).toContain("LAST FINALITY 731 MS");
    expect(items).toContain("MEDIAN 797 MS");
    expect(items).toContain(`×${Math.round(TOWER_BFT_MS / 731)} VS TOWER BFT`);
    expect(items).toContain("PHASE RELEASED");
  });
  it("まだ測っていなければ確定の項目を出さない", () => {
    const items = tickerItems({ phase: "idle", slot: null, lastMs: [] });
    expect(items.some((s) => s.startsWith("LAST FINALITY"))).toBe(false);
    expect(items.some((s) => s.startsWith("MEDIAN"))).toBe(false);
    expect(items.some((s) => s.startsWith("SLOT"))).toBe(false);
    expect(items).toContain("PHASE IDLE");
  });
  it("仕組みの決まり文句はいつも入る", () => {
    const items = tickerItems({ phase: "idle", slot: null, lastMs: [] });
    expect(items).toContain("THRESHOLD 70%");
    expect(items).toContain("ED25519 VERIFIED ON-CHAIN");
    expect(items).toContain("ALPENGLOW · DEVNET");
    expect(items).toContain("TYPED DECISIONS");
  });
  it("中央値は偶数個なら真ん中 2 つの平均を丸める", () => {
    expect(tickerItems({ phase: "idle", slot: null, lastMs: [700, 801] })).toContain("MEDIAN 751 MS");
  });
});

describe("rainGlyphs", () => {
  it("slot の数字と base58 の断片を混ぜた列を返す", () => {
    const g = rainGlyphs(509130078, 12, seq(0.1, 0.9));
    expect(g).toHaveLength(12);
    expect(g.join("")).toMatch(/^[0-9A-HJ-NP-Za-km-z]+$/);
  });
  it("slot が無くても base58 だけで埋める", () => {
    const g = rainGlyphs(null, 5, seq(0.5));
    expect(g).toHaveLength(5);
    for (const c of g) expect(c).toMatch(/^[1-9A-HJ-NP-Za-km-z]$/);
  });
  it("slot の数字が順に入る（乱数が小さいとき）", () => {
    expect(rainGlyphs(123, 3, seq(0)).join("")).toBe("123");
  });
  it("slot が無いときは乱数の位置の base58 の文字（null を文字にしない）", () => {
    expect(rainGlyphs(null, 3, seq(0.1))).toEqual(["6", "6", "6"]);
  });
  it("乱数が 0.5 以上なら slot があっても base58 の文字", () => {
    expect(rainGlyphs(123, 1, seq(0.9))).toEqual(["u"]);
    expect(rainGlyphs(123, 1, seq(0.5))).toEqual(["W"]);
  });
});

describe("seedDrops / stepDrops", () => {
  it("列の数は幅を RAIN_COL_PX で割った数", () => {
    expect(seedDrops(RAIN_COL_PX * 10, 500, seq(0.5))).toHaveLength(10);
  });
  it("列の位置・高さ・長さを乱数から決める", () => {
    const [a, b] = seedDrops(RAIN_COL_PX * 2, 500, seq(0.5, 0, 0.5));
    expect(a.x).toBe(RAIN_COL_PX / 2);
    expect(b.x).toBe(RAIN_COL_PX * 1.5);
    expect(a.y).toBe(250);
    expect(a.len).toBe(13);
  });
  it("速さは下限と上限の間", () => {
    const [lo] = seedDrops(RAIN_COL_PX, 500, seq(0, 0, 0));
    const [hi] = seedDrops(RAIN_COL_PX, 500, seq(0, 1, 0));
    expect(lo.speed).toBe(DROP_MIN_SPEED);
    expect(hi.speed).toBe(DROP_MAX_SPEED);
  });
  it("進めると下へ動き、画面の下を抜けたら上から出直す（元の配列は変えない）", () => {
    const drops = [{ x: 0, y: 100, speed: 50, len: 10 }];
    const moved = stepDrops(drops, 1, 500);
    expect(moved[0].y).toBe(150);
    expect(drops[0].y).toBe(100);
    expect(stepDrops(drops, 0.5, 500)[0].y).toBe(125);
    const wrapped = stepDrops([{ x: 0, y: 490, speed: 100, len: 10 }], 1, 500);
    expect(wrapped[0].y).toBe(-10 * RAIN_COL_PX);
    // ちょうど下端は、まだ出直さない
    expect(stepDrops([{ x: 0, y: 450, speed: 50, len: 10 }], 1, 500)[0].y).toBe(500);
  });
});

describe("recentBlocks", () => {
  it("最新の slot から遡って n 個（古い順）", () => {
    expect(recentBlocks(100, 4)).toEqual([97, 98, 99, 100]);
  });
  it("slot が無ければ空", () => {
    expect(recentBlocks(null, 4)).toEqual([]);
  });
  it("0 より前は出さない", () => {
    expect(recentBlocks(1, 4)).toEqual([0, 1]);
  });
});

describe("hexDump", () => {
  it("rows 行・各行はアドレスと 8 バイトの 16 進", () => {
    const lines = hexDump(509130078, 3);
    expect(lines).toHaveLength(3);
    for (const l of lines) expect(l).toMatch(/^[0-9A-F]{4} ([0-9A-F]{2} ){7}[0-9A-F]{2}$/);
  });
  it("同じ slot なら同じ中身、slot が変われば変わる", () => {
    expect(hexDump(42, 2)).toEqual(hexDump(42, 2));
    expect(hexDump(42, 2)).not.toEqual(hexDump(43, 2));
  });
  it("中身は slot から決まる擬似乱数（固定の値）", () => {
    expect(hexDump(42, 1)).toEqual(["0000 3F 76 3A F8 82 AC 35 76"]);
  });
  it("アドレスは大文字の 16 進", () => {
    expect(hexDump(7, 22)[21].slice(0, 4)).toBe("00A8");
  });
  it("アドレスは 8 ずつ増える", () => {
    const lines = hexDump(7, 3);
    expect(lines.map((l) => l.slice(0, 4))).toEqual(["0000", "0008", "0010"]);
  });
  it("slot が無ければ 0 で埋める", () => {
    expect(hexDump(null, 1)).toEqual(["0000 00 00 00 00 00 00 00 00"]);
  });
});

describe("timecode", () => {
  it("経過ミリ秒を 時:分:秒:コマ（30 コマ/秒）にする", () => {
    expect(timecode(0)).toBe("00:00:00:00");
    expect(timecode(3_723_500)).toBe("01:02:03:15");
  });
  it("負の値は 0 として扱う", () => {
    expect(timecode(-10)).toBe("00:00:00:00");
  });
});
