/** HUD と Alpenglow の計器（#56）。描画は components/Hud.tsx・App.tsx の ClusterPill、ここは計算だけ。 */

export const COMBO_SEGMENTS = 5;

/** コンボのメーター（5 段）の点灯。コンボの数だけ点け、5 段で頭打ち。 */
export function comboSegments(combo: number): boolean[] {
  return Array.from({ length: COMBO_SEGMENTS }, (_, i) => i < combo);
}

/** 円周 circumference の環を、進み progress（0〜1）だけ描くときの stroke-dashoffset。 */
export function ringDashOffset(progress: number, circumference: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return circumference * (1 - p);
}

/**
 * Alpenglow の計器に並べる棒の高さ（0.2〜1）。slot の下の桁から順に 1 本ずつ（0.2 + 0.08 × 桁）。
 * slot が変わるたびに形が変わる。桁が足りない・slot が無いときは最低の高さ。
 */
export function slotBars(slot: number | null, n: number): number[] {
  const digits = slot === null ? "" : String(slot);
  return Array.from({ length: n }, (_, i) => {
    const ch = digits[digits.length - 1 - i];
    const d = ch === undefined ? 0 : Number(ch);
    return Math.round((0.2 + 0.08 * d) * 100) / 100;
  });
}
