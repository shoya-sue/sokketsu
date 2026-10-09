import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion";
import { RAIN_COL_PX, rainGlyphs, seedDrops, stepDrops, type Drop } from "../lib/overdrive";

type Props = {
  /** 雨に混ぜる slot 番号。新しい slot が届くと、その数字が降り始める。 */
  slot: number | null;
  /** 色調の 2 色（RGB の数字）。先頭の文字が 1 色目、尾が 2 色目になる。 */
  tone: readonly [string, string];
};

const MAX_DPR = 2;
const FONT_PX = 14;
const REGLYPH_MS = 900;
/** 描くのは 30 コマ/秒まで（GPU の無い環境で重くしない）。 */
const DRAW_MS = 1000 / 30;
/** 広い画面では中央（カードの裏）を描かず、左右の余白の列だけにする。 */
const SIDE_ONLY_MIN_W = 760;
const SIDE_RATIO = 0.22;

/**
 * slot 番号と base58 の断片が縦に降り続けるデータの雨（#56）。先頭の文字ほど明るく、尾は色調の 2 色目で薄れる。
 * reduced-motion では止まった 1 コマだけを描く。
 */
export function DataRain({ slot, tone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotRef = useRef(slot);
  const toneRef = useRef(tone);
  useEffect(() => {
    slotRef.current = slot;
  }, [slot]);
  useEffect(() => {
    toneRef.current = tone;
  }, [tone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = prefersReducedMotion();
    let w = 0;
    let h = 0;
    let drops: Drop[] = [];
    let glyphs: string[][] = [];
    let glyphsAt = -Infinity;

    const reglyph = () => {
      glyphs = drops.map((d) => rainGlyphs(slotRef.current, d.len, Math.random));
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const all = seedDrops(w, h, Math.random);
      drops = w >= SIDE_ONLY_MIN_W ? all.filter((d) => d.x < w * SIDE_RATIO || d.x > w * (1 - SIDE_RATIO)) : all;
      reglyph();
    };

    const draw = (now: number) => {
      if (now - glyphsAt > REGLYPH_MS) {
        reglyph();
        glyphsAt = now;
      }
      const [head, tail] = toneRef.current;
      ctx.clearRect(0, 0, w, h);
      ctx.font = `${FONT_PX}px "Share Tech Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      drops.forEach((d, i) => {
        const col = glyphs[i] ?? [];
        col.forEach((c, j) => {
          const y = d.y - j * RAIN_COL_PX;
          if (y < -RAIN_COL_PX || y > h + RAIN_COL_PX) return;
          const fade = 1 - j / col.length;
          ctx.fillStyle = j === 0 ? `rgba(255, 255, 255, 0.85)` : `rgba(${j < 3 ? head : tail}, ${0.55 * fade})`;
          ctx.fillText(c, d.x, y);
        });
      });
    };

    resize();
    window.addEventListener("resize", resize);
    if (reduced) {
      draw(performance.now());
      return () => window.removeEventListener("resize", resize);
    }

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < DRAW_MS) return;
      // タブが裏にあった後などで大きく飛ばないよう、1 コマの進みは 50 ms までにする。
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      drops = stepDrops(drops, dt, h);
      draw(now);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="od-rain" aria-hidden="true" />;
}
