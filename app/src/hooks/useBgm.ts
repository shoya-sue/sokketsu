import { useEffect, useRef } from "react";
import { BGM_BEAT_MS, bgmBeat } from "../lib/thrill";
import { playNotes } from "../lib/sfx";

const BGM_VOLUME = 0.035; // 効果音（0.12）より小さく

/** active のあいだ、小さな BGM のアルペジオを刻む（#35）。ミュート中は playNotes が鳴らさない。 */
export function useBgm(active: boolean, combo: number): void {
  const comboRef = useRef(combo);
  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);
  useEffect(() => {
    if (!active) return;
    let beat = 0;
    const id = setInterval(() => playNotes(bgmBeat(beat++, comboRef.current), BGM_VOLUME), BGM_BEAT_MS);
    return () => clearInterval(id);
  }, [active]);
}
