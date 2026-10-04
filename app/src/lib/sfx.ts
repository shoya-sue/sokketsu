export type Sfx = "deposit" | "judge" | "finalize" | "stamp" | "combo" | "levelup" | "achievement" | "fail";

const MUTE_KEY = "sokketsu.muted";

// 1 音 = [周波数 Hz, 開始秒, 長さ秒, 波形]。合成するだけなので音声ファイルは要らない。
type Note = [number, number, number, OscillatorType];
const PATTERNS: Record<Sfx, Note[]> = {
  deposit: [[520, 0, 0.08, "triangle"], [780, 0.06, 0.1, "triangle"]],
  judge: [[330, 0, 0.06, "square"], [440, 0.07, 0.06, "square"]],
  finalize: [[660, 0, 0.09, "triangle"], [880, 0.08, 0.09, "triangle"], [1320, 0.16, 0.22, "triangle"]],
  stamp: [[110, 0, 0.18, "sawtooth"], [82, 0.03, 0.2, "square"]],
  combo: [[990, 0, 0.06, "square"], [1320, 0.05, 0.08, "square"]],
  levelup: [[523, 0, 0.1, "triangle"], [659, 0.1, 0.1, "triangle"], [784, 0.2, 0.1, "triangle"], [1047, 0.3, 0.3, "triangle"]],
  achievement: [[880, 0, 0.08, "sine"], [1175, 0.08, 0.08, "sine"], [1568, 0.16, 0.2, "sine"]],
  fail: [[220, 0, 0.15, "sawtooth"], [165, 0.12, 0.25, "sawtooth"]],
};

let context: AudioContext | null = null;
let muted = loadMuted();

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export const isMuted = () => muted;

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // 保存できなくても切り替えは効く
  }
}

/** 効果音を鳴らす。ブラウザの自動再生制限があるので、最初のクリック以降に鳴る。 */
export function play(sfx: Sfx): void {
  if (muted || typeof window === "undefined") return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const ctx = context;
    const t0 = ctx.currentTime;
    for (const [freq, start, length, wave] of PATTERNS[sfx]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t0 + start);
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + length + 0.02);
    }
  } catch {
    // 音が出せない環境でも画面は動かす
  }
}
