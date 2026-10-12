// 発表動画の台本（場面の長さ）と、実演の場面で撮影のどの時刻を映し、どの字幕を出すかを決める純粋関数。

/** 実演以外の場面の長さ（秒）。ナレーションが長ければ伸ばす。実演の長さは撮影から決まる。 */
export const SCENE_S = { hook: 8, intro: 9, problem: 9, flow: 11, numbers: 9, solana: 12, close: 7 };

/** 実演の場面の上限（秒）。撮影がこれより長ければ早送りする。 */
export const DEMO_MAX_S = 50;

/** 実演は「始められるようになった」少し前（待機中の再生と、始める操作）から映す（秒）。 */
export const DEMO_LEAD_S = 4;

/** ナレーションは場面（または実演の印）の少し後から始める（秒）。 */
export const VOICE_LEAD_S = 0.3;

/** 場面をナレーションに合わせて伸ばすときの余白（頭の VOICE_LEAD_S と、言い終えてからの間）。 */
export const VOICE_PAD_S = 1.2;

/** 実演のナレーションの文と文の間（秒）。足りなければ実演を止めて待つ。 */
export const CUE_GAP_S = 0.4;

/** 止めている間に映すコマは、次の印のこれだけ前（印ちょうどだと次の段階の画面と字幕になる）。 */
export const HOLD_EPS_S = 0.05;

/** 通常の並び（実演あり・約 2 分 7 秒）。 */
export const ORDER = ["hook", "problem", "flow", "demo", "numbers", "solana", "close"];

/** 短い版（Colosseum のピッチ動画は 2 分以内・自己紹介つき。実演は別のデモ動画で見せる）。 */
export const SHORT_ORDER = ["hook", "intro", "problem", "flow", "numbers", "solana", "close"];

const CAPTIONS = {
  onboard: "First visit: a three-card walkthrough",
  start: "Start a trial — devnet SOL is funded for you",
  ready: "Start a trial — devnet SOL is funded for you",
  depositing: "Deposit — 0.05 SOL into the escrow vault",
  judging: "Jev decides — only a choice and a probability",
  holding: "hold — the typed decision stops the payment",
  stopped: "Stopped. Not a single lamport moved",
  countdown: "Next: release",
  releasing: "release — signature verified, paying the payee",
  released: "Finalized in {ms} ms",
  error: "Failed",
};

const markAt = (run, label) => run.marks.find((m) => m.label === label)?.at;

/** 撮影の nth 回目の印 mark の時刻（無ければ undefined）。 */
const nthMarkAt = (marks, mark, nth) => marks.filter((m) => m.label === mark)[nth]?.at;

/**
 * 実演のナレーションが次の文の印までに収まらない分だけ、次の印の直前で止める長さを求める。
 * @returns {{ at: number, length: number }[]} at は撮影の時刻（次の印）、length は止める秒
 */
function holdsFor(marks, cues, from, end, speed) {
  const placed = cues
    .map((c) => ({ ...c, at: nthMarkAt(marks, c.mark, c.nth) }))
    .filter((c) => c.at !== undefined)
    .map((c) => ({ ...c, at: Math.max(from, c.at) }))
    .sort((a, b) => a.at - b.at);
  return placed.flatMap((c, i) => {
    const next = placed[i + 1]?.at ?? end;
    const short = c.length + VOICE_LEAD_S + CUE_GAP_S - (next - c.at) / speed;
    return short > 1e-9 && next > c.at ? [{ at: next, length: short }] : [];
  });
}

/**
 * 撮影データ（capture.mjs の run.json）とナレーションの長さから台本を作る。
 * voice の場面名には場面のナレーションの秒、voice.demo には実演の文（撮影の nth 回目の印 mark に置く）の秒。
 * @param {object} run
 * @param {Partial<Record<keyof typeof SCENE_S, number>> & { demo?: { mark: string, nth: number, length: number }[] }} [voice]
 * @returns {{ scenes: { name: string, start: number, length: number }[], total: number, demo: { from: number, speed: number, holds: { at: number, length: number }[] }, marks: { label: string, at: number }[], ms: number }}
 */
export function buildTimeline(run, voice = {}, { order = ORDER } = {}) {
  const ready = markAt(run, "ready");
  const end = markAt(run, "end");
  if (ready === undefined || end === undefined) throw new Error("run.json needs the ready and end marks");
  // 初回の案内（onboard）を撮っていればそこから、なければ ready の少し前から映す
  const onboard = markAt(run, "onboard");
  const from = onboard !== undefined ? onboard : Math.max(0, ready - DEMO_LEAD_S);
  const captured = end - from;
  const speed = captured / Math.min(captured, DEMO_MAX_S);
  const holds = holdsFor(run.marks, voice.demo ?? [], from, end, speed);
  const demoLength = captured / speed + holds.reduce((sum, h) => sum + h.length, 0);
  const lengthOf = (name) =>
    name === "demo" ? demoLength : Math.max(SCENE_S[name], voice[name] === undefined ? 0 : voice[name] + VOICE_PAD_S);
  let start = 0;
  const scenes = order.map((name) => {
    const scene = { name, start, length: lengthOf(name) };
    start += scene.length;
    return scene;
  });
  return {
    scenes,
    total: start,
    demo: { from, speed, holds },
    marks: run.marks,
    ms: Math.round(run.result.finalizedMs),
  };
}

/**
 * 動画の時刻 t の場面と、その場面の中の秒（local）。最後の場面より後は最後の場面の終わり。
 * paced は動きの時間軸：ナレーションで伸ばした場面でも、動きは元の長さ（SCENE_S）の台本を引き伸ばして進める。
 */
export function frameAt(tl, t) {
  const last = tl.scenes[tl.scenes.length - 1];
  const scene = tl.scenes.find((s) => t < s.start + s.length) ?? last;
  const local = Math.min(Math.max(0, t - scene.start), scene.length);
  const paced = scene.name === "demo" ? local : (local * SCENE_S[scene.name]) / scene.length;
  return { scene: scene.name, local, paced };
}

/** 実演の場面の中の秒 u に映す、撮影の時刻（秒）。止めている間は次の印の HOLD_EPS_S 前。 */
export function demoTimeAt(tl, u) {
  const { from, speed, holds = [] } = tl.demo;
  let c = from;
  let start = 0; // c を映し始める実演の中の秒
  for (const h of holds) {
    const play = (h.at - c) / speed;
    if (u < start + play) return c + (u - start) * speed;
    if (u < start + play + h.length) return h.at - HOLD_EPS_S;
    start += play + h.length;
    c = h.at;
  }
  return c + (u - start) * speed;
}

/** 撮影の時刻 c を映す、実演の場面の中の秒（demoTimeAt の逆。印ちょうどは止め終わった後）。 */
export function demoUAt(tl, c) {
  const { from, speed, holds = [] } = tl.demo;
  let cur = from;
  let start = 0;
  for (const h of holds) {
    if (c < h.at) return start + (c - cur) / speed;
    start += (h.at - cur) / speed + h.length;
    cur = h.at;
  }
  return start + (c - cur) / speed;
}

/**
 * 実演で撮影を再生する区間（止める位置で切れる）。効果音を同じ区切りで並べ直すのに使う。
 * @returns {{ from: number, to: number, at: number }[]} from / to は撮影の時刻、at は動画の時刻
 */
export function demoSegments(tl) {
  const demo = tl.scenes.find((s) => s.name === "demo");
  if (!demo) return [];
  const end = tl.demo.from + (demo.length - tl.demo.holds.reduce((sum, h) => sum + h.length, 0)) * tl.demo.speed;
  const cuts = [tl.demo.from, ...tl.demo.holds.map((h) => h.at), end];
  return cuts.slice(0, -1).map((from, i) => ({ from, to: cuts[i + 1], at: demo.start + demoUAt(tl, from) }));
}

/** 実演の場面の中の秒 u に出す字幕（撮影の段階の切り替わりから）。 */
export function captionAt(tl, u) {
  const at = demoTimeAt(tl, u);
  const current = tl.marks.filter((m) => m.at <= at && m.label in CAPTIONS).at(-1);
  return current ? CAPTIONS[current.label].replace("{ms}", String(tl.ms)) : CAPTIONS.ready;
}

/**
 * 実演のナレーション（撮影の nth 回目の印 mark に紐づく文）を、動画の時刻に置く。撮っていない印の文は落とす。
 * @param {{ mark: string, nth: number, text: string }[]} cues
 * @returns {{ at: number, text: string }[]}
 */
export function demoCueTimes(tl, cues) {
  const demo = tl.scenes.find((s) => s.name === "demo");
  if (!demo) return [];
  return cues.flatMap(({ mark, nth, text }) => {
    const at = nthMarkAt(tl.marks, mark, nth);
    if (at === undefined) return [];
    const u = demoUAt(tl, Math.max(tl.demo.from, at));
    return [{ at: demo.start + u + VOICE_LEAD_S, text }];
  });
}
