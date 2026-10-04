import confetti from "canvas-confetti";
import type { Grade } from "./game";

const COLORS = ["#9945ff", "#14f195", "#00d1ff", "#ffd166", "#ff5ea8"];
// 動きを減らす設定の人には出さない。
const BASE = { colors: COLORS, disableForReducedMotion: true, zIndex: 60 } as const;

/** 要素の中心を、画面に対する 0..1 の座標で返す。見つからなければ画面中央。 */
function originOf(selector: string): { x: number; y: number } {
  const el = typeof document === "undefined" ? null : document.querySelector(selector);
  if (!el) return { x: 0.5, y: 0.5 };
  const r = el.getBoundingClientRect();
  return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight };
}

const PARTICLES: Record<Grade, number> = { S: 220, A: 140, B: 90, C: 60 };

/** 確定の瞬間、届いた先のノードから噴き出させる。ランクが高いほど派手にする。 */
export function burstAt(selector: string, grade: Grade): void {
  const origin = originOf(selector);
  void confetti({ ...BASE, origin, particleCount: PARTICLES[grade], spread: 80, startVelocity: 42 });
  if (grade === "S") {
    void confetti({ ...BASE, origin, particleCount: 60, spread: 360, startVelocity: 26, shapes: ["star"], scalar: 1.3 });
  }
}

/** コンボ中は左右から打ち上げる。 */
export function sideCannons(): void {
  void confetti({ ...BASE, particleCount: 70, angle: 60, spread: 55, origin: { x: 0, y: 0.75 } });
  void confetti({ ...BASE, particleCount: 70, angle: 120, spread: 55, origin: { x: 1, y: 0.75 } });
}

/** レベルアップは星を降らせる。 */
export function starShower(): void {
  void confetti({
    ...BASE,
    particleCount: 120,
    spread: 160,
    startVelocity: 30,
    gravity: 0.6,
    shapes: ["star"],
    colors: ["#ffd166", "#fff3c4", "#14f195"],
    origin: { x: 0.5, y: 0.25 },
  });
}
