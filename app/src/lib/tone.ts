import type { Phase } from "./phase";

/** 画面全体の色調（#33）。背景の光・グリッド・波紋の色がこれに従う。 */
export type Tone = "calm" | "deposit" | "judge" | "stop" | "release" | "refund" | "error";

const TONE_OF: Record<Phase, Tone> = {
  idle: "calm",
  depositing: "deposit",
  judging: "judge",
  holding: "stop",
  stopped: "stop",
  releasing: "release",
  released: "release",
  refunding: "refund",
  refunded: "refund",
  error: "error",
};

/** 段階の色調。判断中は紫、止めたら琥珀、解放は緑、返金は水色、失敗は赤。 */
export const toneOf = (phase: Phase): Tone => TONE_OF[phase];

/** 色調ごとの 2 色（RGB）。1 つ目が主、2 つ目が添え。 */
export const TONE_RGB: Record<Tone, readonly [string, string]> = {
  calm: ["153, 69, 255", "20, 241, 149"],
  deposit: ["0, 209, 255", "153, 69, 255"],
  judge: ["153, 69, 255", "255, 94, 168"],
  stop: ["255, 181, 71", "255, 93, 108"],
  release: ["20, 241, 149", "0, 209, 255"],
  refund: ["0, 209, 255", "20, 241, 149"],
  error: ["255, 93, 108", "255, 181, 71"],
};
