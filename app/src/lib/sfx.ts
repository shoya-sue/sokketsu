import { notesFor, type Note } from "./sfxPlan";

export type Sfx =
  | "deposit"
  | "judge"
  | "verify"
  | "finalize"
  | "stamp"
  | "combo"
  | "levelup"
  | "achievement"
  | "fail";

const MUTE_KEY = "sokketsu.muted";

// 1 件の支払いの流れ（預け入れ → 判断 → 署名検証 → 確定 / 止めた / 失敗）は sfxPlan の音階で 1 本につなぐ。
// それ以外（コンボ・レベルアップ・実績）はゲーム側の合図として別に持つ。合成するだけなので音声ファイルは要らない。
export const PATTERNS: Record<Sfx, Note[]> = {
  deposit: notesFor("deposit"),
  judge: notesFor("judge"),
  verify: notesFor("verify"),
  finalize: notesFor("finalize"),
  stamp: notesFor("stop"),
  fail: notesFor("fail"),
  combo: [[990, 0, 0.06, "square"], [1320, 0.05, 0.08, "square"]],
  levelup: [[523, 0, 0.1, "triangle"], [659, 0.1, 0.1, "triangle"], [784, 0.2, 0.1, "triangle"], [1047, 0.3, 0.3, "triangle"]],
  achievement: [[880, 0, 0.08, "sine"], [1175, 0.08, 0.08, "sine"], [1568, 0.16, 0.2, "sine"]],
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
  playNotes(PATTERNS[sfx]);
}

/** 音の列をそのまま鳴らす（カウントダウンの刻みのように、その場で決まる音）。 */
export function playNotes(notes: readonly Note[]): void {
  if (muted || typeof window === "undefined") return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const ctx = context;
    const t0 = ctx.currentTime;
    for (const [freq, start, length, wave] of notes) {
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
