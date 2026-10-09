// 発表動画の台本（場面の長さ）と、実演の場面で撮影のどの時刻を映し、どの字幕を出すかを決める純粋関数。

/** 実演以外の場面の長さ（秒）。ナレーションが長ければ伸ばす。実演の長さは撮影から決まる。 */
export const SCENE_S = { hook: 8, problem: 9, flow: 11, numbers: 9, solana: 12, close: 7 };

/** 実演の場面の上限（秒）。撮影がこれより長ければ早送りする。 */
export const DEMO_MAX_S = 50;

/** 実演は「始められるようになった」少し前（待機中の再生と、始める操作）から映す（秒）。 */
export const DEMO_LEAD_S = 4;

/** ナレーションは場面（または実演の印）の少し後から始める（秒）。 */
export const VOICE_LEAD_S = 0.3;

/** 場面をナレーションに合わせて伸ばすときの余白（頭の VOICE_LEAD_S と、言い終えてからの間）。 */
export const VOICE_PAD_S = 1.2;

const ORDER = ["hook", "problem", "flow", "demo", "numbers", "solana", "close"];

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

/**
 * 撮影データ（capture.mjs の run.json）とナレーションの長さ（場面ごとの秒）から台本を作る。
 * @param {object} run
 * @param {Partial<Record<keyof typeof SCENE_S, number>>} [voice]
 * @returns {{ scenes: { name: string, start: number, length: number }[], total: number, demo: { from: number, speed: number }, marks: { label: string, at: number }[], ms: number }}
 */
export function buildTimeline(run, voice = {}) {
  const ready = markAt(run, "ready");
  const end = markAt(run, "end");
  if (ready === undefined || end === undefined) throw new Error("run.json needs the ready and end marks");
  // 初回の案内（onboard）を撮っていればそこから、なければ ready の少し前から映す
  const onboard = markAt(run, "onboard");
  const from = onboard !== undefined ? onboard : Math.max(0, ready - DEMO_LEAD_S);
  const captured = end - from;
  const demoLength = Math.min(captured, DEMO_MAX_S);
  const lengthOf = (name) =>
    name === "demo" ? demoLength : Math.max(SCENE_S[name], voice[name] === undefined ? 0 : voice[name] + VOICE_PAD_S);
  let start = 0;
  const scenes = ORDER.map((name) => {
    const scene = { name, start, length: lengthOf(name) };
    start += scene.length;
    return scene;
  });
  return {
    scenes,
    total: start,
    demo: { from, speed: captured / demoLength },
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

/** 実演の場面の中の秒 u に映す、撮影の時刻（秒）。 */
export const demoTimeAt = (tl, u) => tl.demo.from + u * tl.demo.speed;

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
  return cues.flatMap(({ mark, nth, text }) => {
    const m = tl.marks.filter((x) => x.label === mark)[nth];
    if (!m) return [];
    const u = Math.max(0, (m.at - tl.demo.from) / tl.demo.speed);
    return [{ at: demo.start + u + VOICE_LEAD_S, text }];
  });
}
