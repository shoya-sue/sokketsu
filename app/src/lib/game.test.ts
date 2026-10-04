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
