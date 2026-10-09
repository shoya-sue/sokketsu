import { describe, expect, it } from "vitest";
import { FLOW, countdownNotes, notesFor } from "./sfxPlan";

const pitch = (e: Parameters<typeof notesFor>[0]) => Math.max(...notesFor(e).map((n) => n[0]));

describe("notesFor（出来事 → 音）", () => {
  it("預け入れ → 判断 → 署名検証 → 確定 の順に音が上がっていく（1 本の流れ）", () => {
    const tops = FLOW.map(pitch);
    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1]);
  });
  it("止めたときは下がって終わる", () => {
    const notes = notesFor("stop");
    expect(notes[notes.length - 1][0]).toBeLessThan(notes[0][0]);
  });
  it("失敗は流れのどの音より低い", () => expect(pitch("fail")).toBeLessThan(Math.min(...FLOW.map((e) => notesFor(e)[0][0]))));
  it("基準の音高は A4 = 440Hz から始まるペンタトニック", () => {
    expect(notesFor("deposit")[0][0]).toBe(440);
    expect(notesFor("finalize").map((n) => n[0])).toEqual([880, 988, 1109]);
  });
  it("止めたときと失敗の音は固定（流れの音と取り違えない）", () => {
    expect(notesFor("stop")).toEqual([
      [659, 0, 0.12, "sawtooth"],
      [440, 0.1, 0.18, "sawtooth"],
      [220, 0.22, 0.22, "square"],
    ]);
    expect(notesFor("fail")).toEqual([
      [196, 0, 0.15, "sawtooth"],
      [147, 0.12, 0.25, "sawtooth"],
    ]);
  });
  it("どの出来事も 1 音以上あり、波形は WebAudio が受け付ける種類だけ", () => {
    const waves = new Set(["sine", "square", "sawtooth", "triangle"]);
    for (const e of [...FLOW, "stop", "fail"] as const) {
      expect(notesFor(e).length).toBeGreaterThan(0);
      for (const [, , , wave] of notesFor(e)) expect(waves.has(wave)).toBe(true);
    }
  });
  it("段ごとの波形：預け入れ・確定は triangle、判断は square、署名検証は sine", () => {
    expect(new Set(notesFor("deposit").map((n) => n[3]))).toEqual(new Set(["triangle"]));
    expect(new Set(notesFor("judge").map((n) => n[3]))).toEqual(new Set(["square"]));
    expect(new Set(notesFor("verify").map((n) => n[3]))).toEqual(new Set(["sine"]));
    expect(new Set(notesFor("finalize").map((n) => n[3]))).toEqual(new Set(["triangle"]));
  });
  it("すべての音は長さが正で、1 秒以内に鳴り終わる", () => {
    for (const e of [...FLOW, "stop", "fail"] as const) {
      for (const [, start, length] of notesFor(e)) {
        expect(length).toBeGreaterThan(0);
        expect(start + length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("sfx の割り当て（流れの音は sfxPlan と同じ）", () => {
  it("deposit / judge / verify / finalize / stamp / fail は notesFor の音を鳴らす", async () => {
    const { PATTERNS } = await import("./sfx");
    expect(PATTERNS.deposit).toEqual(notesFor("deposit"));
    expect(PATTERNS.verify).toEqual(notesFor("verify"));
    expect(PATTERNS.finalize).toEqual(notesFor("finalize"));
    expect(PATTERNS.stamp).toEqual(notesFor("stop"));
    expect(PATTERNS.fail).toEqual(notesFor("fail"));
  });
});

describe("countdownNotes", () => {
  it("残りが減るほど音が高くなる（6 → 2 秒）", () => {
    const pitches = [6, 5, 4, 3, 2].map((s) => countdownNotes(s)[0][0]);
    expect(pitches).toEqual([494, 554, 659, 740, 880]);
  });

  it("2 秒以上は短い 1 音の square", () => {
    expect(countdownNotes(3)).toEqual([[countdownNotes(3)[0][0], 0, 0.05, "square"]]);
    expect(countdownNotes(2)).toHaveLength(1);
  });

  it("最後の 1 秒は 2 音（2 音目は 1 オクターブ上）", () => {
    const notes = countdownNotes(1);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toEqual([notes[0][0], 0, 0.05, "square"]);
    expect(notes[1]).toEqual([notes[0][0] * 2, 0.07, 0.09, "square"]);
    expect(notes[0][0]).toBeGreaterThan(countdownNotes(2)[0][0]);
  });

  it("具体的な音高（A4 基準のペンタトニック）", () => {
    expect(countdownNotes(6)[0][0]).toBe(494);
    expect(countdownNotes(1)[0][0]).toBe(988);
  });

  it("0 以下は鳴らさず、音階より長い残りは一番下の音", () => {
    expect(countdownNotes(0)).toEqual([]);
    expect(countdownNotes(-1)).toEqual([]);
    expect(countdownNotes(30)[0][0]).toBe(440);
    expect(countdownNotes(7)[0][0]).toBe(440);
  });
});
