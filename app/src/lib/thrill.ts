import type { Grade } from "./game";
import type { Note } from "./sfxPlan";

/** もう 1 回押したくなる仕掛け（#35）の判定。点数と実績の条件（game.ts）は変えず、見せ方だけを決める。 */

/** 各ランクに入るための上限（この値未満ならそのランク）。game.ts の gradeFor と同じ境目。 */
export const GRADE_LIMITS: readonly { grade: Grade; under: number }[] = [
  { grade: "S", under: 600 },
  { grade: "A", under: 900 },
  { grade: "B", under: 1500 },
];

export type NearMiss = { next: Grade; shortMs: number; close: boolean };

/** これ以内の差なら「惜しい」と強く出す（ms）。 */
export const CLOSE_MS = 100;

/**
 * 1 つ上のランクまで、あと何 ms 速ければ届いたか。S なら null。
 * ランクは gradeFor と同じ生の ms で決める。差は四捨五入して見せる数字が上限未満になる差（上限 − 1 との差）。
 */
export function nearMiss(ms: number): NearMiss | null {
  // ランクは gradeFor と同じく生の ms で決め、差は見せる数字（四捨五入）で数える。
  const shown = Math.round(ms);
  const at = GRADE_LIMITS.findIndex((g) => ms < g.under);
  if (at === 0) return null;
  const target = at === -1 ? GRADE_LIMITS[GRADE_LIMITS.length - 1] : GRADE_LIMITS[at - 1];
  const shortMs = shown - (target.under - 1);
  return { next: target.grade, shortMs, close: shortMs <= CLOSE_MS };
}

export type Tier = "legendary" | "epic" | "rare" | "common";

/** ランクごとの演出の格。 */
export const TIER_OF: Record<Grade, Tier> = { S: "legendary", A: "epic", B: "rare", C: "common" };

export type Jackpot = "best" | "s-rank" | "best-s";

/**
 * まれな大当たり。自己ベストの更新（前のベストがあるときだけ）と S ランク。
 * 初めての確定はベストの更新に数えない（毎回の 1 回目が当たりになってしまうため）。
 */
export function jackpotFor(prevBest: number | null, ms: number, grade: Grade): Jackpot | null {
  // Stryker disable next-line ConditionalExpression: ms < null は false なので、null の判定を外しても結果は同じ（型を絞るための判定）
  const best = prevBest !== null && ms < prevBest;
  const s = grade === "S";
  if (best && s) return "best-s";
  if (best) return "best";
  if (s) return "s-rank";
  return null;
}

/** スロットの回転：1 桁ずつ止まるまでの時間（ms）と、回っている桁の切り替わりの間隔（ms）。 */
export const ROLL_MS = 650;
export const ROLL_TICK_MS = 40;

/**
 * 回し始めてから t ms のときに見せる数字。左の桁から順に止まり、ROLL_MS で target に揃う。
 * 回っている桁は本来の数字から t に応じてずらす（毎回同じ回り方になる）。
 */
export function rollDigits(target: number, t: number): string {
  const digits = String(Math.max(0, Math.round(target)));
  // ROLL_MS 以降は、最後の桁の stopAt（= ROLL_MS）も過ぎているので全桁が target になる。
  const step = Math.floor(Math.max(0, t) / ROLL_TICK_MS);
  return [...digits]
    .map((d, i) => {
      const stopAt = (ROLL_MS * (i + 1)) / digits.length;
      return t >= stopAt ? d : String((Number(d) + step + i * 3 + 1) % 10);
    })
    .join("");
}

/** コンボの炎の段階（0 は出さない）。2 連続で灯り、3・5 で強くなる。 */
export function fireLevel(combo: number): 0 | 1 | 2 | 3 {
  if (combo >= 5) return 3;
  if (combo >= 3) return 2;
  if (combo >= 2) return 1;
  return 0;
}

/** 確定のときの振動（ms の列）。格が高いほど長く・回数が多い。 */
export const VIBRATE: Record<Tier, readonly number[]> = {
  legendary: [40, 30, 40, 30, 120],
  epic: [40, 30, 80],
  rare: [60],
  common: [30],
};

/**
 * 小さな BGM の 1 拍。4 拍で 1 小節のアルペジオ。コンボが続くと 1 オクターブ上の音を重ねる。
 * 音量は鳴らす側で下げる（効果音より小さく）。
 */
export const BGM_BEAT_MS = 260;
const BGM_ROOTS = [220, 277, 330, 277];
export function bgmBeat(beat: number, combo: number): Note[] {
  const root = BGM_ROOTS[((beat % 4) + 4) % 4];
  const base: Note = [root, 0, 0.2, "sine"];
  return fireLevel(combo) > 0 ? [base, [root * 2, 0.02, 0.12, "triangle"]] : [base];
}
