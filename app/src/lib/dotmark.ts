/** Sokketsu のマークを点の格子で描く（#56）。描画は components/DotMark.tsx、ここは計算だけ。 */

/** マークの稲妻（public/logo-mark.svg と同じ形・128 四方の座標）。 */
export const BOLT: [number, number][] = [
  [72, 22],
  [41, 71],
  [60, 71],
  [53, 106],
  [88, 54],
  [68, 54],
];

/** 判断リングの帯（中心 64,64）の内径と外径。 */
const RING_IN = 36;
const RING_OUT = 48;

/** 点が多角形の内側か（偶奇判定）。 */
export function inPolygon(x: number, y: number, poly: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export type Dot = { x: number; y: number; order: number };

/**
 * 間隔 gap の格子のうち、マーク（判断リングの帯か稲妻）の内側の点。
 * order は真上から時計回りの角度（0〜1）で、点はその順に並ぶ（工程が進むと真上から灯る）。
 */
export function dotMark(gap: number): Dot[] {
  const dots: Dot[] = [];
  for (let y = gap / 2; y < 128; y += gap) {
    for (let x = gap / 2; x < 128; x += gap) {
      const r = Math.hypot(x - 64, y - 64);
      if ((r >= RING_IN && r <= RING_OUT) || inPolygon(x, y, BOLT)) {
        const a = Math.atan2(x - 64, -(y - 64));
        dots.push({ x, y, order: (a < 0 ? a + 2 * Math.PI : a) / (2 * Math.PI) });
      }
    }
  }
  return dots.sort((p, q) => p.order - q.order);
}

/** 済んだ工程の数（0〜4）に応じて灯す点の数（割合を切り上げ）。 */
export function litCount(total: number, stepsDone: number): number {
  const k = Math.min(4, Math.max(0, stepsDone));
  return Math.ceil((total * k) / 4);
}
