/** 舞台の金庫を囲む演出（#56）。描画は components/VaultHalo.tsx・StageDeck.tsx、ここは計算だけ。 */
import type { Phase } from "./phase";

export type Tick = { x1: number; y1: number; x2: number; y2: number; long: boolean };

/**
 * 中心 (0,0)・半径 r の円周に n 本の目盛り。0 本目が真上で時計回り。
 * every 本ごとに長い目盛り（長さ longLen）、それ以外は shortLen。
 */
export function tickLines(n: number, r: number, shortLen: number, longLen: number, every: number): Tick[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    const long = i % every === 0;
    const inner = r - (long ? longLen : shortLen);
    return {
      x1: Math.cos(a) * r,
      y1: Math.sin(a) * r,
      x2: Math.cos(a) * inner,
      y2: Math.sin(a) * inner,
      long,
    };
  });
}

type ReadoutInput = { phase: Phase; probability: number | null; thresholdPct: number };

/** 金庫の四方に出す計器の読み（確率・閾値・閾値との差・段階）。 */
export function haloReadouts({ phase, probability, thresholdPct }: ReadoutInput): string[] {
  if (probability === null) return ["P ——", `THR ${thresholdPct}%`, "Δ ——", phase.toUpperCase()];
  const p = Math.round(probability * 100);
  const d = p - thresholdPct;
  const delta = d > 0 ? `+${d}` : d < 0 ? `${d}` : "±0";
  return [`P ${p}%`, `THR ${thresholdPct}%`, `Δ ${delta}`, phase.toUpperCase()];
}

export const STEP_KEYS = ["DEPOSIT", "JUDGE", "VERIFY", "FINALIZE"] as const;

export type Light = "off" | "live" | "done" | "stop";

const LIGHTS: Record<Phase, Light[]> = {
  idle: ["off", "off", "off", "off"],
  depositing: ["live", "off", "off", "off"],
  judging: ["done", "live", "off", "off"],
  holding: ["done", "done", "stop", "off"],
  stopped: ["done", "done", "stop", "off"],
  releasing: ["done", "done", "done", "live"],
  released: ["done", "done", "done", "done"],
  refunding: ["done", "done", "done", "live"],
  refunded: ["done", "done", "done", "done"],
  error: ["done", "stop", "off", "off"],
};

/** 舞台の側面に並べる 4 工程の点灯状態。 */
export const stepLights = (phase: Phase): Light[] => LIGHTS[phase];
