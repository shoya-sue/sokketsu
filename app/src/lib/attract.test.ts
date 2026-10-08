import { describe, expect, it } from "vitest";
import { ATTRACT_CYCLE_MS, ATTRACT_FALLBACK_MS, ATTRACT_SCRIPT, attractFrame, attractMs } from "./attract";

describe("attractFrame", () => {
  it("1 周は台本の合計（8 秒）", () => {
    expect(ATTRACT_CYCLE_MS).toBe(8000);
    expect(ATTRACT_SCRIPT.map((s) => s.phase)).toEqual(["idle", "depositing", "judging", "releasing", "released"]);
  });

  it("各場面の境目（ちょうど境目の時刻は次の場面）", () => {
    expect(attractFrame(0)).toEqual({ phase: "idle", cycle: 0, judged: false });
    expect(attractFrame(1199).phase).toBe("idle");
    expect(attractFrame(1200).phase).toBe("depositing");
    expect(attractFrame(2200)).toEqual({ phase: "judging", cycle: 0, judged: false });
    expect(attractFrame(3599).judged).toBe(false);
    expect(attractFrame(3600)).toEqual({ phase: "releasing", cycle: 0, judged: true });
    expect(attractFrame(4500)).toEqual({ phase: "released", cycle: 0, judged: true });
    expect(attractFrame(7999)).toEqual({ phase: "released", cycle: 0, judged: true });
  });

  it("周をまたぐと最初の場面に戻り、周の番号が増える", () => {
    expect(attractFrame(8000)).toEqual({ phase: "idle", cycle: 1, judged: false });
    expect(attractFrame(8000 * 3 + 1300)).toEqual({ phase: "depositing", cycle: 3, judged: false });
  });

  it("負の時間は 0 として扱う", () => {
    expect(attractFrame(-50)).toEqual({ phase: "idle", cycle: 0, judged: false });
  });
});

describe("attractMs", () => {
  it("直近の実測（四捨五入）を使う", () => {
    expect(attractMs([{ ms: 900 }, { ms: 412.6 }])).toBe(413);
  });

  it("実測が無ければ本番で測った値", () => {
    expect(attractMs([])).toBe(ATTRACT_FALLBACK_MS);
    expect(ATTRACT_FALLBACK_MS).toBe(797);
  });
});
