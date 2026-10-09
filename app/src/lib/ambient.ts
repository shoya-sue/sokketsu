/** 背景の粒子と slot の波紋（#30）。描画は components/Ambient.tsx、ここは計算だけ。 */

export type Particle = { x: number; y: number; vx: number; vy: number; r: number };

/** 粒子の速さ（px/秒）の上限と大きさ（px）の範囲。 */
export const MAX_SPEED = 28;
export const MIN_R = 1.2;
export const MAX_R = 2.8;

/** 画面 w×h に n 個の粒子をばらまく。rand は 0..1 を返す関数（テストでは固定列を渡す）。 */
export function seedParticles(n: number, w: number, h: number, rand: () => number): Particle[] {
  return Array.from({ length: n }, () => {
    const angle = rand() * 2 * Math.PI;
    const speed = (0.35 + 0.65 * rand()) * MAX_SPEED;
    return {
      x: rand() * w,
      y: rand() * h,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: MIN_R + rand() * (MAX_R - MIN_R),
    };
  });
}

/** 端をまたいだら反対側から出す（0 <= x < size に収める）。 */
export const wrap = (x: number, size: number): number => ((x % size) + size) % size;

/** dt 秒ぶん進めた新しい粒子の列を返す。 */
export function stepParticles(ps: readonly Particle[], dt: number, w: number, h: number): Particle[] {
  return ps.map((p) => ({ ...p, x: wrap(p.x + p.vx * dt, w), y: wrap(p.y + p.vy * dt, h) }));
}

/** 波紋が広がりきって消えるまでの時間（ミリ秒）。 */
export const WAVE_MS = 1800;

export type Wave = { radius: number; alpha: number };

/**
 * slot を受け取ってから age ミリ秒の波紋。半径は速く広がってから緩み（ease-out）、濃さは線形に薄れる。
 * まだ届いていない（age < 0）か、消えた（age >= WAVE_MS）なら null。
 */
export function waveAt(age: number, maxRadius: number): Wave | null {
  if (age < 0 || age >= WAVE_MS) return null;
  const k = age / WAVE_MS;
  const eased = 1 - (1 - k) ** 3;
  return { radius: eased * maxRadius, alpha: 1 - k };
}

/** いま見えている波紋（slot の受信時刻の列から）。 */
export function liveWaves(slotTimes: readonly number[], now: number, maxRadius: number): Wave[] {
  return slotTimes.flatMap((t) => {
    const w = waveAt(now - t, maxRadius);
    return w ? [w] : [];
  });
}

/** 画面の大きさに合わせた粒子の数（面積 1 万 px² あたり約 0.9 個、40〜160 個）。 */
export const particleCount = (w: number, h: number): number =>
  Math.max(40, Math.min(160, Math.round((w * h) / 11_000)));
