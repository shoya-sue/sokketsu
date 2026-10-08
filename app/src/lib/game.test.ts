import { describe, expect, it } from "vitest";
import {
  INITIAL_GAME,
  applyRun,
  gradeFor,
  levelFromXp,
  levelProgress,
  parseGame,
  pointsFor,
  xpForLevel,
  type GameState,
} from "./game";

describe("gradeFor", () => {
  it.each([
    [599, "S"],
    [600, "A"],
    [899, "A"],
    [900, "B"],
    [1499, "B"],
    [1500, "C"],
  ])("%i ms は %s", (ms, grade) => expect(gradeFor(ms)).toBe(grade));
});

describe("pointsFor", () => {
  it("速いほど点が高い", () => expect(pointsFor({ kind: "release", ms: 500 })).toBeGreaterThan(pointsFor({ kind: "release", ms: 900 })));
  it("12.8 秒以上でも基本点は入る", () => expect(pointsFor({ kind: "refund", ms: 20000 })).toBe(100));
  it("hold は 50 点", () => expect(pointsFor({ kind: "hold" })).toBe(50));
  it("失敗と未確定は 0 点", () => {
    expect(pointsFor({ kind: "fail" })).toBe(0);
    expect(pointsFor({ kind: "release", ms: null })).toBe(0);
  });
});

describe("レベル", () => {
  it("必要 XP は 100 × (L−1)²", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(5)).toBe(1600);
  });
  it("XP からレベル", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(-5)).toBe(1);
  });
  it("レベル内の進み具合", () => {
    expect(levelProgress(0)).toBe(0);
    expect(levelProgress(250)).toBeCloseTo((250 - 100) / (400 - 100));
  });
});

describe("applyRun", () => {
  it("初の確定で実績が解け、XP が入る。元の状態は変えない", () => {
    const before = INITIAL_GAME;
    const r = applyRun(before, { kind: "release", ms: 750 });
    expect(r.gained).toBe(pointsFor({ kind: "release", ms: 750 }));
    expect(r.grade).toBe("A");
    expect(r.unlocked).toContain("first_finality");
    expect(r.next.combo).toBe(1);
    expect(r.next.bestMs).toBe(750);
    expect(before).toEqual(INITIAL_GAME);
  });

  it("サブ秒が続くとコンボが伸び、3 と 5 で実績", () => {
    let s: GameState = INITIAL_GAME;
    const unlocked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = applyRun(s, { kind: "release", ms: 700 });
      unlocked.push(...r.unlocked);
      s = r.next;
    }
    expect(s.combo).toBe(5);
    expect(s.bestCombo).toBe(5);
    expect(unlocked).toEqual(expect.arrayContaining(["combo_3", "combo_5"]));
  });

  it("1 秒以上の確定と失敗はコンボを切る。hold は切らない", () => {
    let s = applyRun(INITIAL_GAME, { kind: "release", ms: 700 }).next;
    s = applyRun(s, { kind: "hold" }).next;
    expect(s.combo).toBe(1);
    expect(applyRun(s, { kind: "release", ms: 1200 }).next.combo).toBe(0);
    expect(applyRun(s, { kind: "fail" }).next.combo).toBe(0);
  });

  it("hold で STOP マスター、3 ルート制覇で all_paths", () => {
    let s = applyRun(INITIAL_GAME, { kind: "hold" });
    expect(s.unlocked).toEqual(["stopper"]);
    expect(s.grade).toBeNull();
    let state = applyRun(s.next, { kind: "release", ms: 800 }).next;
    s = applyRun(state, { kind: "refund", ms: 800 });
    expect(s.unlocked).toContain("all_paths");
    state = s.next;
    expect(applyRun(state, { kind: "refund", ms: 800 }).unlocked).not.toContain("all_paths");
  });

  it("500ms 切りとレベルアップ", () => {
    const r = applyRun(INITIAL_GAME, { kind: "release", ms: 450 });
    expect(r.unlocked).toContain("sub_500");
    expect(r.levelUp).toBe(true);
  });

  it("レベル 5 で実績", () => {
    const r = applyRun({ ...INITIAL_GAME, xp: 1590 }, { kind: "hold" });
    expect(r.unlocked).toContain("level_5");
  });

  it("失敗は runs も seen も増やさない", () => {
    const r = applyRun(INITIAL_GAME, { kind: "fail" });
    expect(r.next.runs).toBe(0);
    expect(r.next.seen).toEqual(INITIAL_GAME.seen);
    expect(r.gained).toBe(0);
  });
});

describe("parseGame", () => {
  it("null・壊れた JSON は初期状態", () => {
    expect(parseGame(null)).toEqual(INITIAL_GAME);
    expect(parseGame("{oops")).toEqual(INITIAL_GAME);
  });
  it("不正な値を正しい形に直す", () => {
    const raw = JSON.stringify({
      xp: -3,
      combo: "x",
      bestMs: Infinity,
      seen: { release: true, hold: "yes" },
      achievements: ["stopper", "hacked"],
    });
    expect(parseGame(raw)).toEqual({
      ...INITIAL_GAME,
      seen: { release: true, refund: false, hold: false },
      achievements: ["stopper"],
    });
  });
  it("往復で同じ状態に戻る", () => {
    const s = applyRun(INITIAL_GAME, { kind: "release", ms: 600 }).next;
    expect(parseGame(JSON.stringify(s))).toEqual(s);
  });
});

describe("境界値と取り違え（mutation テストで見つけた抜け）", () => {
  it("初期状態はどのルートも未踏", () => expect(INITIAL_GAME.seen).toEqual({ release: false, refund: false, hold: false }));
  it("点数は 基本点 100 + (12800 − ms) / 128 の四捨五入", () => {
    expect(pointsFor({ kind: "release", ms: 500 })).toBe(196);
    expect(pointsFor({ kind: "refund", ms: 12800 })).toBe(100);
  });
  it("失敗は ms があっても 0 点", () => expect(pointsFor({ kind: "fail", ms: 500 })).toBe(0));
  it("refund のサブ秒確定もコンボを伸ばす", () =>
    expect(applyRun(INITIAL_GAME, { kind: "refund", ms: 700 }).next.combo).toBe(1));
  it("ちょうど 1000ms はサブ秒ではない（コンボが切れる）", () =>
    expect(applyRun({ ...INITIAL_GAME, combo: 2 }, { kind: "release", ms: 1000 }).next.combo).toBe(0));
  it("hold・失敗は ms が付いていても確定として数えない（自己ベスト・ランク・初確定が変わらない）", () => {
    for (const kind of ["hold", "fail"] as const) {
      const r = applyRun({ ...INITIAL_GAME, bestMs: 900, combo: 1 }, { kind, ms: 300 });
      expect(r.next.bestMs).toBe(900);
      expect(r.grade).toBe(null);
      expect(r.unlocked).not.toContain("first_finality");
    }
  });
  it("ms の無い hold は自己ベストを変えない（null のまま・既存のまま）", () => {
    expect(applyRun(INITIAL_GAME, { kind: "hold" }).next.bestMs).toBe(null);
    expect(applyRun({ ...INITIAL_GAME, bestMs: 800 }, { kind: "hold" }).next.bestMs).toBe(800);
  });
  it("自己ベストは速いほうだけを残す", () => {
    expect(applyRun({ ...INITIAL_GAME, bestMs: 800 }, { kind: "release", ms: 900 }).next.bestMs).toBe(800);
    expect(applyRun({ ...INITIAL_GAME, bestMs: 800 }, { kind: "release", ms: 700 }).next.bestMs).toBe(700);
  });
  it("確定・hold は runs を 1 増やす", () => {
    expect(applyRun(INITIAL_GAME, { kind: "release", ms: 700 }).next.runs).toBe(1);
    expect(applyRun(INITIAL_GAME, { kind: "hold" }).next.runs).toBe(1);
  });
  it("500ms ちょうどは 500ms 切りの実績にならない", () =>
    expect(applyRun(INITIAL_GAME, { kind: "release", ms: 500 }).unlocked).not.toContain("sub_500"));
  it("コンボがちょうど 3 になった回に combo_3 が解ける", () =>
    expect(applyRun({ ...INITIAL_GAME, combo: 2 }, { kind: "release", ms: 700 }).unlocked).toContain("combo_3"));
  it("release では STOP の実績は解けない", () =>
    expect(applyRun(INITIAL_GAME, { kind: "release", ms: 700 }).unlocked).not.toContain("stopper"));
  it("レベルが変わらなければ levelUp は false", () =>
    expect(applyRun({ ...INITIAL_GAME, xp: 150 }, { kind: "hold" }).levelUp).toBe(false));
});

describe("parseGame の壊れた値", () => {
  const base = { xp: 120, combo: 1, bestCombo: 2, bestMs: 800, runs: 3, seen: { release: true }, achievements: ["stopper"] };
  it("空文字は初期状態", () => expect(parseGame("")).toEqual(INITIAL_GAME));
  it("数値でない値（文字列の数字も）と負の値は 0", () => {
    const g = parseGame(JSON.stringify({ ...base, xp: "5", combo: -2 }));
    expect(g.xp).toBe(0);
    expect(g.combo).toBe(0);
  });
  it("0 はそのまま 0", () => expect(parseGame(JSON.stringify({ ...base, runs: 0 })).runs).toBe(0));
  it("bestMs が数値でなければ null", () => expect(parseGame(JSON.stringify({ ...base, bestMs: "800" })).bestMs).toBe(null));
  it("seen は true の項目だけ true、無い項目は false", () =>
    expect(parseGame(JSON.stringify(base)).seen).toEqual({ release: true, refund: false, hold: false }));
  it("seen が無くても他の項目は残る", () => {
    const g = parseGame(JSON.stringify({ ...base, seen: undefined }));
    expect(g.xp).toBe(120);
    expect(g.seen).toEqual({ release: false, refund: false, hold: false });
  });
  it("seen.refund / seen.hold も読む", () =>
    expect(parseGame(JSON.stringify({ ...base, seen: { refund: true, hold: true } })).seen).toEqual({
      release: false,
      refund: true,
      hold: true,
    }));
  it("achievements が配列でなければ空", () =>
    expect(parseGame(JSON.stringify({ ...base, achievements: "stopper" })).achievements).toEqual([]));
});

describe("確定を観測できなかった送金（ms が無い）", () => {
  it("release でも ms が無ければ確定として数えない", () => {
    const r = applyRun({ ...INITIAL_GAME, bestMs: 800, combo: 2 }, { kind: "release" });
    expect(r.grade).toBe(null);
    expect(r.next.bestMs).toBe(800);
    expect(r.next.combo).toBe(2);
    expect(r.unlocked).not.toContain("first_finality");
  });
});
