import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion";
import {
  BURST_S,
  burstSparks,
  liveWaves,
  particleCount,
  seedParticles,
  stepParticles,
  stepSparks,
  type Particle,
  type Spark,
} from "../lib/ambient";

type Props = {
  slotTimes: readonly number[];
  /** 変わるたびに、金庫から火花と強い波紋を出す（確定の瞬間 #31）。 */
  burstId?: number | null;
};

const BURST_COUNT = 260;
const BURST_WAVES_MS = [0, 140, 300];

const GRID = 44;
const COLORS = ["153, 69, 255", "20, 241, 149", "0, 209, 255"];
const MAX_DPR = 2;
const CENTER_REFRESH_MS = 500;

/** 波紋の中心。金庫（判断リング）があればその中心、なければ画面の上寄り中央。 */
function waveCenter(w: number, h: number): { x: number; y: number } {
  const el = document.querySelector(".vault");
  if (!el) return { x: w / 2, y: h * 0.4 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** グリッドを 1 枚の canvas に描いておく（波紋が通ったところだけ明るく重ねる）。 */
function gridLayer(w: number, h: number, dpr: number, alpha: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w * dpr;
  c.height = h * dpr;
  const g = c.getContext("2d");
  if (!g) return c;
  g.scale(dpr, dpr);
  g.strokeStyle = `rgba(160, 140, 255, ${alpha})`;
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0.5; x < w; x += GRID) {
    g.moveTo(x, 0);
    g.lineTo(x, h);
  }
  for (let y = 0.5; y < h; y += GRID) {
    g.moveTo(0, y);
    g.lineTo(w, y);
  }
  g.stroke();
  return c;
}

/**
 * 背景で動き続ける粒子と、slot を受け取るたびに金庫から広がる波紋（#30）。
 * 波紋が通ったところだけグリッドが明るくなる。reduced-motion では止まった 1 コマだけを描く。
 */
export function Ambient({ slotTimes, burstId = null }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotsRef = useRef(slotTimes);
  const sparksRef = useRef<Spark[]>([]);
  const burstWavesRef = useRef<number[]>([]);

  useEffect(() => {
    if (burstId === null || prefersReducedMotion()) return;
    const { x, y } = waveCenter(window.innerWidth, window.innerHeight);
    const now = performance.now();
    sparksRef.current = [...sparksRef.current, ...burstSparks(BURST_COUNT, x, y, Math.random)];
    burstWavesRef.current = BURST_WAVES_MS.map((d) => now + d);
  }, [burstId]);
  // 描画ループは 1 回だけ作るので、最新の slot の列は ref 経由で読む。
  useEffect(() => {
    slotsRef.current = slotTimes;
  }, [slotTimes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = prefersReducedMotion();
    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let faint: HTMLCanvasElement | null = null;
    let bright: HTMLCanvasElement | null = null;
    let center = { x: 0, y: 0 };
    let centerAt = -Infinity;
    const recenter = () => {
      centerAt = -Infinity;
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      particles = seedParticles(particleCount(w, h), w, h, Math.random);
      faint = gridLayer(w, h, dpr, 0.05);
      bright = gridLayer(w, h, dpr, 0.55);
    };

    const draw = (now: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (faint) ctx.drawImage(faint, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 波紋：輪の帯の中だけ明るいグリッドを見せ、縁に光る線を引く。
      // 金庫の位置は毎フレーム読まない（レイアウトの読み出しを減らす）。大きさ・スクロールの変化と 0.5 秒ごとに読み直す。
      if (now - centerAt > CENTER_REFRESH_MS) {
        center = waveCenter(w, h);
        centerAt = now;
      }
      const { x: cx, y: cy } = center;
      const maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
      const burst = liveWaves(burstWavesRef.current, now, maxR).map((wv) => ({ ...wv, alpha: Math.min(1, wv.alpha * 1.6) }));
      for (const wave of reduced ? [] : [...liveWaves(slotsRef.current, now, maxR), ...burst]) {
        const band = 36;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, wave.radius, 0, Math.PI * 2);
        ctx.arc(cx, cy, Math.max(0, wave.radius - band), 0, Math.PI * 2, true);
        ctx.clip();
        ctx.globalAlpha = wave.alpha;
        if (bright) ctx.drawImage(bright, 0, 0, w, h);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, wave.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(20, 241, 149, ${0.35 * wave.alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      for (const sp of sparksRef.current) {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20, 241, 149, ${Math.min(1, sp.life / BURST_S + 0.2)})`;
        ctx.fill();
      }

      particles.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${COLORS[i % COLORS.length]}, 0.75)`;
        ctx.fill();
      });
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("resize", recenter);
    window.addEventListener("scroll", recenter, { passive: true });
    if (reduced) {
      draw(performance.now());
      const redraw = () => draw(performance.now());
      window.addEventListener("resize", redraw);
      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("resize", recenter);
        window.removeEventListener("scroll", recenter);
        window.removeEventListener("resize", redraw);
      };
    }

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      // タブが裏にあった後などで大きく飛ばないよう、1 コマの進みは 50 ms までにする。
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      particles = stepParticles(particles, dt, w, h);
      if (sparksRef.current.length > 0) sparksRef.current = stepSparks(sparksRef.current, dt);
      draw(now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", recenter);
      window.removeEventListener("scroll", recenter);
    };
  }, []);

  return <canvas ref={canvasRef} className="ambient" aria-hidden="true" />;
}
