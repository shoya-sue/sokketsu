/** 判断リングの輪の数。確率が上がるほど外側から外れていき、閾値の輪に届けば執行される。 */
export const RING_COUNT = 12;

const clamp = (n: number) => Math.max(0, Math.min(RING_COUNT, n));

/** 確率 p で外れる輪の本数（切り捨て）。 */
export const ringsBroken = (probability: number, count = RING_COUNT): number =>
  clamp(Math.floor(Math.max(0, Math.min(1, probability)) * count));

/** 閾値に当たる輪の番号（切り上げ）。ringsBroken がこれ以上なら閾値を超えている。 */
export const thresholdRing = (threshold: number, count = RING_COUNT): number => clamp(Math.ceil(threshold * count));
