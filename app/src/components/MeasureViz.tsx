import { useLang } from "../lang";
import { breakdown, stairPoints } from "../lib/measure";

type Props = { processedMs: number | null; finalizedMs: number };

const CHART_W = 240;
const CHART_H = 48;

/**
 * 送信 → processed → finalized の内訳。値は sendAndMeasure の戻り値だけから作る（追加の RPC 呼び出しは無い）。
 * - 時刻つきのイベントログ
 * - 段階の階段グラフ
 * - 窓（1 秒単位）に対する経過バー
 */
export function MeasureViz({ processedMs, finalizedMs }: Props) {
  const { t } = useLang();
  const b = breakdown({ processedMs, finalizedMs });
  const pct = (ms: number) => `${(ms / b.windowMs) * 100}%`;
  const ticks = Array.from({ length: b.windowMs / 100 + 1 }, (_, i) => i * 100);
  return (
    <div className="measure" aria-label={t("measure.title")}>
      <div className="measure-head">
        <span>{t("measure.title")}</span>
        <small>{t("measure.window", { s: b.windowMs / 1000 })}</small>
      </div>
      <div className="measure-body">
        <ol className="measure-log">
          {b.events.map((e, i) => (
            <li key={e.key} className={`log-${e.key}`} style={{ ["--i" as string]: i }}>
              <code>{String(e.at).padStart(4, " ")} ms</code>
              <span>{t(`measure.${e.key}`)}</span>
            </li>
          ))}
        </ol>
        <svg
          className="measure-chart"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          role="img"
          aria-label={t("measure.chart")}
          preserveAspectRatio="none"
        >
          <polyline className="stair" points={stairPoints(b, CHART_W, CHART_H)} pathLength={1} />
        </svg>
      </div>
      <div className="measure-bar" aria-hidden="true">
        {b.segments.map((s) => (
          <span
            key={s.key}
            className={`seg seg-${s.key}`}
            style={{ ["--from" as string]: pct(s.from), ["--to" as string]: pct(s.to) }}
          />
        ))}
        {ticks.map((ms) => (
          <i key={ms} className={ms % 1000 === 0 ? "tick major" : "tick"} style={{ left: pct(ms) }} />
        ))}
      </div>
    </div>
  );
}
