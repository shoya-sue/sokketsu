import type { Phase } from "./phase";

export type StepState = "todo" | "active" | "done" | "stopped" | "error";
export type FlowStatus = "idle" | "depositing" | "judging" | "finalizing" | "finalized" | "stopped" | "error";

// 01 預け入れ → 02 判断 → 03 署名検証 → 04 確定。各 phase で「いま進めている段」の番号（-1 は無し、4 は全段済み）。
const ACTIVE: Record<Exclude<Phase, "error">, number> = {
  idle: -1,
  depositing: 0,
  judging: 1,
  holding: 2,
  releasing: 3,
  refunding: 3,
  stopped: 3,
  released: 4,
  refunded: 4,
};

/** 段階表示の 4 段の状態。失敗は、直前に進めていた段（before）を error にする。 */
export function stepStates(phase: Phase, before?: Phase): StepState[] {
  if (phase === "error") {
    const at = before && before !== "error" ? Math.max(0, Math.min(3, ACTIVE[before])) : 0;
    return [0, 1, 2, 3].map((i) => (i < at ? "done" : i === at ? "error" : "todo"));
  }
  const at = ACTIVE[phase];
  return [0, 1, 2, 3].map((i) => {
    if (i < at) return "done";
    if (i === at) return phase === "stopped" ? "stopped" : "active";
    return "todo";
  });
}

/** 状態ピルに出す状態。 */
export function statusOf(phase: Phase): FlowStatus {
  switch (phase) {
    case "holding":
    case "releasing":
    case "refunding":
      return "finalizing";
    case "released":
    case "refunded":
      return "finalized";
    default:
      return phase;
  }
}
