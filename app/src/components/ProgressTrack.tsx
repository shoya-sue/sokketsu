import { useLang } from "../lang";
import { statusOf, stepStates, type StepState } from "../lib/steps";
import type { Phase } from "../lib/phase";

const STEP_KEYS = ["steps.deposit", "steps.judge", "steps.verify", "steps.finalize"] as const;

type Props = { phase: Phase; beforeError?: Phase };

/** 01 預け入れ → 02 判断 → 03 署名検証 → 04 確定 の段階表示と、いまの状態のピル。 */
export function ProgressTrack({ phase, beforeError }: Props) {
  const { t } = useLang();
  const states = stepStates(phase, beforeError);
  const status = statusOf(phase);
  return (
    <div className="progress-track">
      <ol className="steps" aria-label={t("steps.label")}>
        {STEP_KEYS.map((key, i) => (
          <Step key={key} index={i} label={t(key)} state={states[i]} />
        ))}
      </ol>
      <StatusPill status={status} label={t(`status.${status}`)} />
    </div>
  );
}

function Step({ index, label, state }: { index: number; label: string; state: StepState }) {
  return (
    <li className={`step step-${state}`} aria-current={state === "active" ? "step" : undefined}>
      <span className="step-no">{String(index + 1).padStart(2, "0")}</span>
      <span className="step-label">{label}</span>
      <span className="step-bar" aria-hidden="true" />
    </li>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span className={`status-pill status-${status}`} role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
