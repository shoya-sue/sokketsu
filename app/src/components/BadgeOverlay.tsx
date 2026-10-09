import { useEffect, useState, type PointerEvent } from "react";
import { prefersReducedMotion } from "../lib/motion";

export type Badge = { id: number; icon: string; kicker: string; title: string; body: string };

type Props = { badge: Badge | null; onDone: () => void };

const SHOW_MS = 2800;
const MAX_TILT_DEG = 14;
const PARTICLES = 18;

// 粒子の飛び先（固定の配置。描画のたびに乱数を引かないので、同じバッジは毎回同じ形に飛ぶ）。
const particle = (i: number) => {
  const angle = (i / PARTICLES) * Math.PI * 2;
  const dist = 90 + (i % 3) * 28;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, d: (i % 5) * 40 };
};

/**
 * 実績解除・S ランクのバッジ。カーソルの向きに 3D で傾き、金の粒子が散る。
 * 画面操作は止めない（クリックを透過する）。reduced-motion では傾きも粒子も出さない。
 */
export function BadgeOverlay({ badge, onDone }: Props) {
  const reduced = prefersReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!badge) return;
    const id = setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(id);
  }, [badge, onDone]);

  if (!badge) return null;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    setTilt({ x: -dy * MAX_TILT_DEG, y: dx * MAX_TILT_DEG });
  };

  return (
    <div className="badge-overlay" role="status" aria-live="assertive" onPointerMove={onMove} key={badge.id}>
      <div
        className="badge"
        style={{ transform: `perspective(700px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <span className="badge-icon" aria-hidden="true">
          {badge.icon}
        </span>
        <small className="badge-kicker">{badge.kicker}</small>
        <strong className="badge-title">{badge.title}</strong>
        <span className="badge-body">{badge.body}</span>
      </div>
      {!reduced &&
        Array.from({ length: PARTICLES }, (_, i) => {
          const p = particle(i);
          return (
            <i
              key={i}
              className="gold-particle"
              aria-hidden="true"
              style={{ ["--x" as string]: `${p.x}px`, ["--y" as string]: `${p.y}px`, animationDelay: `${p.d}ms` }}
            />
          );
        })}
    </div>
  );
}
