/** 1 音 = [周波数 Hz, 開始秒, 長さ秒, 波形]。 */
export type Note = [number, number, number, OscillatorType];
export type FlowEvent = "deposit" | "judge" | "verify" | "finalize" | "stop" | "fail";

/** 1 件の支払いの流れ。この順に音階が上がる。 */
export const FLOW = ["deposit", "judge", "verify", "finalize"] as const;

// A4 = 440Hz を基準にしたペンタトニック（半音の数）。流れの段ごとに 1 段ずつ上がる。
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
const freq = (degree: number) => Math.round(440 * Math.pow(2, SCALE[degree] / 12));

export function notesFor(event: FlowEvent): Note[] {
  switch (event) {
    case "deposit":
      return [[freq(0), 0, 0.08, "triangle"], [freq(1), 0.07, 0.1, "triangle"]];
    case "judge":
      return [[freq(2), 0, 0.07, "square"], [freq(3), 0.08, 0.08, "square"]];
    case "verify":
      return [[freq(4), 0, 0.06, "sine"]];
    case "finalize":
      return [[freq(5), 0, 0.09, "triangle"], [freq(6), 0.08, 0.09, "triangle"], [freq(7), 0.16, 0.24, "triangle"]];
    case "stop":
      return [[freq(3), 0, 0.12, "sawtooth"], [freq(0), 0.1, 0.18, "sawtooth"], [220, 0.22, 0.22, "square"]];
    case "fail":
      return [[196, 0, 0.15, "sawtooth"], [147, 0.12, 0.25, "sawtooth"]];
  }
}

/**
 * 次の依頼までのカウントダウン（#34）の刻み音。残りが減るほど音階が上がり、最後の 1 秒は 2 音で溜めを切る。
 * 残り 0 以下は鳴らさない。音階の上限を超える残りは一番下の音にする。
 */
export function countdownNotes(secondsLeft: number): Note[] {
  if (secondsLeft <= 0) return [];
  const degree = Math.max(0, SCALE.length - 1 - secondsLeft);
  if (secondsLeft === 1) return [[freq(degree), 0, 0.05, "square"], [freq(degree) * 2, 0.07, 0.09, "square"]];
  return [[freq(degree), 0, 0.05, "square"]];
}
