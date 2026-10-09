import { test } from "node:test";
import assert from "node:assert/strict";
import { narrationFor } from "./narration.mjs";

const RUN = {
  finality: { decision: "release 96%" },
  result: { finalizedMs: 839.2, speedup: "15" },
  timeline: [
    { label: "Request (hold)", detail: "hold: wait #whgb" },
    { label: "Decision: hold", detail: "99.0% · source: jev · oracle-signed" },
    { label: "Decision: release", detail: "96.0% · source: jev · oracle-signed" },
  ],
};

test("ナレーションの数値は撮影の値（確定 ms・倍率・hold と release の確率）から入れる", () => {
  const n = narrationFor(RUN);
  assert.match(n.hook, /we measured 839 milliseconds/);
  assert.match(n.numbers, /^839 milliseconds from send to finalized\. About 15 times faster/);
  const text = n.demo.map((c) => c.text).join(" ");
  assert.match(text, /Jev says hold, at 99 percent/);
  assert.match(text, /Jev returns release, at 96 percent/);
  assert.match(text, /Finalized in 839 milliseconds/);
});

test("全場面（実演以外）にナレーションがあり、実演は撮影の印に紐づく", () => {
  const n = narrationFor(RUN);
  for (const k of ["hook", "problem", "flow", "numbers", "solana", "close"]) assert.ok(n[k].length > 40, k);
  assert.deepEqual(
    n.demo.map((c) => [c.mark, c.nth]),
    [
      ["onboard", 0],
      ["start", 0],
      ["depositing", 0],
      ["countdown", 0],
      ["released", 0],
    ],
  );
});

test("確率が読めなければ、数を言わない文にする（作った数字を言わない）", () => {
  const n = narrationFor({ ...RUN, finality: {}, timeline: [] });
  const text = n.demo.map((c) => c.text).join(" ");
  assert.match(text, /Jev says hold\./);
  assert.match(text, /Jev returns release\./);
  assert.doesNotMatch(text, /percent/);
});
