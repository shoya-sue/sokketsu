import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_LEAD_S,
  DEMO_MAX_S,
  SCENE_S,
  VOICE_LEAD_S,
  VOICE_PAD_S,
  buildTimeline,
  captionAt,
  demoCueTimes,
  CUE_GAP_S,
  HOLD_EPS_S,
  demoSegments,
  demoTimeAt,
  SHORT_ORDER,
  demoUAt,
  frameAt,
} from "./timeline.mjs";

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

test("台本は hook → problem → flow → demo → numbers → solana → close で、実演は撮影の長さ", () => {
  const tl = buildTimeline(RUN);
  assert.deepEqual(
    tl.scenes.map((s) => [s.name, s.start, s.length]),
    [
      ["hook", 0, 8],
      ["problem", 8, 9],
      ["flow", 17, 11],
      ["demo", 28, 23],
      ["numbers", 51, 9],
      ["solana", 60, 12],
      ["close", 72, 7],
    ],
  );
  assert.equal(tl.total, 79);
  assert.deepEqual(tl.demo, { from: 12 - DEMO_LEAD_S, speed: 1, holds: [] });
  assert.equal(tl.ms, 812);
  assert.deepEqual(SCENE_S, { hook: 8, intro: 9, problem: 9, flow: 11, numbers: 9, solana: 12, close: 7 });
});

test("ナレーションが場面より長ければ、場面をナレーション + 余白まで伸ばす（短ければ元の長さ）", () => {
  const tl = buildTimeline(RUN, { hook: 13, problem: 2, close: 7 });
  const len = Object.fromEntries(tl.scenes.map((s) => [s.name, s.length]));
  assert.equal(len.hook, 13 + VOICE_PAD_S);
  assert.equal(len.problem, 9);
  assert.equal(len.close, 7 + VOICE_PAD_S);
  assert.equal(len.demo, 23); // 実演は撮影の長さのまま
  assert.equal(tl.scenes[1].start, 13 + VOICE_PAD_S);
});

test("伸ばした場面の動きは、元の長さの時間軸に縮めて進める（paced）", () => {
  const tl = buildTimeline(RUN, { hook: 16 - VOICE_PAD_S });
  assert.deepEqual(frameAt(tl, 8), { scene: "hook", local: 8, paced: 4 }); // 16 秒を 8 秒の動きで
  assert.deepEqual(frameAt(tl, 16), { scene: "problem", local: 0, paced: 0 });
  // 実演は伸び縮みしない
  assert.equal(frameAt(tl, 16 + 9 + 11 + 3).paced, 3);
});

test("撮影が上限より長ければ早送りし、実演は上限の長さ", () => {
  const tl = buildTimeline(run([{ label: "ready", at: 1 }, { label: "end", at: 100 }]));
  assert.equal(DEMO_MAX_S, 50);
  assert.equal(tl.scenes[3].length, 50);
  assert.equal(tl.demo.speed, 2);
  assert.equal(tl.demo.from, 0);
  // ちょうど上限なら等速
  assert.equal(buildTimeline(run([{ label: "ready", at: 1 }, { label: "end", at: 50 }])).demo.speed, 1);
});

test("ready が撮影の最初に近ければ、0 秒から映す", () => {
  assert.equal(buildTimeline(run([{ label: "ready", at: 0.4 }, { label: "end", at: 10 }])).demo.from, 0);
});

test("ready か end の印が無ければ作れない", () => {
  assert.throws(() => buildTimeline(run([{ label: "end", at: 5 }])), /ready and end/);
  assert.throws(() => buildTimeline(run([{ label: "ready", at: 5 }])), /ready and end/);
});

test("動画の時刻から場面と場面の中の秒（境目は次の場面、終わりより後は最後の場面の終わり）", () => {
  const tl = buildTimeline(RUN);
  assert.deepEqual(frameAt(tl, 0), { scene: "hook", local: 0, paced: 0 });
  assert.deepEqual(frameAt(tl, 7.5), { scene: "hook", local: 7.5, paced: 7.5 });
  assert.deepEqual(frameAt(tl, 8), { scene: "problem", local: 0, paced: 0 });
  assert.deepEqual(frameAt(tl, 30), { scene: "demo", local: 2, paced: 2 });
  assert.deepEqual(frameAt(tl, 59.5), { scene: "numbers", local: 8.5, paced: 8.5 });
  assert.deepEqual(frameAt(tl, 61), { scene: "solana", local: 1, paced: 1 });
  assert.deepEqual(frameAt(tl, 78.5), { scene: "close", local: 6.5, paced: 6.5 });
  assert.deepEqual(frameAt(tl, 99), { scene: "close", local: 7, paced: 7 });
  assert.deepEqual(frameAt(tl, -1), { scene: "hook", local: 0, paced: 0 });
});

test("実演の中の秒から撮影の時刻（早送りの倍率を掛ける）", () => {
  const tl = buildTimeline(RUN);
  assert.equal(demoTimeAt(tl, 0), 8); // ready（12 秒）の DEMO_LEAD_S 前
  assert.equal(demoTimeAt(tl, 5), 13);
  const fast = buildTimeline(run([{ label: "ready", at: 1 }, { label: "end", at: 100 }]));
  assert.equal(demoTimeAt(fast, 10), 20);
});

// 撮影の時刻 at を、実演の中の秒に直す（RUN では at − 8）
const u = (at) => at - 8;

test("字幕は撮影の段階に合わせる（確定は実測の ms を出す）", () => {
  const tl = buildTimeline(RUN);
  assert.equal(captionAt(tl, 0), "Start a trial — devnet SOL is funded for you"); // ready の前
  assert.equal(captionAt(tl, u(12)), "Start a trial — devnet SOL is funded for you"); // ready ちょうど
  assert.equal(captionAt(tl, u(14)), "Deposit — 0.05 SOL into the escrow vault");
  assert.equal(captionAt(tl, u(17.1)), "Stopped. Not a single lamport moved");
  assert.equal(captionAt(tl, u(18)), "Next: release");
  assert.equal(captionAt(tl, u(26)), "release — signature verified, paying the payee");
  assert.equal(captionAt(tl, u(27)), "Finalized in 812 ms");
});

test("字幕に無い印（end）は飛ばす", () => {
  const tl = buildTimeline(RUN);
  assert.equal(captionAt(tl, u(30.9)), "Finalized in 812 ms"); // end（31 秒）の直前
  assert.equal(captionAt(tl, u(31)), "Finalized in 812 ms"); // end 以降も確定のまま
});

test("初回の案内を撮っていれば、実演はそこから映し、字幕も案内から始まる", () => {
  const tl = buildTimeline(
    run([
      { label: "onboard", at: 2 },
      { label: "start", at: 7 },
      { label: "ready", at: 10 },
      { label: "end", at: 30 },
    ]),
  );
  assert.equal(tl.demo.from, 2);
  assert.equal(tl.scenes[3].length, 28);
  assert.equal(captionAt(tl, 0), "First visit: a three-card walkthrough");
  assert.equal(captionAt(tl, 5), "Start a trial — devnet SOL is funded for you"); // start（7 秒）
});

test("実演のナレーションは、撮影の n 回目の印の時刻（動画の時刻）から始める", () => {
  const tl = buildTimeline(RUN);
  const demoStart = tl.scenes[3].start; // 28、撮影の 8 秒が実演の 0 秒
  const cues = demoCueTimes(tl, [
    { mark: "ready", nth: 0, text: "a" },
    { mark: "depositing", nth: 1, text: "b" },
    { mark: "onboard", nth: 0, text: "撮っていない印" },
    { mark: "depositing", nth: 5, text: "そんなに無い" },
  ]);
  assert.deepEqual(cues, [
    { at: demoStart + (12 - 8) + VOICE_LEAD_S, text: "a" },
    { at: demoStart + (23.2 - 8) + VOICE_LEAD_S, text: "b" },
  ]);
});

test("実演より前の印のナレーションは、実演の頭から始める", () => {
  const tl = buildTimeline(RUN);
  const [cue] = demoCueTimes(tl, [{ mark: "start", nth: 0, text: "a" }]); // start は 3 秒、映すのは 8 秒から
  assert.equal(cue.at, tl.scenes[3].start + VOICE_LEAD_S);
});

// 実演のナレーションが次の段階までに収まらなければ、次の段階の直前のコマで止めて待つ（RUN：映すのは 8 秒から）
const CUES = [
  { mark: "ready", nth: 0, length: 3 }, // ready 12 → depositing 13.5（1.5 秒しかない）
  { mark: "depositing", nth: 0, length: 1 }, // 13.5 → countdown 17.2（3.7 秒あるので収まる）
  { mark: "countdown", nth: 0, length: 2 },
];

test("収まらない分だけ、次の印の直前で止める（印の時刻・止める長さ）", () => {
  const tl = buildTimeline(RUN, { demo: CUES });
  const need = 3 + VOICE_LEAD_S + CUE_GAP_S;
  assert.deepEqual(tl.demo.holds, [{ at: 13.5, length: need - 1.5 }]);
  // 実演は止めた分だけ長くなる
  assert.equal(tl.scenes[3].length, 23 + (need - 1.5));
  assert.equal(tl.scenes[4].start, 28 + 23 + (need - 1.5));
});

test("止めている間は印の直前のコマを映し、字幕も前の段階のまま", () => {
  const tl = buildTimeline(RUN, { demo: CUES });
  const hold = tl.demo.holds[0];
  const uHold = 13.5 - 8; // 止め始める実演の中の秒
  assert.equal(demoTimeAt(tl, uHold + 0.01), 13.5 - HOLD_EPS_S);
  assert.equal(demoTimeAt(tl, uHold + hold.length - 0.01), 13.5 - HOLD_EPS_S);
  assert.equal(captionAt(tl, uHold + 0.01), "Start a trial — devnet SOL is funded for you");
  // 止め終わると印の時刻から再生を続ける
  assert.ok(Math.abs(demoTimeAt(tl, uHold + hold.length + 1) - 14.5) < 1e-9);
  assert.equal(captionAt(tl, uHold + hold.length + 1), "Deposit — 0.05 SOL into the escrow vault");
});

test("撮影の時刻から実演の中の秒（止めた分を足す）。印ちょうどは止め終わった後", () => {
  const tl = buildTimeline(RUN, { demo: CUES });
  const len = tl.demo.holds[0].length;
  assert.equal(demoUAt(tl, 12), 4);
  assert.equal(demoUAt(tl, 13.5), 5.5 + len);
  assert.equal(demoUAt(tl, 20), 12 + len);
  for (const u of [0, 3, 9, 15]) {
    const c = demoTimeAt(tl, u + (u > 5.5 ? len : 0));
    assert.ok(Math.abs(demoUAt(tl, c) - (u + (u > 5.5 ? len : 0))) < 1e-9, `u=${u}`);
  }
});

test("ナレーションは止めた後の印の時刻から始まり、前の文と重ならない", () => {
  const tl = buildTimeline(RUN, { demo: CUES });
  const cues = demoCueTimes(tl, CUES.map((c) => ({ ...c, text: c.mark })));
  for (let i = 1; i < cues.length; i++) {
    assert.ok(cues[i - 1].at + CUES[i - 1].length <= cues[i].at, `cue ${i}`);
  }
});

test("再生する区間（効果音を並べ直すのに使う）は、止める位置で切れる", () => {
  const tl = buildTimeline(RUN, { demo: CUES });
  const demo = tl.scenes[3];
  const len = tl.demo.holds[0].length;
  assert.deepEqual(demoSegments(tl), [
    { from: 8, to: 13.5, at: demo.start },
    { from: 13.5, to: 31, at: demo.start + 5.5 + len },
  ]);
  // 止めなければ 1 区間
  assert.deepEqual(demoSegments(buildTimeline(RUN)), [{ from: 8, to: 31, at: demo.start }]);
});

test("撮っていない印のナレーションは止める計算に入れない", () => {
  const tl = buildTimeline(RUN, { demo: [{ mark: "onboard", nth: 0, length: 30 }] });
  assert.deepEqual(tl.demo.holds, []);
});

test("短い版：実演の場面を外し、自己紹介を足せる（場面の並びを選べる）", () => {
  const tl = buildTimeline(RUN, { intro: 9 }, { order: SHORT_ORDER });
  assert.deepEqual(
    tl.scenes.map((s) => s.name),
    ["hook", "intro", "problem", "flow", "numbers", "solana", "close"],
  );
  assert.equal(tl.scenes[1].length, 9 + VOICE_PAD_S);
  assert.equal(tl.total, 8 + 9 + VOICE_PAD_S + 9 + 11 + 9 + 12 + 7);
  // 実演が無いので、実演のナレーションと効果音の区間は空
  assert.deepEqual(demoCueTimes(tl, [{ mark: "ready", nth: 0, text: "a" }]), []);
  assert.deepEqual(demoSegments(tl), []);
});
