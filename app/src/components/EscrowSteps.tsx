import { useLang } from "../lang";
import { stepLights } from "../lib/halo";
import type { Phase } from "../lib/phase";

const STEPS = [1, 2, 3, 4] as const;

/** いま説明する工程（1〜4）。開いている工程、なければ最後に済んだ工程。待機中は null。 */
function focusStep(phase: Phase): number | null {
  const lights = stepLights(phase);
  const live = lights.indexOf("live");
  if (live >= 0) return live + 1;
  const stop = lights.indexOf("stop");
  if (stop >= 0) return stop + 1;
  const done = lights.lastIndexOf("done");
  return done >= 0 ? done + 1 : null;
}

/**
 * エスクローの 4 工程（預け入れ → 判断 → 検証 → 確定）を矢印の帯で見せる（#56）。
 * いまの工程の区画が開き、何が起きているかを 1 文で出す。段階が変わるたびに説明を展開し直す。
 */
export function EscrowSteps({ phase }: { phase: Phase }) {
  const { t } = useLang();
  const lights = stepLights(phase);
  const focus = focusStep(phase);
  const stopped = lights.includes("stop");
  const caption = focus === null ? t("flow.idle") : stopped ? t("flow.stop") : t(`flow.s${focus}.body`);
  return (
    <div className={`flow flow-${phase}`} role="group" aria-label={t("flow.label")}>
      <ol className="flow-steps">
        {STEPS.map((n, i) => (
          <li key={n} className={`flow-step is-${lights[i]} ${focus === n ? "is-focus" : ""}`}>
            <span className="flow-no">{String(n).padStart(2, "0")}</span>
            <span className="flow-title">{t(`flow.s${n}.title`)}</span>
          </li>
        ))}
      </ol>
      <p className="flow-caption" key={phase} aria-live="polite">
        {caption}
      </p>
    </div>
  );
}
