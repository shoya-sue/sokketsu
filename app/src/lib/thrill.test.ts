import { describe, expect, it } from "vitest";
import { gradeFor } from "./game";
import {
  BGM_BEAT_MS,
  CLOSE_MS,
  GRADE_LIMITS,
  ROLL_MS,
  ROLL_TICK_MS,
  TIER_OF,
  VIBRATE,
  bgmBeat,
  fireLevel,
  jackpotFor,
  nearMiss,
  rollDigits,
} from "./thrill";

describe("GRADE_LIMITS", () => {
  it("game.ts の gradeFor と同じ境目", () => {
    for (const { grade, under } of GRADE_LIMITS) {
      expect(gradeFor(under - 1)).toBe(grade);
      expect(gradeFor(under)).not.toBe(grade);
    }
    expect(GRADE_LIMITS.map((g) => g.grade)).toEqual(["S", "A", "B"]);
  });
});

describe("nearMiss", () => {
  it("S なら null", () => {
    expect(nearMiss(420)).toBeNull();
    expect(nearMiss(599.4)).toBeNull(); // 見せる数字は 599
  });

  it("A は S まで、B は A まで、C は B まで（見せる数字が上限未満になる差）", () => {
    expect(nearMiss(650)).toEqual({ next: "S", shortMs: 51, close: true });
    expect(nearMiss(600)).toEqual({ next: "S", shortMs: 1, close: true });
    expect(nearMiss(899)).toEqual({ next: "S", shortMs: 300, close: false });
    expect(nearMiss(900)).toEqual({ next: "A", shortMs: 1, close: true });
    expect(nearMiss(1499)).toEqual({ next: "A", shortMs: 600, close: false });
    expect(nearMiss(1500)).toEqual({ next: "B", shortMs: 1, close: true });
    expect(nearMiss(3000)).toEqual({ next: "B", shortMs: 1501, close: false });
  });

  it("ランクは生の ms で決め（gradeFor と同じ）、差は四捨五入した数字で数える", () => {
    expect(gradeFor(599.6)).toBe("S");
    expect(nearMiss(599.6)).toBeNull();
    expect(nearMiss(600.4)).toEqual({ next: "S", shortMs: 1, close: true });
    expect(nearMiss(650.6)).toEqual({ next: "S", shortMs: 52, close: true });
  });

  it("差がちょうど CLOSE_MS なら惜しい、1 超えたら惜しくない", () => {
    expect(CLOSE_MS).toBe(100);
    expect(nearMiss(699)?.close).toBe(true); // 100 ms
    expect(nearMiss(700)?.close).toBe(false); // 101 ms
  });
});

describe("TIER_OF", () => {
  it("ランクごとの格", () => {
    expect(TIER_OF).toEqual({ S: "legendary", A: "epic", B: "rare", C: "common" });
  });
});

describe("jackpotFor", () => {
  it("自己ベスト更新かつ S", () => {
    expect(jackpotFor(700, 500, "S")).toBe("best-s");
  });

  it("自己ベスト更新だけ", () => {
    expect(jackpotFor(900, 800, "A")).toBe("best");
  });

  it("S だけ（ベストと同じか遅い、または初めて）", () => {
    expect(jackpotFor(500, 550, "S")).toBe("s-rank");
    expect(jackpotFor(null, 550, "S")).toBe("s-rank");
  });

  it("初めての確定・ベストと同じ値は当たりではない", () => {
    expect(jackpotFor(null, 800, "A")).toBeNull();
    expect(jackpotFor(800, 800, "A")).toBeNull();
    expect(jackpotFor(700, 800, "A")).toBeNull();
  });
});

describe("rollDigits", () => {
  it("ROLL_MS 以降は目標の数字（四捨五入）", () => {
    expect(rollDigits(812.4, ROLL_MS)).toBe("812");
    expect(rollDigits(812, 10_000)).toBe("812");
  });

  it("回り始めは全桁がずれている（桁数は同じ）", () => {
    const at0 = rollDigits(812, 0);
    expect(at0).toHaveLength(3);
    // step=0: (d + 0 + i*3 + 1) % 10 → 8+1, 1+4, 2+7
    expect(at0).toBe("959");
  });

  it("左の桁から順に止まる", () => {
    const third = ROLL_MS / 3;
    expect(rollDigits(812, third)[0]).toBe("8");
    expect(rollDigits(812, third - 1)[0]).not.toBe("8");
    expect(rollDigits(812, third).slice(1)).not.toBe("12");
    expect(rollDigits(812, (2 * ROLL_MS) / 3).slice(0, 2)).toBe("81");
    expect(rollDigits(812, ROLL_MS - 1)[2]).not.toBe("2");
  });

  it("回っている桁は ROLL_TICK_MS ごとに 1 つ進む", () => {
    expect(ROLL_TICK_MS).toBe(40);
    expect(rollDigits(812, ROLL_TICK_MS - 1)).toBe("959");
    expect(rollDigits(812, ROLL_TICK_MS)).toBe("060");
  });

  it("負の時間は 0、負の数は 0 として扱う", () => {
    expect(rollDigits(812, -50)).toBe("959");
    expect(rollDigits(-5, ROLL_MS)).toBe("0");
  });
});

describe("fireLevel", () => {
  it("2 連続で灯り、3・5 で強くなる", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(fireLevel)).toEqual([0, 0, 1, 2, 2, 3, 3]);
  });
});

describe("VIBRATE", () => {
  it("格が高いほど振動の合計が長い", () => {
    const total = (t: keyof typeof VIBRATE) => VIBRATE[t].reduce((a, b) => a + b, 0);
    expect(total("legendary")).toBeGreaterThan(total("epic"));
    expect(total("epic")).toBeGreaterThan(total("rare"));
    expect(total("rare")).toBeGreaterThan(total("common"));
    expect(VIBRATE).toEqual({ legendary: [40, 30, 40, 30, 120], epic: [40, 30, 80], rare: [60], common: [30] });
  });
});

describe("bgmBeat", () => {
  it("4 拍で 1 周するアルペジオ（負の拍も同じ周期）", () => {
    expect(BGM_BEAT_MS).toBe(260);
    expect([0, 1, 2, 3, 4, -1].map((b) => bgmBeat(b, 0)[0][0])).toEqual([220, 277, 330, 277, 220, 277]);
    expect(bgmBeat(0, 0)).toEqual([[220, 0, 0.2, "sine"]]);
  });

  it("コンボ中は 1 オクターブ上を重ねる", () => {
    expect(bgmBeat(2, 2)).toEqual([
      [330, 0, 0.2, "sine"],
      [660, 0.02, 0.12, "triangle"],
    ]);
    expect(bgmBeat(2, 1)).toHaveLength(1);
  });
});
