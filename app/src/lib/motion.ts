/** OS の「視差効果を減らす」設定。JS で動かす演出（カウントアップ・傾き・粒子）はこれで止める。 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
