// 発表動画（#21）を書き出す。英語のナレーションを macOS の say で作り、その長さで台本を決め、
// scenes/index.html を 1 コマずつ撮って ffmpeg で MP4 にし、ナレーションと撮影の音（効果音）を重ねる。
// 使い方: node render.mjs [出力ファイル]（既定 sokketsu-pitch.mp4）。先に capture/capture.mjs で撮影しておく。
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { narrationFor } from "./scenes/narration.mjs";
import { ORDER, SHORT_ORDER, VOICE_LEAD_S, buildTimeline, demoCueTimes, demoSegments } from "./scenes/timeline.mjs";

const FPS = 60;
const WIDTH = 1920;
const HEIGHT = 1080;
const here = path.dirname(fileURLToPath(import.meta.url));
// PITCH=short なら短い版（実演なし・自己紹介つき・2 分以内）を sokketsu-pitch-short.mp4 に書き出す
const SHORT = process.env.PITCH === "short";
const order = SHORT ? SHORT_ORDER : ORDER;
const out = path.resolve(process.argv[2] ?? path.join(here, SHORT ? "sokketsu-pitch-short.mp4" : "sokketsu-pitch.mp4"));
const capture = path.join(here, "capture", "out");
const run = JSON.parse(readFileSync(path.join(capture, "run.json"), "utf8"));

// ナレーション：1 文ずつ say で書き出し、長さを測る（場面の長さはこの長さで決まる）
const VOICE = process.env.VOICE ?? "Samantha";
const RATE = process.env.VOICE_RATE ?? "182";
const voiceDir = mkdtempSync(path.join(os.tmpdir(), "sokketsu-voice-"));
const durationOf = (file) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
const speak = (name, text) => {
  const file = path.join(voiceDir, `${name}.aiff`);
  execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", file, text]);
  return { file, length: durationOf(file) };
};
const narration = narrationFor(run);
const sceneVoice = Object.fromEntries(
  order.filter((k) => k !== "demo").map((k) => [k, speak(k, narration[k])]),
);
// 実演の文も先に長さを測る。収まらない段階では、実演を次の段階の直前のコマで止めて待つ（timeline.mjs の holds）
const demoVoice = order.includes("demo") ? narration.demo.map((c, i) => ({ ...c, ...speak(`demo${i}`, c.text) })) : [];
const voiceLengths = {
  ...Object.fromEntries(Object.entries(sceneVoice).map(([k, v]) => [k, v.length])),
  demo: demoVoice.map(({ mark, nth, length }) => ({ mark, nth, length })),
};
const tl = buildTimeline(run, voiceLengths, { order });
const clips = [
  ...Object.entries(sceneVoice).map(([k, v]) => ({ ...v, at: tl.scenes.find((s) => s.name === k).start + VOICE_LEAD_S })),
  ...demoCueTimes(tl, demoVoice).map((c, i) => ({ ...demoVoice.find((d) => d.text === c.text), at: c.at })),
].sort((a, b) => a.at - b.at);
for (const h of tl.demo.holds) console.log(`hold ${h.length.toFixed(2)} s before capture ${h.at.toFixed(2)} s`);
for (let i = 1; i < clips.length; i++) {
  const prev = clips[i - 1];
  if (prev.at + prev.length > clips[i].at) {
    console.warn(`narration overlaps by ${(prev.at + prev.length - clips[i].at).toFixed(2)} s at ${clips[i].at.toFixed(2)} s`);
  }
}

// 音の無い映像（${out}.video.mp4）は消さずに残す。MUX_ONLY=1 なら、コマを撮り直さずに音だけ重ね直す（台本の長さが同じときだけ）
const silent = `${out}.video.mp4`;
const total = tl.total;
const frames = Math.round(total * FPS);
if (process.env.MUX_ONLY) {
  if (!existsSync(silent)) throw new Error(`MUX_ONLY: ${silent} が無い（先に通しで書き出す）`);
  const had = durationOf(silent);
  if (Math.abs(had - frames / FPS) > 1 / FPS) throw new Error(`MUX_ONLY: 映像 ${had} s と台本 ${total} s の長さが違う`);
} else {
  await renderFrames();
}

async function renderFrames() {
  // ES モジュールと動画のシーク（Range）のため、リポジトリの直下を http で配る（ロゴは app/public にある）。
  const root = path.resolve(here, "..");
  const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".webm": "video/webm", ".svg": "image/svg+xml" };
  const server = createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    const size = statSync(file).size;
    const type = TYPES[path.extname(file)] ?? "application/octet-stream";
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : size - 1;
      res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
      createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": size });
      createReadStream(file).pipe(res);
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const ffmpeg = spawn(
    "ffmpeg",
    ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-r", String(FPS), silent],
    { stdio: ["pipe", "inherit", "inherit"] },
  );

  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}/video/scenes/index.html`);
  await page.waitForFunction(() => typeof window.setup === "function");
  const pageTotal = await page.evaluate(([data, src, voice, order]) => window.setup(data, src, voice, order), [run, "/video/capture/out/screen.webm", voiceLengths, order]);
  if (Math.abs(pageTotal - total) > 1e-6) throw new Error(`page timeline ${pageTotal} != ${total}`);
  await page.evaluate(() => document.fonts.ready);
  console.log(tl.scenes.map((s) => `${s.name} ${s.start.toFixed(1)}s +${s.length.toFixed(1)}s`).join(" | "));

  // 確認用：PREVIEW=秒,秒,… なら、その時刻のコマだけ PNG に撮って終える（動画は書き出さない）
  if (process.env.PREVIEW) {
    for (const t of process.env.PREVIEW.split(",").map(Number)) {
      await page.evaluate((x) => window.renderAt(x), t);
      await page.locator("#stage").screenshot({ path: `${out}.${t}.png`, animations: "disabled" });
    }
    ffmpeg.kill();
    await browser.close();
    server.close();
    rmSync(silent, { force: true });
    rmSync(voiceDir, { recursive: true, force: true });
    process.exit(0);
  }

  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.renderAt(t), i / FPS);
    const png = await page.locator("#stage").screenshot({ type: "png", animations: "disabled" });
    if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
    if (i % (FPS * 10) === 0) console.log(`frame ${i}/${frames}`);
  }
  await browser.close();
  server.close();
  ffmpeg.stdin.end();
  await new Promise((resolve, reject) => ffmpeg.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}`)))));
}

// ナレーションを場面と実演の印の時刻に置き、撮影の音（アプリの効果音）を実演の場面に小さめに重ねる。
// 撮影の音の先頭は撮影の audioOffsetS 秒にあたる。
const audio = path.join(capture, "audio.webm");
const demo = tl.scenes.find((s) => s.name === "demo");
const inputs = ["-i", silent];
const chains = [];
const mixes = [];
clips.forEach((c, i) => {
  inputs.push("-i", c.file);
  const ms = Math.round(c.at * 1000);
  chains.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${i}]`);
  mixes.push(`[v${i}]`);
});
if (demo && existsSync(audio) && run.audioOffsetS != null) {
  // 撮影の音の先頭は撮影の audioOffsetS 秒。実演を止めた所で切り、再生する区間ごとに動画の時刻へ置く
  const end = demo.start + demo.length;
  const tempo = tl.demo.speed === 1 ? "" : `,atempo=${Math.min(2, tl.demo.speed).toFixed(4)}`;
  const parts = demoSegments(tl)
    .map((seg) => ({ ...seg, a0: Math.max(0, seg.from - run.audioOffsetS), a1: seg.to - run.audioOffsetS }))
    .filter((seg) => seg.a1 > seg.a0);
  parts.forEach((seg, k) => {
    const n = inputs.length / 2;
    inputs.push("-i", audio);
    const lead = seg.at + (seg.a0 - (seg.from - run.audioOffsetS)) / tl.demo.speed; // 区間の頭より後に録音が始まった分
    const ms = Math.round(lead * 1000);
    chains.push(
      `[${n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start=${seg.a0.toFixed(3)}:end=${seg.a1.toFixed(3)},asetpts=PTS-STARTPTS${tempo},adelay=${ms}|${ms},volume=0.35[s${k}]`,
    );
  });
  if (parts.length > 0) {
    chains.push(`${parts.map((_, k) => `[s${k}]`).join("")}amix=inputs=${parts.length}:normalize=0,atrim=end=${end.toFixed(3)},afade=t=out:st=${(end - 0.6).toFixed(3)}:d=0.6[sfx]`);
    mixes.push("[sfx]");
  }
}
const filter = `${chains.join(";")};${mixes.join("")}amix=inputs=${mixes.length}:normalize=0:duration=longest,alimiter=limit=0.95,apad,atrim=end=${total.toFixed(3)}[a]`;
await new Promise((resolve, reject) => {
  const mux = spawn("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", filter,
    "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", total.toFixed(3), out], { stdio: "inherit" });
  mux.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg mux ${c}`))));
});
rmSync(voiceDir, { recursive: true, force: true });
for (const c of clips) console.log(`voice ${c.at.toFixed(2)}s +${c.length.toFixed(2)}s`);
// 台本の時刻（場面の開始と長さ）を残す。技術デモ動画（pitch/build.mjs）が実演の場面を切り出すのに使う
writeFileSync(`${out.replace(/\.mp4$/, "")}.timeline.json`, `${JSON.stringify({ fps: FPS, total, scenes: tl.scenes }, null, 2)}\n`);
console.log(`wrote ${out} (${frames} frames, ${total.toFixed(1)} s)`);
