import { useEffect, useState } from "react";
import { attractFrame, type AttractFrame } from "../lib/attract";
import { prefersReducedMotion } from "../lib/motion";

const TICK_MS = 100;

const sameFrame = (a: AttractFrame, b: AttractFrame) => a.phase === b.phase && a.cycle === b.cycle && a.judged === b.judged;

/**
 * active のあいだ、送金しない再生の場面を進める（#30）。reduced-motion では再生しない。
 * 時刻は 100 ms ごとに見るが、状態は場面が変わったときだけ更新する（App 全体を毎回描き直さない）。
 */
export function useAttract(active: boolean): AttractFrame | null {
  const reduced = prefersReducedMotion();
  const [frame, setFrame] = useState<AttractFrame | null>(null);
  useEffect(() => {
    if (!active || reduced) return;
    const started = performance.now();
    const id = setInterval(() => {
      const next = attractFrame(performance.now() - started);
      setFrame((f) => (f && sameFrame(f, next) ? f : next));
    }, TICK_MS);
    return () => {
      clearInterval(id);
      // 次に再生を始めたとき、前の再生の場面から始めないように捨てる。
      setFrame(null);
    };
  }, [active, reduced]);
  if (!active || reduced) return null;
  return frame ?? attractFrame(0);
}
