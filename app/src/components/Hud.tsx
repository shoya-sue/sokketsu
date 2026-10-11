import { useEffect, useRef, useState } from "react";
import { levelFromXp, levelProgress, type GameState } from "../lib/game";
import { fireLevel } from "../lib/thrill";
import { comboSegments, ringDashOffset } from "../lib/gauges";
import { useLang } from "../lang";

type Props = {
  game: GameState;
  gain: { amount: number; key: number } | null; // 直近で入った点（+N を浮かせる）
};

/** 表示中の値から目標値まで滑らかに数え上げる。 */
function useTween(target: number, durationMs = 700): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      const v = origin + (target - origin) * (1 - Math.pow(1 - t, 3));
      setValue(v);
      from.current = v;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;
const HEX = "50,4 90,27 90,73 50,96 10,73 10,27";

/**
 * レベル・経験値バー・スコア・コンボ・ベストを並べる。
 * 計器として重ねる（#56）：レベルは六角形のバッジと経験値の環、スコアは裏に残像の桁、コンボは 5 段のメーター。
 */
export function Hud({ game, gain }: Props) {
  const { t } = useLang();
  const score = useTween(game.xp);
  const level = levelFromXp(game.xp);
  const progress = levelProgress(game.xp);
  const fire = fireLevel(game.combo);
  return (
    <section className="hud" aria-label={t("hud.label")}>
      <div className="hud-level" key={`lv-${level}`}>
        <svg className="hud-level-badge" viewBox="0 0 100 100" aria-hidden="true">
          <polygon className="hud-hex" points={HEX} />
          <circle className="hud-ring-track" cx="50" cy="50" r={RING_R} />
          <circle
            className="hud-ring"
            cx="50"
            cy="50"
            r={RING_R}
            strokeDasharray={RING_C}
            strokeDashoffset={ringDashOffset(progress, RING_C)}
          />
          <circle className="hud-ring-ticks" cx="50" cy="50" r="48" />
        </svg>
        <span className="hud-level-label">LV</span>
        <span className="hud-level-num">{level}</span>
      </div>
      <div className="hud-xp">
        <div className="hud-xp-head">
          <span>{t("hud.score")}</span>
          <span className="hud-score-wrap">
            <span className="hud-score-ghost" aria-hidden="true">
              888,888
            </span>
            <strong className="hud-score">{Math.round(score).toLocaleString()}</strong>
          </span>
          {gain && gain.amount > 0 && (
            <span className="hud-gain" key={gain.key}>
              +{gain.amount}
            </span>
          )}
        </div>
        <div
          className="hud-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="hud-bar-fill" style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
      <div className={`hud-combo ${game.combo >= 2 ? "hot" : ""} fire-${fire}`} key={`combo-${game.combo}`}>
        <span className="hud-combo-label">{t("hud.combo")}</span>
        <span className="hud-combo-num">×{game.combo}</span>
        <span className="hud-segs" aria-hidden="true">
          {comboSegments(game.combo).map((on, i) => (
            <i key={i} className={on ? "on" : undefined} />
          ))}
        </span>
        {fire > 0 && (
          <span className="hud-fire" role="img" aria-label={t("hud.fire", { combo: game.combo })}>
            {"🔥".repeat(fire)}
          </span>
        )}
      </div>
      <div className="hud-best">
        <span className="hud-combo-label">{t("hud.best")}</span>
        <span className="hud-best-num">{game.bestMs === null ? "—" : `${Math.round(game.bestMs)}ms`}</span>
      </div>
    </section>
  );
}
