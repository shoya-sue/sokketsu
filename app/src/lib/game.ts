export type RunKind = "release" | "refund" | "hold" | "fail";
export type Run = { kind: RunKind; ms?: number | null };
export type Grade = "S" | "A" | "B" | "C";

export type AchievementId =
  | "first_finality"
  | "sub_500"
  | "combo_3"
  | "combo_5"
  | "stopper"
  | "all_paths"
  | "level_5";

export const ACHIEVEMENTS: readonly AchievementId[] = [
  "first_finality",
  "sub_500",
  "combo_3",
  "combo_5",
  "stopper",
  "all_paths",
  "level_5",
];

export type GameState = {
  xp: number;
  combo: number; // 連続したサブ秒の確定
  bestCombo: number;
  bestMs: number | null;
  runs: number;
  seen: { release: boolean; refund: boolean; hold: boolean };
  achievements: AchievementId[];
};

export const INITIAL_GAME: GameState = {
  xp: 0,
  combo: 0,
  bestCombo: 0,
  bestMs: null,
  runs: 0,
  seen: { release: false, refund: false, hold: false },
  achievements: [],
};

const TOWER_BFT_MS = 12800;
const SUB_SECOND_MS = 1000;
const HOLD_POINTS = 50;
const BASE_POINTS = 100;

/** 確定の速さのランク。 */
export function gradeFor(ms: number): Grade {
  if (ms < 600) return "S";
  if (ms < 900) return "A";
  if (ms < 1500) return "B";
  return "C";
}

/** 1 回の点数。送金は基本点 + 速さのボーナス（Tower BFT との差）、hold は正しく止めた点。 */
export function pointsFor(run: Run): number {
  if (run.kind === "hold") return HOLD_POINTS;
  if (run.kind === "fail" || run.ms == null) return 0;
  return BASE_POINTS + Math.round(Math.max(0, TOWER_BFT_MS - run.ms) / 128);
}

/** レベル: 必要 XP は 100 × (レベル − 1)²。 */
export const xpForLevel = (level: number) => 100 * (level - 1) ** 2;
export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;

/** 今のレベル内での進み具合（0..1）。 */
export function levelProgress(xp: number): number {
  const level = levelFromXp(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return (xp - from) / (to - from);
}

export type RunResult = {
  next: GameState;
  gained: number;
  grade: Grade | null;
  unlocked: AchievementId[];
  levelUp: boolean;
};

/** 1 回の結果を反映する（元の状態は変えない）。 */
export function applyRun(state: GameState, run: Run): RunResult {
  const gained = pointsFor(run);
  const sent = run.kind === "release" || run.kind === "refund";
  const ms = sent && run.ms != null ? run.ms : null;
  const combo =
    run.kind === "fail" ? 0 : ms !== null ? (ms < SUB_SECOND_MS ? state.combo + 1 : 0) : state.combo;
  const seen = run.kind === "fail" ? state.seen : { ...state.seen, [run.kind]: true };
  const xp = state.xp + gained;
  const draft: GameState = {
    xp,
    combo,
    bestCombo: Math.max(state.bestCombo, combo),
    bestMs: ms !== null ? Math.min(state.bestMs ?? ms, ms) : state.bestMs,
    runs: state.runs + (run.kind === "fail" ? 0 : 1),
    seen,
    achievements: state.achievements,
  };

  const earned = new Set<AchievementId>(state.achievements);
  const check = (id: AchievementId, cond: boolean) => cond && earned.add(id);
  check("first_finality", ms !== null);
  check("sub_500", ms !== null && ms < 500);
  check("combo_3", combo >= 3);
  check("combo_5", combo >= 5);
  check("stopper", run.kind === "hold");
  check("all_paths", seen.release && seen.refund && seen.hold);
  check("level_5", levelFromXp(xp) >= 5);
  const unlocked = ACHIEVEMENTS.filter((id) => earned.has(id) && !state.achievements.includes(id));

  return {
    next: { ...draft, achievements: [...state.achievements, ...unlocked] },
    gained,
    grade: ms !== null ? gradeFor(ms) : null,
    unlocked,
    levelUp: levelFromXp(xp) > levelFromXp(state.xp),
  };
}

/** localStorage の値を検証して戻す。壊れていれば初期状態。 */
export function parseGame(raw: string | null): GameState {
  if (!raw) return INITIAL_GAME;
  try {
    const d = JSON.parse(raw) as Partial<GameState>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
    return {
      xp: num(d.xp),
      combo: num(d.combo),
      bestCombo: num(d.bestCombo),
      bestMs: typeof d.bestMs === "number" && Number.isFinite(d.bestMs) ? d.bestMs : null,
      runs: num(d.runs),
      seen: {
        release: d.seen?.release === true,
        refund: d.seen?.refund === true,
        hold: d.seen?.hold === true,
      },
      achievements: Array.isArray(d.achievements)
        ? d.achievements.filter((a): a is AchievementId => ACHIEVEMENTS.includes(a as AchievementId))
        : [],
    };
  } catch {
    return INITIAL_GAME;
  }
}
