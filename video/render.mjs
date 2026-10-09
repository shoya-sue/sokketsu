// 発表動画（#21）を書き出す。scenes/index.html を 1 コマずつ撮って ffmpeg で MP4 にし、撮影の音を実演の場面に重ねる。
// 使い方: node render.mjs [出力ファイル]（既定 sokketsu-pitch.mp4）。先に capture/capture.mjs で撮影しておく。
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTimeline } from "./scenes/timeline.mjs";

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? path.join(here, "sokketsu-pitch.mp4"));
const capture = path.join(here, "capture", "out");
const run = JSON.parse(readFileSync(path.join(capture, "run.json"), "utf8"));
const tl = buildTimeline(run);

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

const silent = `${out}.video.mp4`;
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
const total = await page.evaluate(([data, src]) => window.setup(data, src), [run, "/video/capture/out/screen.webm"]);
await page.evaluate(() => document.fonts.ready);

const frames = Math.round(total * FPS);
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

// 撮影の音（アプリの効果音・BGM）を実演の場面に重ねる。音の先頭は撮影の audioOffsetS 秒にあたる。
const audio = path.join(capture, "audio.webm");
const demo = tl.scenes.find((s) => s.name === "demo");
if (existsSync(audio) && run.audioOffsetS != null) {
  const lead = demo.start + (run.audioOffsetS - tl.demo.from) / tl.demo.speed; // 動画で音が始まる時刻
  const skip = Math.max(0, -lead) * tl.demo.speed; // 実演より前に始まった分は捨てる
  const delayMs = Math.round(Math.max(0, lead) * 1000);
  const tempo = tl.demo.speed === 1 ? "" : `,atempo=${Math.min(2, tl.demo.speed).toFixed(4)}`;
  const filter = `[1:a]atrim=start=${skip.toFixed(3)},asetpts=PTS-STARTPTS${tempo},adelay=${delayMs}|${delayMs},apad,atrim=end=${(demo.start + demo.length).toFixed(3)},afade=t=out:st=${(demo.start + demo.length - 0.6).toFixed(3)}:d=0.6[a]`;
  await new Promise((resolve, reject) => {
    const mux = spawn("ffmpeg", ["-v", "error", "-y", "-i", silent, "-i", audio, "-filter_complex", filter,
      "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", total.toFixed(3), out], { stdio: "inherit" });
    mux.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg mux ${c}`))));
  });
  rmSync(silent);
} else {
  rmSync(out, { force: true });
  await new Promise((resolve, reject) => {
    const mv = spawn("mv", [silent, out]);
    mv.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`mv ${c}`))));
  });
}
console.log(`wrote ${out} (${frames} frames, ${total.toFixed(1)} s)`);
