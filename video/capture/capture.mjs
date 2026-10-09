// 本番の画面を実際に操作して撮る（発表動画 #21 の実演の素材）。
// お試し（faucet から devnet SOL）→ デモ（hold → release）を 1 回流し、画面（webm）と音（webm/opus）と、
// 画面に出た数値・取引 ID（run.json）を書き出す。動画に出す数値はすべてここで撮った本番の値を使う。
// 使い方: node capture/capture.mjs [--url https://sokketsu.pages.dev] [--keypair <devnet 鍵の JSON>]
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values: opt } = parseArgs({
  options: {
    url: { type: "string", default: "https://sokketsu.pages.dev" },
    // faucet は IP ごとに 10 分 1 回。続けて撮り直すときは devnet 鍵を貼って始める
    keypair: { type: "string" },
    // デモトークン（1 行のファイル）。⚙ から入れると Jev が判断する（入れないとサーバー側のモックの判断）
    "token-file": { type: "string" },
    // 動画で文字が読めるよう、ページを拡大して撮る（1920×1080 の画面に 1280×720 相当のレイアウト）
    zoom: { type: "string", default: "1.5" },
  },
});

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
const WIDTH = 1920;
const HEIGHT = 1080;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
  locale: "ja-JP",
  recordVideo: { dir: out, size: { width: WIDTH, height: HEIGHT } },
});
const page = await context.newPage();
const t0 = Date.now();
const elapsed = () => (Date.now() - t0) / 1000;
await page.addInitScript({ path: path.join(here, "audio-hook.js") });
await page.addInitScript((zoom) => {
  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.style.zoom = zoom;
  });
}, opt.zoom);

const marks = [];
let audioStartedAt = null;

await page.goto(opt.url, { waitUntil: "domcontentloaded" });
await page.locator(".shell").waitFor();
await page.waitForTimeout(3000); // 待機中の動き（背景・REPLAY）を少し撮る
marks.push({ label: "start", at: elapsed() });

if (opt.keypair) {
  await page.locator("details.paste-key summary").click();
  await page.locator("details.paste-key input").fill(readFileSync(opt.keypair, "utf8").trim());
} else {
  await page.locator(".trial-btn").click();
}
await page.locator("button.play:not([disabled])").waitFor({ timeout: 90_000 });
if (opt["token-file"]) {
  // ⚙ を開いてデモトークンを入れ、閉じる（撮影の前に済ませる）
  const gear = page.locator(".top-right button[aria-expanded]");
  await gear.click();
  await page.locator(".settings input[type=password]").fill(readFileSync(opt["token-file"], "utf8").trim());
  await gear.click();
}
marks.push({ label: "ready", at: elapsed() });
await page.waitForTimeout(1500);
await page.locator("button.play").click();

// 段階の切り替わりと、確定の瞬間の数値を拾う
let finality = null;
let last = null;
const deadline = elapsed() + 150;
while (elapsed() < deadline) {
  const state = await page.evaluate(() => ({
    phase: document.querySelector(".play-count") ? "countdown" : document.querySelector(".shell")?.getAttribute("data-phase"),
    playing: document.querySelector("button.play")?.hasAttribute("disabled") ?? false,
  }));
  if (state.phase !== last) {
    marks.push({ label: state.phase, at: elapsed() });
    last = state.phase;
    if (state.phase === "released") {
      await page.waitForTimeout(900); // 中央の数字の回転が止まってから読む
      finality = await page.evaluate(() => ({
        hitMs: document.querySelector(".finality-hit .hit-ms")?.textContent ?? null,
        vaultMs: document.querySelector(".vault-ms")?.textContent ?? null,
        decision: document.querySelector(".flow-result span")?.textContent ?? null,
        source: document.querySelector(".source")?.textContent ?? null,
        slot: document.querySelector(".slot-now")?.textContent ?? null,
        grade: document.querySelector(".finality-hit .hit-grade")?.textContent ?? null,
        near: document.querySelector(".finality-hit .hit-near")?.textContent ?? null,
      }));
    }
  }
  if (state.phase === "error") break;
  if (state.phase === "released" && !state.playing) break;
  await page.waitForTimeout(50);
}
await page.waitForTimeout(4000); // 確定の余韻
marks.push({ label: "end", at: elapsed() });

const timeline = await page.evaluate(() =>
  [...document.querySelectorAll(".timeline .tl")].map((li) => ({
    label: li.querySelector(".tl-label")?.textContent ?? "",
    detail: li.querySelector(".tl-detail")?.textContent ?? null,
    ms: li.querySelector(".tl-ms")?.textContent ?? null,
    tx: li.querySelector("a.tl-link")?.getAttribute("href") ?? null,
  })),
);
const result = await page.evaluate(() => ({
  finalizedMs: Number(document.querySelector(".result-win .race-value")?.textContent?.replace(/[^\d.]/g, "") ?? NaN),
  speedup: document.querySelector(".speedup strong")?.textContent ?? null,
  breakdown: [...document.querySelectorAll(".measure-log li")].map((li) => li.textContent?.trim()),
}));
const b64 = await page.evaluate(() => window.__stopAudio?.());
// 録音を始めた時刻（エポックミリ秒）。__audioStartedAt はページ内の performance.now()
audioStartedAt = await page.evaluate(() =>
  window.__audioStartedAt == null ? null : performance.timeOrigin + window.__audioStartedAt,
);
await context.close();
renameSync(await page.video().path(), path.join(out, "screen.webm"));
await browser.close();
if (b64) writeFileSync(path.join(out, "audio.webm"), Buffer.from(b64, "base64"));

const run = {
  url: opt.url,
  capturedAt: new Date(t0).toISOString(),
  entry: opt.keypair ? "pasted-devnet-key" : "trial",
  judge: opt["token-file"] ? "jev (demo token)" : "mock",
  // 音の録音が始まった時刻（画面の録画の先頭からの秒）。動画で音を合わせるのに使う
  audioOffsetS: audioStartedAt ? (audioStartedAt - t0) / 1000 : null,
  marks,
  finality,
  result,
  timeline,
};
writeFileSync(path.join(out, "run.json"), JSON.stringify(run, null, 2));
console.log(JSON.stringify({ marks, finality, result, txs: timeline.map((e) => e.tx).filter(Boolean) }, null, 2));
if (!finality || !Number.isFinite(result.finalizedMs)) {
  console.error("確定まで撮れなかった（release の確定ミリ秒が無い）");
  process.exit(1);
}
