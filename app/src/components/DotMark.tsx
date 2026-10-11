import type { CSSProperties } from "react";
import { dotMark, litCount } from "../lib/dotmark";
import { stepLights } from "../lib/halo";
import type { Phase } from "../lib/phase";

const DOTS = dotMark(5);

/**
 * Sokketsu のマークを点の格子で描く（#56）。工程が 1 つ済むごとに真上から時計回りに 25% ずつ点が灯る。
 * 止まった巨大ロゴの代わりに、エスクローの進み具合を背景で見せる。
 */
export function DotMark({ phase }: { phase: Phase }) {
  const done = stepLights(phase).filter((l) => l === "done").length;
  const lit = litCount(DOTS.length, done);
  return (
    <svg className="od-dotmark" viewBox="0 0 128 128" aria-hidden="true">
      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={1.7}
          className={i < lit ? "on" : undefined}
          style={{ ["--d" as string]: `${Math.round(d.order * 600)}ms` } as CSSProperties}
        />
      ))}
    </svg>
  );
}
