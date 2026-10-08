// 画面の「動きの量」を測る。Playwright で実時間の録画を撮り、ffmpeg で 20fps にそろえてコマ間の差分面積を出す。
// 使い方は README.md。既定は待機中だけ測るモード（SOL を使わない）。
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { aroundMarks, summarize, bySegment, formatTable } from "./stats.mjs";

const { values: opt } = parseArgs({
  options: {
    url: { type: "string", default: "https://sokketsu.pages.dev" },
    mode: { type: "string", default: "idle" }, // idle | play
    seconds: { type: "string", default: "10" }, // idle のときの録画時間
    viewport: { type: "string", default: "1280x900" },
    "reduced-motion": { type: "boolean", default: false },
    out: { type: "string", default: "tools/motion/out" },
    json: { type: "boolean", default: false },
    // ローカルの vite（Functions なし）を測るとき、/api/* をこの origin へ転送する（例 https://sokketsu.pages.dev）。
    api: { type: "string" },
    // play で、お試し（faucet）の代わりに手元の devnet 鍵（solana-keygen の JSON）を貼って始める。faucet は IP ごとに 10 分 1 回。
    keypair: { type: "string" },
  },
});

const FPS = 20;
const [width, height] = opt.viewport.split("x").map(Number);
const seconds = Number(opt.seconds);
if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
  throw new Error(`--viewport は 幅x高さ（例 1280x900）: ${opt.viewport}`);
}
if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`--seconds は正の数: ${opt.seconds}`);
if (opt.mode !== "idle" && opt.mode !== "play") throw new Error(`--mode は idle か play: ${opt.mode}`);
const outDir = path.resolve(opt.out, `${opt.mode}-${opt.viewport}${opt["reduced-motion"] ? "-reduced" : ""}`);
// 前の回の録画や画像を集計に混ぜないよう、毎回空にしてから撮る。
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  reducedMotion: opt["reduced-motion"] ? "reduce" : "no-preference",
  recordVideo: { dir: outDir, size: { width, height } },
});
const page = await context.newPage();
const t0 = Date.now();
// 取引の送信（JSON-RPC の sendTransaction）を数える。待機中の再生（#30）で 0 件であることを確かめる。
let sentTransactions = 0;
page.on("request", (req) => {
  if (req.method() === "POST" && (req.postData() ?? "").includes('"sendTransaction"')) sentTransactions += 1;
});
const elapsed = () => (Date.now() - t0) / 1000;

// 確定の瞬間にスクロールなしで見えているべき要素（#31・#32）。true = 画面内に収まっている、null = 無い。
const VISIBLE_AT_FINALITY = [".stage", ".judge-flow", ".vault-ms", ".finality-hit .hit-ms"];
let visibility = null;

// 段階の切り替わりを記録する（アプリが .shell に data-phase を出している）。
const marks = [{ label: "load", at: 0 }];
const watchPhase = async (until) => {
  let last = null;
  // 確定から 3 秒（#31 の判定区間）の後ろを afterglow として切る。
  let afterglowAt = Infinity;
  while (elapsed() < until) {
    if (elapsed() >= afterglowAt) {
      marks.push({ label: "afterglow", at: afterglowAt });
      afterglowAt = Infinity;
    }
    // 次の依頼までのカウントダウンは段階ではないので、表示の有無で区間にする。
    const phase = await page
      .evaluate(() =>
        document.querySelector(".play-count") ? "countdown" : document.querySelector(".shell")?.getAttribute("data-phase"),
      )
      .catch(() => null);
    if (phase && phase !== last) {
      marks.push({ label: phase, at: elapsed() });
      last = phase;
      if (phase === "released" || phase === "refunded") {
        await page.screenshot({ path: path.join(outDir, `${phase}.png`) });
        visibility = await page.evaluate((selectors) => {
          const inView = (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
          };
          return Object.fromEntries(
            selectors.map((sel) => {
              const el = document.querySelector(sel);
              return [sel, el ? inView(el) : null];
            }),
          );
        }, VISIBLE_AT_FINALITY);
        afterglowAt = elapsed() + 3;
      }
    }
    if (marks.some((m) => m.label === "done")) return;
    await page.waitForTimeout(50);
  }
};

if (opt.api) {
  await page.route(/\/api\//, async (route) => {
    const { pathname, search } = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: `${opt.api}${pathname}${search}` }) });
  });
}

await page.goto(opt.url, { waitUntil: "domcontentloaded" });
await page.locator(".shell").waitFor();

if (opt.mode === "idle") {
  // 読み込み直後の描画が落ち着くまで 2 秒待ち、そこからを待機中として測る。
  await page.waitForTimeout(2000);
  marks.push({ label: "idle", at: elapsed() });
  await page.waitForTimeout(seconds * 1000);
  marks.push({ label: "end", at: elapsed() });
} else if (opt.mode === "play") {
  // お試し（faucet から 0.12 SOL）→ デモ（hold → release）を流す。devnet の SOL を使う。
  if (opt.keypair) {
    await page.locator("details.paste-key summary").click();
    await page.locator("details.paste-key input").fill(readFileSync(opt.keypair, "utf8").trim());
  } else {
    await page.locator(".trial-btn").click();
  }
  const started = await page
    .locator("button.play:not([disabled])")
    .waitFor({ timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  if (!started) {
    const reason = await page.locator(".error").first().textContent().catch(() => null);
    throw new Error(`再生ボタンが押せる状態にならなかった: ${reason ?? "理由の表示なし"}`);
  }
  marks.push({ label: "ready", at: elapsed() });
  await page.locator("button.play").click();
  const deadline = elapsed() + 120;
  const watcher = watchPhase(deadline);
  // 最後の release が終わる（released か error）まで待ち、余韻を 4 秒撮る。
  await page
    .waitForFunction(() => {
      const p = document.querySelector(".shell")?.getAttribute("data-phase");
      const playing = document.querySelector("button.play")?.hasAttribute("disabled");
      return p === "error" || (p === "released" && !playing);
    }, null, { timeout: 120_000 })
    .catch(() => undefined);
  await page.waitForTimeout(4000);
  marks.push({ label: "done", at: elapsed() });
  await watcher;
  marks.push({ label: "end", at: elapsed() });
} else {
  throw new Error(`unknown mode: ${opt.mode}`);
}

await page.screenshot({ path: path.join(outDir, "last.png") });
await context.close();
await browser.close();

const video = path.join(outDir, "recording.webm");
renameSync(await page.video().path(), video);

const frames = await diffFrames(video);
const result = {
  url: opt.url,
  mode: opt.mode,
  viewport: opt.viewport,
  reducedMotion: opt["reduced-motion"],
  measuredAt: new Date().toISOString(),
  marks,
  sentTransactions,
  visibility,
  overall: summarize(frames.filter((f) => f.t >= (marks.find((m) => m.label === (opt.mode === "idle" ? "idle" : "ready"))?.at ?? 0))),
  segments: bySegment(frames, marks),
  transitions: opt.mode === "play" ? aroundMarks(frames, marks) : [],
};
writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
console.log(opt.json ? JSON.stringify(result, null, 2) : formatTable(result));

/** 録画を 20fps・幅 640 の白黒にそろえ、前のコマとの差（輝度差 10 超）が占める面積の割合をコマごとに返す。 */
function diffFrames(file) {
  const filter = [
    `fps=${FPS}`,
    "scale=640:-2",
    "format=gray",
    "tblend=all_mode=difference",
    "lut=y='if(gt(val,10),255,0)'",
    "signalstats",
    "metadata=print:key=lavfi.signalstats.YAVG:file=-",
  ].join(",");
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-v", "error", "-i", file, "-vf", filter, "-f", "null", "-"]);
    let text = "";
    ff.stdout.on("data", (d) => (text += d));
    ff.stderr.on("data", (d) => process.stderr.write(d));
    ff.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}`));
      const out = [];
      let t = 0;
      for (const line of text.split("\n")) {
        const time = line.match(/pts_time:([\d.]+)/);
        if (time) t = Number(time[1]);
        const yavg = line.match(/YAVG=([\d.]+)/);
        if (yavg) out.push({ t, pct: (Number(yavg[1]) / 255) * 100 });
      }
      resolve(out);
    });
  });
}
