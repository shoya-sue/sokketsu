// デモ動画（#64）用：撮影した release の取引を Solana Explorer で開き、残高の変化とプログラム（命令）の一覧までゆっくりスクロールして撮る。
// 使い方: node capture/explorer.mjs（run.json の最後の取引を開く）→ capture/out/explorer.webm（60fps）
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startScreencast } from "./screencast.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
const run = JSON.parse(readFileSync(path.join(out, "run.json"), "utf8"));
const url = run.timeline.filter((e) => e.tx).at(-1).tx;
const WIDTH = 1920;
const HEIGHT = 1080;
const SCALE = 1.5;

const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: WIDTH / SCALE, height: HEIGHT / SCALE },
  deviceScaleFactor: SCALE,
  locale: "en-US",
  colorScheme: "dark",
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "domcontentloaded" });
// 取引の中身（成否・残高・命令）が描かれるまで待ってから撮り始める
await page.getByText("Accounts & SOL balance", { exact: false }).first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(1500);

const screencast = await startScreencast(context, page, { width: WIDTH, height: HEIGHT });
const t0 = Date.now();
await page.waitForTimeout(4000); // 先頭（Status・Confirmation・Signature）を見せる
// 残高の変化（Accounts & SOL balance）→ 命令（Programs：Ed25519 → sokketsu）まで、なめらかにスクロールする
// Explorer の見出しは 2026-10 時点で Summary / Accounts & SOL balance / Programs / Logs
const targets = ["Accounts & SOL balance", "Programs"];
for (const text of targets) {
  const y = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("h1, h2, h3, h4, h5, .card-header-title, .card-header")].find((e) => e.textContent.includes(t));
    return el ? el.getBoundingClientRect().top + window.scrollY - 40 : null;
  }, text);
  if (y === null) continue;
  await page.evaluate(async (to) => {
    const from = window.scrollY;
    const ms = Math.min(4500, Math.max(2000, Math.abs(to - from) * 3));
    const start = performance.now();
    await new Promise((resolve) => {
      const step = (now) => {
        const k = Math.min(1, (now - start) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        window.scrollTo(0, from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }, y);
  await page.waitForTimeout(5500); // ナレーション（約 18 秒）と長さを揃える
}
const shot = await screencast.stop(path.join(out, "explorer.webm"), t0);
console.log(`explorer: ${url}`);
console.log(`screencast: ${shot.frames} frames over ${shot.span.toFixed(1)} s (${(shot.frames / shot.span).toFixed(1)} fps)`);
await context.close();
await browser.close();
