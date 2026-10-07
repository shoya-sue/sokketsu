// 時刻から決まるページを 1 コマずつ撮り、ffmpeg で MP4 にする。
// 使い方: node render.mjs [出力ファイル]（既定 hook-playwright.mp4）
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const FPS = 30;
const DURATION_S = 10;
const WIDTH = 1280;
const HEIGHT = 720;
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.join(here, "hook-playwright.mp4");

const ffmpeg = spawn(
  "ffmpeg",
  ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "medium",
    // 書き出しを決定的にする（エンコーダのスレッド数と、ファイルに埋め込まれる情報を固定）
    "-threads", "1", "-x264-params", "threads=1:sliced-threads=0", "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact",
    out],
  { stdio: ["pipe", "inherit", "inherit"] },
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await page.goto(`file://${path.join(here, "index.html")}`);
await page.evaluate(() => document.fonts.ready);

const total = FPS * DURATION_S;
for (let frame = 0; frame < total; frame++) {
  await page.evaluate((t) => window.renderAt(t), frame / FPS);
  const png = await page.locator("#stage").screenshot({ type: "png", animations: "disabled" });
  if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
}
await browser.close();
ffmpeg.stdin.end();
await new Promise((resolve, reject) => ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)))));
console.log(`wrote ${out} (${total} frames)`);
