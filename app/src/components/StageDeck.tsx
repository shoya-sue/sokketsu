import { STEP_KEYS, stepLights } from "../lib/halo";
import type { Phase } from "../lib/phase";

/**
 * 舞台の奥に敷く演出（#56）。遠近の付いた床のグリッド、金庫の裏の巨大な「即決」、左上の 4 工程のランプ。
 */
export function StageDeck({ phase }: { phase: Phase }) {
  const lights = stepLights(phase);
  return (
    <div className="deck" aria-hidden="true">
      <div className="deck-floor">
        <div className="deck-floor-grid" />
      </div>
      <span className="deck-kanji">即決</span>
      <ol className="deck-steps">
        {STEP_KEYS.map((k, i) => (
          <li key={k} className={`deck-step is-${lights[i]}`}>
            <span className="deck-step-no">{String(i + 1).padStart(2, "0")}</span>
            {k}
          </li>
        ))}
      </ol>
    </div>
  );
}
