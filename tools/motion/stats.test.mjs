import { test } from "node:test";
import assert from "node:assert/strict";
import { STATIC_PCT, aroundMarks, bySegment, formatTable, summarize } from "./stats.mjs";

const at = (pcts, step = 0.05) => pcts.map((pct, i) => ({ t: i * step, pct }));

test("空のコマ列はすべて 0", () => {
  assert.deepEqual(summarize([]), { frames: 0, staticRatio: 0, meanPct: 0, longestStaticS: 0, secondsOver1: 0 });
});

test("静止の割合は 0.3% 未満のコマの割合（ちょうど 0.3% は動いている）", () => {
  const s = summarize(at([0, 0.29, STATIC_PCT, 5]));
  assert.equal(s.staticRatio, 0.5);
  assert.equal(s.meanPct, (0 + 0.29 + 0.3 + 5) / 4);
});

test("最長の静止は、静止が続いた区間の長さ（秒）", () => {
  // 0.0〜0.15 が静止、0.2 が動き、0.25〜0.30 が静止
  const s = summarize(at([0, 0, 0, 0, 2, 0, 0]));
  assert.ok(Math.abs(s.longestStaticS - 0.15) < 1e-9);
  // 途中から始まる静止は、直前のコマの時刻から数える
  const mid = summarize(at([2, 0, 0]));
  assert.ok(Math.abs(mid.longestStaticS - 0.1) < 1e-9);
});

test("時刻の空いたコマ（別の区間をつないだもの）で静止の連続を切る", () => {
  const frames = [
    { t: 0, pct: 0 },
    { t: 0.05, pct: 0 },
    { t: 5, pct: 0 },
    { t: 5.05, pct: 0 },
    { t: 5.1, pct: 0 },
  ];
  assert.ok(Math.abs(summarize(frames).longestStaticS - 0.1) < 1e-9);
  // ちょうど GAP_S の間はつながっているとみなす
  assert.ok(Math.abs(summarize(at([0, 0, 0], 0.1)).longestStaticS - 0.2) < 1e-9);
});

test("1% 超の秒は、1 秒ごとの平均が 1% を超えた秒の数（ちょうど 1% は数えない）", () => {
  const frames = [
    { t: 0.1, pct: 2 },
    { t: 0.5, pct: 0.5 }, // 0 秒目の平均 1.25 → 数える
    { t: 1.2, pct: 1 }, // 1 秒目の平均 1 → 数えない
    { t: 2.0, pct: 3 }, // 2 秒目 → 数える
  ];
  assert.equal(summarize(frames).secondsOver1, 2);
});

test("区間ごとの集計は marks で区切り、同じ名前はまとめ、end 以降は捨てる", () => {
  const frames = at([1, 1, 0, 0, 5, 5, 9], 1); // t = 0..6
  const marks = [
    { label: "a", at: 0 },
    { label: "b", at: 2 },
    { label: "a", at: 4 },
    { label: "end", at: 6 },
  ];
  const seg = bySegment(frames, marks);
  assert.deepEqual(seg.map((s) => [s.label, s.frames]), [["a", 4], ["b", 2]]);
  assert.equal(seg[0].meanPct, (1 + 1 + 5 + 5) / 4);
  assert.equal(seg[1].staticRatio, 1);
});

test("印が時刻順でなくても、並べ直してから区切る", () => {
  const frames = at([1, 1, 0, 0], 1); // t = 0..3
  const seg = bySegment(frames, [
    { label: "b", at: 2 },
    { label: "a", at: 0 },
    { label: "end", at: 4 },
  ]);
  assert.deepEqual(seg.map((s) => [s.label, s.frames]), [["a", 2], ["b", 2]]);
});

test("同じ時刻の mark は空の区間を作らない", () => {
  const seg = bySegment(at([1, 1], 1), [
    { label: "x", at: 0 },
    { label: "y", at: 0 },
  ]);
  assert.deepEqual(seg.map((s) => s.label), ["y"]);
});

test("確定の瞬間の見え方があれば、表の前に出す", () => {
  const s = summarize(at([0, 2]));
  const text = formatTable({
    url: "u",
    mode: "play",
    viewport: "390x844",
    reducedMotion: false,
    sentTransactions: 4,
    visibility: { ".stage": true, ".vault-ms": false, ".x": null },
    overall: s,
    segments: [],
  });
  assert.match(text, /確定の瞬間に画面内: \.stage ○ · \.vault-ms × · \.x —/);
});

test("表は全体と区間の行を出す", () => {
  const s = summarize(at([0, 2]));
  const text = formatTable({
    url: "u",
    mode: "idle",
    viewport: "1280x900",
    reducedMotion: true,
    sentTransactions: 0,
    overall: s,
    segments: [{ label: "idle", ...s }],
  });
  assert.match(text, /^u · idle · 1280x900 · reduced-motion · 送信した取引 0 件/);
  assert.match(text, /\| 全体 \| 2 \| 50% \| 1\.00% \| 0\.00 s \| 0 \|/);
  assert.match(text, /\| idle \|/);
});

test("切り替わりの前後の平均は、その時刻の ±half 秒（両端を含む）のコマ", () => {
  const frames = at([0, 2, 4, 6, 8], 1); // t = 0..4
  const result = aroundMarks(
    frames,
    [
      { label: "load", at: 0 },
      { label: "ready", at: 0.5 },
      { label: "judging", at: 2 },
      { label: "released", at: 4 },
      { label: "afterglow", at: 4 },
      { label: "done", at: 4 },
      { label: "end", at: 4 },
    ],
    1,
  );
  assert.deepEqual(result, [
    { label: "judging", at: 2, meanPct: 4 }, // t=1,2,3
    { label: "released", at: 4, meanPct: 7 }, // t=3,4
  ]);
  assert.deepEqual(aroundMarks([], [{ label: "x", at: 1 }]), [{ label: "x", at: 1, meanPct: 0 }]);
});

test("切り替わりがあれば表の後ろに出す", () => {
  const s = summarize(at([0, 2]));
  const text = formatTable({
    url: "u",
    mode: "play",
    viewport: "1x1",
    reducedMotion: false,
    overall: s,
    segments: [],
    transitions: [{ label: "judging", at: 1, meanPct: 5.25 }],
  });
  assert.match(text, /切り替わりの前後 1 秒の平均: judging 5\.3%$/);
});
