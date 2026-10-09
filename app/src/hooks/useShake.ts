import { useEffect, type RefObject } from "react";
import { prefersReducedMotion } from "../lib/motion";

/** 揺れの動き（.shake-host で使っていた keyframes と同じ）。 */
export const SHAKE_FRAMES: Keyframe[] = [
  { transform: "translate3d(0, 0, 0)" },
  { transform: "translate3d(-2px, 0, 0)", offset: 0.1 },
  { transform: "translate3d(4px, 0, 0)", offset: 0.2 },
  { transform: "translate3d(-7px, 0, 0)", offset: 0.3 },
  { transform: "translate3d(7px, 0, 0)", offset: 0.4 },
  { transform: "translate3d(-7px, 0, 0)", offset: 0.5 },
  { transform: "translate3d(7px, 0, 0)", offset: 0.6 },
  { transform: "translate3d(-7px, 0, 0)", offset: 0.7 },
  { transform: "translate3d(4px, 0, 0)", offset: 0.8 },
  { transform: "translate3d(-2px, 0, 0)", offset: 0.9 },
  { transform: "translate3d(0, 0, 0)" },
];

/**
 * shakeKey が変わるたびに要素を揺らす。key で作り直さないので、中の状態（開いた折りたたみなど）は残る。
 * reduced-motion と、Web Animations API の無い環境では揺らさない。
 */
export function useShake(ref: RefObject<HTMLElement | null>, shakeKey: number): void {
  useEffect(() => {
    const el = ref.current;
    if (shakeKey === 0 || !el || typeof el.animate !== "function" || prefersReducedMotion()) return;
    el.animate(SHAKE_FRAMES, { duration: 450, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" });
  }, [ref, shakeKey]);
}
