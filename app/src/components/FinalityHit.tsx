import { useLang } from "../lang";
import type { Grade } from "../lib/game";

export type Hit = { id: number; kind: "release" | "refund"; ms: number; grade: Grade | null };

type Props = { hit: Hit | null };

/**
 * 確定の瞬間に画面の中央へ確定ミリ秒を大きく出す（#31）。スクロール位置に関係なく見える。
 * 閃光 → 数字が叩きつけられて一瞬止まる（ヒットストップ）→ 5 重の衝撃波。reduced-motion では数字だけを出す。
 */
export function FinalityHit({ hit }: Props) {
  const { t } = useLang();
  if (!hit) return null;
  return (
    <div className={`finality-hit hit-${hit.kind}`} key={hit.id} role="status" aria-live="assertive">
      <div className="hit-flash" aria-hidden="true" />
      <div className="hit-rings" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="hit-body">
        <span className="hit-kicker">{t(hit.kind === "release" ? "hit.release" : "hit.refund")}</span>
        <strong className="hit-ms">
          {Math.round(hit.ms)}
          <small>ms</small>
        </strong>
        {hit.grade && <span className={`hit-grade grade-${hit.grade}`}>{hit.grade}</span>}
      </div>
    </div>
  );
}
