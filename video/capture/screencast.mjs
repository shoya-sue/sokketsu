// ページの画面を CDP の screencast でコマごとに受け取り、受け取った時刻どおりに並べた 60fps の動画にする。
// Playwright の recordVideo は 25fps が上限で、GPU の無い headless では実質 10fps 前後まで落ちる（2026-10-11 実測）。
// screencast は描画されるたびにコマを送るので、headless（新しいモード）でも実質 60fps 近く出る。
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SCREEN_FPS = 60;

/**
 * 撮り始める。stop() で止め、t0（エポックミリ秒）を動画の 0 秒として file に書き出す。
 * @param {import("playwright-core").BrowserContext} context
 * @param {import("playwright-core").Page} page
 */
export async function startScreencast(context, page, { width, height }) {
  const cdp = await context.newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", (f) => {
    frames.push({ data: f.data, ts: f.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1, maxWidth: width, maxHeight: height });

  return {
    /** @param {string} file 出力（.webm）@param {number} t0 動画の 0 秒にあたる時刻（エポックミリ秒） */
    async stop(file, t0) {
      await cdp.send("Page.stopScreencast").catch(() => {});
      if (frames.length === 0) throw new Error("screencast: no frames");
      const dir = `${file}.frames`;
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      // 各コマを「次のコマまで」表示する。最初のコマは 0 秒から出す
      const list = [];
      frames.forEach((f, i) => {
        const name = `f${String(i).padStart(6, "0")}.jpg`;
        writeFileSync(path.join(dir, name), Buffer.from(f.data, "base64"));
        const from = i === 0 ? t0 / 1000 : f.ts;
        const next = frames[i + 1]?.ts ?? f.ts + 1 / SCREEN_FPS;
        list.push(`file '${name}'`, `duration ${Math.max(0, next - from).toFixed(6)}`);
      });
      writeFileSync(path.join(dir, "list.txt"), `${list.join("\n")}\n`);
      await new Promise((resolve, reject) => {
        const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"),
          "-vf", `fps=${SCREEN_FPS},format=yuv420p`, "-c:v", "libvpx-vp9", "-crf", "24", "-b:v", "0",
          "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", file], { stdio: "inherit" });
        ff.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg screencast ${c}`))));
      });
      rmSync(dir, { recursive: true, force: true });
      return { frames: frames.length, span: frames.at(-1).ts - frames[0].ts };
    },
  };
}
