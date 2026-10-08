import type { Phase } from "./phase";

/**
 * 待機中に舞台で流す「送金しない再生」（#30）の 1 周の台本。
 * 預け入れ → 判断 → 解放 → 確定を、過去に測った確定ミリ秒で見せる。チェーンには何も送らない。
 */
export const ATTRACT_SCRIPT: readonly { phase: Phase; ms: number }[] = [
  { phase: "idle", ms: 1200 },
  { phase: "depositing", ms: 1000 },
  { phase: "judging", ms: 1400 },
  { phase: "releasing", ms: 900 },
  { phase: "released", ms: 3500 },
];

export const ATTRACT_CYCLE_MS = ATTRACT_SCRIPT.reduce((sum, s) => sum + s.ms, 0);

/** 再生で見せる判断の確率（Jev の release の実測 95%）。 */
export const ATTRACT_PROBABILITY = 0.95;

export type AttractFrame = {
  phase: Phase;
  /** 何周目か（周ごとに演出をやり直すための key）。 */
  cycle: number;
  /** 判断が出ているか（judging の後から周の終わりまで）。 */
  judged: boolean;
};

/** 再生を始めてから elapsed ミリ秒の場面。 */
export function attractFrame(elapsed: number): AttractFrame {
  const t = Math.max(0, elapsed);
  const cycle = Math.floor(t / ATTRACT_CYCLE_MS);
  let at = t - cycle * ATTRACT_CYCLE_MS;
  let judged = false;
  // 最後の場面より前で収まらなければ最後の場面（周の残りすべて）。
  // Stryker disable next-line MethodExpression: 最後の場面では at < ms が必ず成り立つので、slice の有無で結果は同じ
  for (const step of ATTRACT_SCRIPT.slice(0, -1)) {
    if (at < step.ms) return { phase: step.phase, cycle, judged };
    at -= step.ms;
    if (step.phase === "judging") judged = true;
  }
  return { phase: ATTRACT_SCRIPT[ATTRACT_SCRIPT.length - 1].phase, cycle, judged };
}

/** 再生で見せる確定ミリ秒。直近の実測があればそれ、なければ本番で測った 797 ms。 */
export const ATTRACT_FALLBACK_MS = 797;
export function attractMs(history: readonly { ms: number }[]): number {
  const last = history[history.length - 1];
  return last ? Math.round(last.ms) : ATTRACT_FALLBACK_MS;
}
