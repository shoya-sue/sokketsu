import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_LEAD_S, DEMO_MAX_S, SCENE_S, buildTimeline, captionAt, demoTimeAt, frameAt } from "./timeline.mjs";

const run = (marks, ms = 812.4) => ({ marks, result: { finalizedMs: ms } });
const RUN = run([
  { label: "start", at: 3 },
  { label: "ready", at: 12 },
  { label: "depositing", at: 13.5 },
  { label: "judging", at: 15 },
  { label: "holding", at: 16 },
  { label: "stopped", at: 17 },
  { label: "countdown", at: 17.2 },
  { label: "depositing", at: 23.2 },
  { label: "judging", at: 24.5 },
  { label: "releasing", at: 25.5 },
  { label: "released", at: 26.4 },
  { label: "end", at: 31 },
]);

test("台本は 掴み → 課題 → 仕組み → 実演 → 数値 → 締め で、実演は撮影の長さ", () => {
  const tl = buildTimeline(RUN);
  assert.deepEqual(
    tl.scenes.map((s) => [s.name, s.start, s.length]),
    [
      ["hook", 0, 8],
      ["problem", 8, 9],
      ["flow", 17, 11],
      ["demo", 28, 23],
      ["numbers", 51, 9],
      ["close", 60, 7],
    ],
  );
  assert.equal(tl.total, 67);
  assert.deepEqual(tl.demo, { from: 12 - DEMO_LEAD_S, speed: 1 });
  assert.equal(tl.ms, 812);
  assert.deepEqual(SCENE_S, { hook: 8, problem: 9, flow: 11, numbers: 9, close: 7 });
});

test("撮影が上限より長ければ早送りし、実演は上限の長さ", () => {
  const tl = buildTimeline(run([{ label: "ready", at: 1 }, { label: "end", at: 80 }]));
  assert.equal(DEMO_MAX_S, 40);
  assert.equal(tl.scenes[3].length, 40);
  assert.equal(tl.demo.speed, 2);
  assert.equal(tl.demo.from, 0);
  // ちょうど上限なら等速
  assert.equal(buildTimeline(run([{ label: "ready", at: 1 }, { label: "end", at: 40 }])).demo.speed, 1);
});

test("ready が撮影の最初に近ければ、0 秒から映す", () => {
  assert.equal(buildTimeline(run([{ label: "ready", at: 0.4 }, { label: "end", at: 10 }])).demo.from, 0);
});

test("ready か end の印が無ければ作れない", () => {
  assert.throws(() => buildTimeline(run([{ label: "end", at: 5 }])), /ready と end/);
  assert.throws(() => buildTimeline(run([{ label: "ready", at: 5 }])), /ready と end/);
});

test("動画の時刻から場面と場面の中の秒（境目は次の場面、終わりより後は最後の場面の終わり）", () => {
  const tl = buildTimeline(RUN);
  assert.deepEqual(frameAt(tl, 0), { scene: "hook", local: 0 });
  assert.deepEqual(frameAt(tl, 7.9), { scene: "hook", local: 7.9 });
  assert.deepEqual(frameAt(tl, 8), { scene: "problem", local: 0 });
  assert.deepEqual(frameAt(tl, 30), { scene: "demo", local: 2 });
  assert.deepEqual(frameAt(tl, 59.5), { scene: "numbers", local: 8.5 });
  assert.deepEqual(frameAt(tl, 66.5), { scene: "close", local: 6.5 });
  assert.deepEqual(frameAt(tl, 99), { scene: "close", local: 7 });
  assert.deepEqual(frameAt(tl, -1), { scene: "hook", local: 0 });
});

test("実演の中の秒から撮影の時刻（早送りの倍率を掛ける）", () => {
  const tl = buildTimeline(RUN);
  assert.equal(demoTimeAt(tl, 0), 8); // ready（12 秒）の DEMO_LEAD_S 前
  assert.equal(demoTimeAt(tl, 5), 13);
  const fast = buildTimeline(run([{ label: "ready", at: 1 }, { label: "end", at: 80 }]));
  assert.equal(demoTimeAt(fast, 10), 20);
});

// 撮影の時刻 at を、実演の中の秒に直す（RUN では at − 8）
const u = (at) => at - 8;

test("字幕は撮影の段階に合わせる（確定は実測の ms を出す）", () => {
  const tl = buildTimeline(RUN);
  assert.equal(captionAt(tl, 0), "お試しで始める（devnet SOL を自動で用意）"); // ready の前
  assert.equal(captionAt(tl, u(12)), "お試しで始める（devnet SOL を自動で用意）"); // ready ちょうど
  assert.equal(captionAt(tl, u(14)), "預け入れ — エスクローに 0.05 SOL");
  assert.equal(captionAt(tl, u(17.1)), "止めた。お金は 1 lamport も動いていない");
  assert.equal(captionAt(tl, u(18)), "次は release");
  assert.equal(captionAt(tl, u(26)), "release — 署名を検証して受注者へ");
  assert.equal(captionAt(tl, u(27)), "確定 812 ms");
});

test("字幕に無い印（start・end）は飛ばす", () => {
  const tl = buildTimeline(RUN);
  assert.equal(captionAt(tl, u(30.9)), "確定 812 ms"); // end（31 秒）の直前
  assert.equal(captionAt(tl, u(31)), "確定 812 ms"); // end 以降も確定のまま
});
