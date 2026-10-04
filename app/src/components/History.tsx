import { HISTORY_SIZE, allSubSecond, median, type Sample } from "../lib/stats";
import { useLang } from "../lang";

type Props = {
  history: Sample[]; // 新しい順
};

const CHART_H = 64;
const FLOOR_MS = 1000; // 縦軸の最低スケール。1 秒の線を引く

/** 直近 5 件の finalized ミリ秒を棒で並べ、中央値の線を引く。 */
export function History({ history }: Props) {
  const { t } = useLang();
  const labels = {
    title: t("history.title"),
    median: t("history.median"),
    allSubSecond: t("history.allSubSecond"),
    empty: t("history.empty"),
  };
  if (history.length === 0) {
    return (
      <div className="history">
        <span className="history-title">{labels.title}</span>
        <p className="hint">{labels.empty}</p>
      </div>
    );
  }
  const ordered = [...history].reverse(); // 古い → 新しい
  const scale = Math.max(FLOOR_MS, ...ordered.map((s) => s.ms));
  const med = median(ordered.map((s) => s.ms)) ?? 0;
  const y = (ms: number) => CHART_H - (ms / scale) * CHART_H;
  const slots = Array.from({ length: HISTORY_SIZE }, (_, i) => ordered[i] ?? null);

  return (
    <div className="history">
      <div className="history-head">
        <span className="history-title">{labels.title}</span>
        <span className="history-median">
          {labels.median} <strong>{Math.round(med)} ms</strong>
        </span>
        {allSubSecond(history) && <span className="history-badge">{labels.allSubSecond}</span>}
      </div>
      <div className="history-chart" role="img" aria-label={`${labels.median} ${Math.round(med)} ms`}>
        <svg viewBox={`0 0 100 ${CHART_H}`} preserveAspectRatio="none" aria-hidden="true">
          <line className="history-1s" x1="0" x2="100" y1={y(FLOOR_MS)} y2={y(FLOOR_MS)} />
          <line className="history-med" x1="0" x2="100" y1={y(med)} y2={y(med)} />
        </svg>
        <div className="history-bars">
          {slots.map((s, i) => (
            <div key={s ? s.at : `empty-${i}`} className="history-slot">
              {s && (
                <>
                  <div
                    className={`history-bar ${s.ms < FLOOR_MS ? "fast" : "slow"} ${i === ordered.length - 1 ? "latest" : ""}`}
                    style={{ height: `${(s.ms / scale) * 100}%` }}
                    title={s.label}
                  />
                  <span className="history-ms">{Math.round(s.ms)}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
