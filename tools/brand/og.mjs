// OGP 画像（1200×630）を og.html から書き出す（#47）。使い方: node tools/brand/og.mjs
// playwright-core は tools/motion の依存を使う。
import { chromium } from "../motion/node_modules/playwright-core/index.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "..", "app", "public", "og.png");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`file://${path.join(here, "og.html")}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.locator("#og").screenshot({ path: out });
await browser.close();
console.log(`wrote ${out}`);
