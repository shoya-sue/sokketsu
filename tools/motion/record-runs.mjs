// デモを続けて流し、画面（Playwright の録画）と音（WebAudio を MediaRecorder で）を 1 本の MP4 に録る（#35・#43）。
// 回ごとに、確定の重ね表示（ミリ秒・ランク・格・惜しさ・大当たり）と HUD のコンボ・炎を記録する。
// 使い方: node record-runs.mjs --keypair <devnet 鍵の JSON> [--url https://sokketsu.pages.dev] [--runs 3] [--out out/runs]
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values: opt } = parseArgs({
  options: {
    url: { type: "string", default: "https://sokketsu.pages.dev" },
    keypair: { type: "string" },
    runs: { type: "string", default: "3" },
    out: { type: "string", default: "out/runs" },
  },
});
if (!opt.keypair) throw new Error("--keypair（devnet 鍵の JSON）が要る。続けて流すので faucet では足りない");
const runs = Number(opt.runs);
if (!Number.isInteger(runs) || runs <= 0) throw new Error(`--runs は正の整数: ${opt.runs}`);

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(opt.out);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: out, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();
// 初回の案内ポップアップ（#53）は閉じた状態で測る（見終わった印を先に入れる）。
await page.addInitScript(() => localStorage.setItem("sokketsu.onboarded.v1", "1"));
await page.addInitScript({ path: path.join(here, "..", "..", "video", "capture", "audio-hook.js") });
await page.goto(opt.url);
await page.locator("details.paste-key summary").click();
await page.locator("details.paste-key input").fill(readFileSync(opt.keypair, "utf8").trim());
await page.locator("button.play:not([disabled])").waitFor({ timeout: 60_000 });

const log = [];
for (let i = 1; i <= runs; i++) {
  await page.locator("button.play").click();
  await page.locator(".finality-hit").waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1300); // 回転が止まり、ランク・惜しさ・大当たりの帯が出てから
  const hit = await page.evaluate(() => {
    const el = document.querySelector(".finality-hit");
    return {
      className: el?.className.trim(),
      ms: el?.querySelector(".hit-ms")?.textContent ?? null,
      grade: el?.querySelector(".hit-grade")?.textContent ?? null,
      near: el?.querySelector(".hit-near")?.textContent ?? null,
      jackpot: el?.querySelector(".hit-jackpot")?.textContent ?? null,
    };
  });
  await page.screenshot({ path: path.join(out, `run${i}.png`) });
  await page.locator("button.play:not([disabled])").waitFor({ timeout: 120_000 });
  const hud = await page.evaluate(() => ({
    combo: document.querySelector(".hud-combo-num")?.textContent ?? null,
    fire: document.querySelector(".hud-fire")?.textContent ?? null,
    tx: [...document.querySelectorAll(".timeline a.tl-link")].at(-1)?.getAttribute("href") ?? null,
  }));
  log.push({ run: i, ...hit, ...hud });
  await page.waitForTimeout(1500);
}

const b64 = await page.evaluate(() => window.__stopAudio?.());
await context.close();
const screen = path.join(out, "screen.webm");
renameSync(await page.video().path(), screen);
await browser.close();
writeFileSync(path.join(out, "runs.json"), JSON.stringify({ url: opt.url, recordedAt: new Date().toISOString(), runs: log }, null, 2));

if (b64) {
  const audio = path.join(out, "audio.webm");
  writeFileSync(audio, Buffer.from(b64, "base64"));
  await new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-v", "error", "-y", "-i", screen, "-i", audio, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-c:a", "aac", "-shortest", path.join(out, "runs.mp4")], { stdio: "inherit" });
    ff.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}`))));
  });
}
console.log(JSON.stringify(log, null, 1));
