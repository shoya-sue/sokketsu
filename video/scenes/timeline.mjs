// 発表動画の台本（場面の長さ）と、実演の場面で撮影のどの時刻を映し、どの字幕を出すかを決める純粋関数。

/** 実演以外の場面の長さ（秒）。実演の長さは撮影から決まる。 */
export const SCENE_S = { hook: 8, problem: 9, flow: 11, numbers: 9, close: 7 };

/** 実演の場面の上限（秒）。撮影がこれより長ければ早送りする。 */
export const DEMO_MAX_S = 40;

/** 実演は「始められるようになった」少し前（待機中の再生と、始める操作）から映す（秒）。 */
export const DEMO_LEAD_S = 4;

const CAPTIONS = {
  ready: "お試しで始める（devnet SOL を自動で用意）",
  depositing: "預け入れ — エスクローに 0.05 SOL",
  judging: "Jev が判断 — 選択肢と確率だけを返す",
  holding: "hold — 止める判断。送金しない",
  stopped: "止めた。お金は 1 lamport も動いていない",
  countdown: "次は release",
  releasing: "release — 署名を検証して受注者へ",
  released: "確定 {ms} ms",
  error: "失敗",
};

const markAt = (run, label) => run.marks.find((m) => m.label === label)?.at;

/**
 * 撮影データ（capture.mjs の run.json）から台本を作る。
 * @returns {{ scenes: { name: string, start: number, length: number }[], total: number, demo: { from: number, speed: number }, marks: { label: string, at: number }[], ms: number }}
 */
export function buildTimeline(run) {
  const ready = markAt(run, "ready");
  const end = markAt(run, "end");
  if (ready === undefined || end === undefined) throw new Error("run.json に ready と end の印が要る");
  const from = Math.max(0, ready - DEMO_LEAD_S);
  const captured = end - from;
  const demoLength = Math.min(captured, DEMO_MAX_S);
  const order = [
    ["hook", SCENE_S.hook],
    ["problem", SCENE_S.problem],
    ["flow", SCENE_S.flow],
    ["demo", demoLength],
    ["numbers", SCENE_S.numbers],
    ["close", SCENE_S.close],
  ];
  let start = 0;
  const scenes = order.map(([name, length]) => {
    const scene = { name, start, length };
    start += length;
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

/** 動画の時刻 t の場面と、その場面の中の秒。最後の場面より後は最後の場面の終わり。 */
export function frameAt(tl, t) {
  const last = tl.scenes[tl.scenes.length - 1];
  const scene = tl.scenes.find((s) => t < s.start + s.length) ?? last;
  return { scene: scene.name, local: Math.min(Math.max(0, t - scene.start), scene.length) };
}

/** 実演の場面の中の秒 u に映す、撮影の時刻（秒）。 */
export const demoTimeAt = (tl, u) => tl.demo.from + u * tl.demo.speed;

/** 実演の場面の中の秒 u に出す字幕（撮影の段階の切り替わりから）。 */
export function captionAt(tl, u) {
  const at = demoTimeAt(tl, u);
  const current = tl.marks.filter((m) => m.at <= at && m.label in CAPTIONS).at(-1);
  return current ? CAPTIONS[current.label].replace("{ms}", String(tl.ms)) : CAPTIONS.ready;
}
