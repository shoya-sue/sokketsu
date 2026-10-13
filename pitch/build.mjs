// 提出資料を書き出す（Colosseum の提出項目に合わせる。#64）。
//   pdf   … slides.html?deck=pitch を 16:9 の PDF に（sokketsu-deck.pdf）
//   logo  … app/public/logo-mark.svg を 1024×1024 の PNG に（assets/logo-1024.png）
//   tech  … slides.html?deck=tech の各ページ + 英語ナレーション + ピッチ動画の実演の場面 → 技術デモ動画（sokketsu-tech-demo.mp4）
// 使い方: node pitch/build.mjs [pdf] [logo] [tech]（指定なしで全部）。Playwright は video/ の依存を使う（先に cd video && npm install）。
import { chromium } from "../video/node_modules/playwright-core/index.mjs";
import { execFileSync, spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const want = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ["pdf", "logo", "graphics", "thumbs", "tech"]);
const FPS = 60;
const TECH_MAX_S = 180; // 技術デモ動画の上限（Colosseum：3 分以内）

// slides.html は ../video と ../app を読むので、リポジトリの直下を http で配る
const TYPES = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png" };
const server = createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function openDeck(deck) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}/pitch/slides.html?deck=${deck}&print`);
  await page.waitForFunction(() => document.body.dataset.ready === "1");
  return page;
}

if (want.has("pdf")) {
  const page = await openDeck("pitch");
  const file = path.join(here, "sokketsu-deck.pdf");
  await page.pdf({ path: file, width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true });
  const pages = await page.evaluate(() => [...document.querySelectorAll(".slide")].filter((s) => !s.hidden).length);
  console.log(`wrote ${file} (${pages} slides)`);
  await page.close();
}

if (want.has("logo")) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
  const file = path.join(here, "assets", "logo-1024.png");
  const svg = readFileSync(path.join(root, "app", "public", "logo-mark.svg"), "utf8");
  await page.setContent(`<body style="margin:0;background:transparent"><div style="width:1024px;height:1024px">${svg}</div></body>`);
  await page.evaluate(() => {
    const el = document.querySelector("svg");
    el.setAttribute("width", "1024");
    el.setAttribute("height", "1024");
  });
  await page.locator("div").screenshot({ path: file, omitBackground: true });
  console.log(`wrote ${file}`);
  await page.close();
}

if (want.has("graphics")) {
  // 提出用の画像：英語の OGP（tools/brand/og.html の文言だけ英語にする。サイトの og.png は日本語のまま）と、スライドの表紙
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await og.goto(`${base}/tools/brand/og.html`, { waitUntil: "networkidle" });
  await og.evaluate(() => {
    document.documentElement.lang = "en";
    document.querySelector(".tag").textContent = "Stop agent payments with typed decisions.";
    document.querySelector(".num span").textContent = "finality on Alpenglow";
  });
  await og.evaluate(() => document.fonts.ready);
  const ogFile = path.join(here, "assets", "og-en-1200x630.png");
  await og.locator("#og").screenshot({ path: ogFile });
  console.log(`wrote ${ogFile}`);
  await og.close();

  const cover = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await cover.goto(`${base}/pitch/slides.html?deck=pitch#1`);
  await cover.waitForFunction(() => document.body.dataset.ready === "1");
  const coverFile = path.join(here, "assets", "cover-1920x1080.png");
  await cover.screenshot({ path: coverFile });
  console.log(`wrote ${coverFile}`);
  await cover.close();
}

if (want.has("thumbs")) {
  // YouTube のサムネイル（1280×720・2 MB 以下の JPEG）
  for (const v of ["pitch", "tech"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    await page.goto(`${base}/pitch/thumbnails.html?v=${v}`);
    await page.waitForFunction(() => document.body.dataset.ready === "1");
    const file = path.join(here, "assets", `youtube-thumb-${v}.jpg`);
    await page.locator(`#${v}`).screenshot({ path: file, type: "jpeg", quality: 90 });
    const size = statSync(file).size;
    console.log(`wrote ${file} (${(size / 1024).toFixed(0)} KB)`);
    if (size > 2 * 1024 * 1024) throw new Error(`${file} is over 2 MB`);
    await page.close();
  }
}

if (want.has("demo")) {
  // Colosseum の「デモ動画」：実際のプロダクトだけを見せる（スライド・コードの説明は不可・3 分以内）。
  // ピッチ動画の実演の場面（本番の画面）+ 同じ release の取引を Solana Explorer で見せる場面（video/capture/explorer.mjs で撮影）
  const timeline = JSON.parse(readFileSync(path.join(root, "video", "sokketsu-pitch.timeline.json"), "utf8"));
  const run = JSON.parse(readFileSync(path.join(root, "video", "capture", "out", "run.json"), "utf8"));
  const live = timeline.scenes.find((s) => s.name === "demo");
  const explorer = path.join(root, "video", "capture", "out", "explorer.webm");
  const ms = Math.round(run.result.finalizedMs);
  const text =
    `And here is that release on Solana Explorer. Success, finalized in ${ms} milliseconds from send. ` +
    "The payee received zero point zero five SOL, and the Ed25519 signature check runs right before our program. " +
    "Try it yourself at sokketsu dot pages dot dev.";
  const work = mkdtempSync(path.join(os.tmpdir(), "sokketsu-demo-"));
  const ff = (args) => {
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`ffmpeg ${r.status}`);
  };
  const durationOf = (file) =>
    Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
  const ENC = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-r", "60", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"];
  const part1 = path.join(work, "1-live.mp4");
  ff(["-ss", live.start.toFixed(3), "-t", live.length.toFixed(3), "-i", path.join(root, "video", "sokketsu-pitch.mp4"), ...ENC, part1]);
  const aiff = path.join(work, "explorer.aiff");
  execFileSync("say", ["-v", process.env.VOICE ?? "Samantha", "-r", process.env.VOICE_RATE ?? "182", "-o", aiff, text]);
  const lead = 0.4;
  const len = Math.max(durationOf(explorer), lead + durationOf(aiff) + 1.2);
  const part2 = path.join(work, "2-explorer.mp4");
  const pad = Math.max(0, len - durationOf(explorer));
  const leadMs = Math.round(lead * 1000);
  ff(["-i", explorer, "-i", aiff, "-filter_complex",
    `[0:v]tpad=stop_mode=clone:stop_duration=${pad.toFixed(3)},fade=t=out:st=${(len - 0.5).toFixed(3)}:d=0.5[v];` +
    `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${leadMs}|${leadMs},apad,atrim=end=${len.toFixed(3)}[a]`,
    "-map", "[v]", "-map", "[a]", ...ENC, "-t", len.toFixed(3), part2]);
  const list = path.join(work, "list.txt");
  writeFileSync(list, `file '${part1}'\nfile '${part2}'\n`);
  const out = path.join(here, "sokketsu-demo.mp4");
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
  rmSync(work, { recursive: true, force: true });
  const total = durationOf(out);
  console.log(`wrote ${out} (${total.toFixed(1)} s: live ${live.length.toFixed(1)} + explorer ${len.toFixed(1)})`);
  if (total > 180) throw new Error("demo video is over 3 minutes");
}

if (want.has("short")) {
  // YouTube ショート（縦 1080×1920・60 秒以内）：short.html の枠の中央にデモ動画（sokketsu-demo.mp4）を重ねる
  const demo = path.join(here, "sokketsu-demo.mp4");
  if (!existsSync(demo)) throw new Error("先に node pitch/build.mjs demo");
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(`${base}/pitch/short.html`);
  await page.waitForFunction(() => document.body.dataset.ready === "1");
  const work = mkdtempSync(path.join(os.tmpdir(), "sokketsu-short-"));
  const frame = path.join(work, "frame.png");
  await page.locator("#frame").screenshot({ path: frame });
  await page.close();
  const out = path.join(here, "sokketsu-short.mp4");
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-framerate", "60", "-i", frame, "-i", demo,
    "-filter_complex", "[1:v]scale=1080:608:flags=lanczos[v];[0:v][v]overlay=0:656:shortest=1,format=yuv420p[out]",
    "-map", "[out]", "-map", "1:a", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-r", "60",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", out], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg ${r.status}`);
  rmSync(work, { recursive: true, force: true });
  const total = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).toString());
  console.log(`wrote ${out} (${total.toFixed(1)} s, 1080x1920)`);
  if (total > 60) throw new Error("short is over 60 s");
}

if (want.has("tech")) {
  const run = JSON.parse(readFileSync(path.join(root, "video", "capture", "out", "run.json"), "utf8"));
  const timeline = JSON.parse(readFileSync(path.join(root, "video", "sokketsu-pitch.timeline.json"), "utf8"));
  const demo = timeline.scenes.find((s) => s.name === "demo");
  const ms = Math.round(run.result.finalizedMs);
  // ページごとのナレーション（数値は撮影データから）。実演の場面はピッチ動画から切り出し、その音声（ナレーション込み）をそのまま使う
  const NARRATION = {
    cover: "This is the technical demo of Sokketsu, an escrow on Solana that releases funds only on a typed, signed decision.",
    arch:
      "The browser holds two keys. The wallet signs only the deposit, and an in-page operator key sends the settlement. " +
      "Cloudflare Pages Functions call Jev, a typed judge, or a mock fallback, and our oracle signs the result with ed25519. " +
      "Everything settles in an Anchor program on devnet.",
    program:
      "The program has four instructions. Deposit locks SOL in an escrow PDA, with a deadline and a hash of the request. " +
      "Settle pays the payee only when a signed decision says release, with at least seven thousand basis points. " +
      "Refund returns the funds after a signed refund or after the deadline, and close returns the rent.",
    sig:
      "The oracle signs an eighty-eight byte message: a version prefix, the escrow address, the request hash, the decision, the probability, and the source. " +
      "Settle reads the instruction right before it, and checks that it is the ed25519 program, that the key is our oracle, and that the message matches this escrow. " +
      "Otherwise it fails with bad oracle signature. Here it is, running live on devnet.",
    trust:
      "The program also decides who can settle. A decision from Jev can be submitted by anyone, so the payer cannot block a valid release. " +
      "A mock decision is accepted only from the payer or its operator key. Refunds and closes always send the funds back to the payer.",
    measured:
      `Finality is measured in the browser with a WebSocket signature subscription. In this run the release reached finalized in ${ms} milliseconds, ` +
      `about ${run.result.speedup} times faster than Tower BFT.`,
    quality:
      "The program has fourteen anchor tests, covering signatures, re-use, source tampering and submitter rules. The app and API have five hundred fifty four vee-test tests.",
    thanks: "Sokketsu is open source, and live on devnet at sokketsu dot pages dot dev. Thank you.",
  };
  const ORDER = ["cover", "arch", "program", "sig", "demo", "trust", "measured", "quality", "thanks"];
  const VOICE = process.env.VOICE ?? "Samantha";
  const RATE = process.env.VOICE_RATE ?? "182";
  const LEAD = 0.4; // ページが出てから話し始めるまで
  const TAIL = 0.9; // 話し終えてから次のページまで

  const work = mkdtempSync(path.join(os.tmpdir(), "sokketsu-tech-"));
  const page = await openDeck("tech");
  const keys = await page.evaluate(() =>
    [...document.querySelectorAll(".slide")]
      .filter((s) => !s.hidden)
      .map((s) => (s.classList.contains("cover") && !s.dataset.narrationKey ? "cover" : s.dataset.narrationKey)),
  );
  const slides = page.locator(".slide:not([hidden])");
  const ff = (args) => {
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`ffmpeg ${r.status}`);
  };
  const durationOf = (file) =>
    Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());
  const ENC = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-r", String(FPS), "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"];

  const parts = [];
  for (const key of ORDER) {
    const part = path.join(work, `${String(parts.length).padStart(2, "0")}-${key}.mp4`);
    if (key === "demo") {
      ff(["-ss", demo.start.toFixed(3), "-t", demo.length.toFixed(3), "-i", path.join(root, "video", "sokketsu-pitch.mp4"), ...ENC, part]);
    } else {
      const i = keys.indexOf(key);
      if (i < 0) throw new Error(`slide ${key} not found`);
      const png = path.join(work, `${key}.png`);
      await slides.nth(i).screenshot({ path: png });
      const aiff = path.join(work, `${key}.aiff`);
      execFileSync("say", ["-v", VOICE, "-r", RATE, "-o", aiff, NARRATION[key]]);
      const len = LEAD + durationOf(aiff) + TAIL;
      const ms = Math.round(LEAD * 1000);
      ff(["-loop", "1", "-framerate", String(FPS), "-t", len.toFixed(3), "-i", png, "-i", aiff,
        "-filter_complex", `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},apad,atrim=end=${len.toFixed(3)}[a]`,
        "-map", "0:v", "-map", "[a]", ...ENC, "-t", len.toFixed(3), part]);
    }
    parts.push(part);
    console.log(`${key}: ${durationOf(part).toFixed(2)} s`);
  }
  await page.close();

  const list = path.join(work, "list.txt");
  writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n") + "\n");
  const out = path.join(here, "sokketsu-tech-demo.mp4");
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out]);
  const total = durationOf(out);
  rmSync(work, { recursive: true, force: true });
  console.log(`wrote ${out} (${total.toFixed(1)} s)`);
  if (total > TECH_MAX_S) {
    console.error(`technical demo is ${total.toFixed(1)} s (> ${TECH_MAX_S} s)`);
    process.exitCode = 1;
  }
}

await browser.close();
server.close();
