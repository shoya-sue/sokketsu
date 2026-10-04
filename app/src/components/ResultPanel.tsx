import { useEffect, useState } from "react";
import type { Measurement } from "../chain";
import type { JudgeOutput } from "../judge";
import { useLang } from "../lang";
import type { Grade } from "../lib/game";

export type Outcome =
  | { kind: "sent"; labelKey: "label.release" | "label.refund"; measurement: Measurement }
  | { kind: "stopped"; judge: JudgeOutput };

type Props = {
  outcome: Outcome | null;
  measuringSince: number | null;
  slotsLeft: number | null;
  grade: Grade | null;
};

const TOWER_BFT_MS = 12800;

/** requestAnimationFrame で経過 ms を追う（計測中のライブ表示用）。 */
function useElapsed(since: number | null): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (since === null) return;
    let frame = 0;
    const tick = () => {
      setElapsed(performance.now() - since);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [since]);
  return since === null ? 0 : elapsed;
}

/** 0 から target まで数え上げる。 */
function useCountUp(target: number | null, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

export function ResultPanel({ outcome, measuringSince, slotsLeft, grade }: Props) {
  const { t } = useLang();
  const live = useElapsed(measuringSince);
  const finalized = outcome?.kind === "sent" ? outcome.measurement.finalizedMs : null;
  const counted = useCountUp(finalized);

  if (measuringSince !== null) {
    return (
      <div className="result result-live" aria-live="polite">
        <span className="result-kicker">{t("result.waiting")}</span>
        <div className="result-hero">
          <span className="result-number live">{Math.round(live)}</span>
          <span className="result-unit">ms</span>
        </div>
        <div className="pulse-bar" />
      </div>
    );
  }

  if (!outcome) {
    return (
      <div className="result result-idle">
        <span className="result-kicker">{t("result.idle")}</span>
        <div className="result-hero">
          <span className="result-number ghost">----</span>
          <span className="result-unit">ms</span>
        </div>
        <p className="hint">{t("result.compare")}</p>
      </div>
    );
  }

  if (outcome.kind === "stopped") {
    const { judge } = outcome;
    return (
      <div className="result result-stopped" aria-live="polite">
        <span className="result-kicker">{t("result.noTransfer")}</span>
        <div className="result-hero">
          <span className="result-number zero">0</span>
          <span className="result-unit">{t("result.lamportMoved")}</span>
        </div>
        <p className="stopped-text">
          {t("result.stopped", { decision: judge.decision, pct: (judge.probability * 100).toFixed(1) })}
        </p>
        <p className="hint">
          {t("result.stoppedHint")}
          {slotsLeft !== null && t("result.slotsLeft", { slots: slotsLeft.toLocaleString() })}
        </p>
      </div>
    );
  }

  const label = t(outcome.labelKey);
  const m = outcome.measurement;
  if (m.error || finalized === null) {
    return (
      <div className="result result-error" aria-live="polite">
        <span className="result-kicker">
          {m.error ? t("result.failed", { label }) : t("result.unconfirmed", { label })}
        </span>
        <code className="hint">{m.error ?? m.signature}</code>
      </div>
    );
  }

  const speedup = TOWER_BFT_MS / finalized;
  const ourWidth = Math.max(1.2, (finalized / TOWER_BFT_MS) * 100);
  const x = speedup >= 10 ? String(Math.round(speedup)) : speedup.toFixed(1);
  const [before, after] = t("result.speedup", { x: "\u0000" }).split("\u0000");
  return (
    <div className="result result-win" aria-live="polite">
      <span className="result-kicker">{t("result.finalized", { label })}</span>
      <div className="result-hero">
        <span className="result-number">{Math.round(counted)}</span>
        <span className="result-unit">ms</span>
        {grade && (
          <span className={`grade-stamp grade-${grade}`} aria-label={`${t("game.grade")} ${grade}`}>
            <small>{t("game.grade")}</small>
            {grade}
          </span>
        )}
      </div>
      <p className="speedup">
        {before}
        <strong>{x}</strong>
        {after}
      </p>
      <div className="race" role="img" aria-label={`Alpenglow ${Math.round(finalized)}ms / Tower BFT 12800ms`}>
        <div className="race-row">
          <span className="race-label">Alpenglow</span>
          <div className="race-track">
            <div className="race-bar race-ours" style={{ ["--w" as string]: `${ourWidth}%` }} />
          </div>
          <span className="race-value">{Math.round(finalized)} ms</span>
        </div>
        <div className="race-row">
          <span className="race-label">Tower BFT</span>
          <div className="race-track">
            <div className="race-bar race-theirs" style={{ ["--w" as string]: "100%" }} />
          </div>
          <span className="race-value">12.8 s</span>
        </div>
      </div>
      <p className="hint">
        {t("result.processed", { ms: m.processedMs === null ? "—" : `${Math.round(m.processedMs)} ms` })}
      </p>
      {m.rateLimited && <p className="warn-note">{t("result.rateLimited")}</p>}
    </div>
  );
}
