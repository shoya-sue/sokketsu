import { useEffect, useState } from "react";
import { useLang } from "../lang";
import { prefersReducedMotion } from "../lib/motion";
import { pulsePath } from "../lib/slotPulse";

type Props = { slotTimes: readonly number[] };

const W = 120;
const H = 22;
const WINDOW_MS = 3000;
const FRAME_MS = 50;

/** slot を受け取るたびに山が立ち、左へ流れていく波形。reduced-motion では流さず、受け取った時点の形で止める。 */
export function SlotPulse({ slotTimes }: Props) {
  const { t } = useLang();
  const reduced = prefersReducedMotion();
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setNow(performance.now()), FRAME_MS);
    return () => clearInterval(id);
  }, [reduced]);
  const at = reduced ? (slotTimes[slotTimes.length - 1] ?? now) : now;
  return (
    <svg className="slot-pulse" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("slot.pulse")}>
      <path d={pulsePath(slotTimes, at, W, H, WINDOW_MS)} />
    </svg>
  );
}
