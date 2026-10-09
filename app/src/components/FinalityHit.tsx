import { useEffect, useState } from "react";
import { useLang } from "../lang";
import type { Grade } from "../lib/game";
import { prefersReducedMotion } from "../lib/motion";
import { ROLL_MS, rollDigits, type Jackpot, type NearMiss, type Tier } from "../lib/thrill";

export type Hit = {
  id: number;
  kind: "release" | "refund";
  ms: number;
  grade: Grade | null;
  /** 1 つ上のランクまでの差（#35）。 */
  near: NearMiss | null;
  tier: Tier | null;
  jackpot: Jackpot | null;
};

type Props = { hit: Hit | null };

/** 出てから ROLL_MS のあいだ、確定ミリ秒をスロットのように回す。reduced-motion では回さない。 */
function useRoll(hit: Hit | null): { text: string; rolling: boolean } | null {
  // 経過時間は確定ごとの id と組で持つ（前の回の経過時間で、次の回の最初のコマが止まって見えないように）。
  const [roll, setRoll] = useState({ id: -1, t: 0 });
  const reduced = prefersReducedMotion();
  useEffect(() => {
    if (!hit || reduced) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick() {
      const elapsed = performance.now() - start;
      setRoll({ id: hit.id, t: elapsed });
      if (elapsed < ROLL_MS) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [hit, reduced]);
  if (!hit) return null;
  // 止まったかどうかは経過時間で決める（回っている桁が偶然 target と同じ数字になっても止まった扱いにしない）。
  const t = reduced ? ROLL_MS : roll.id === hit.id ? roll.t : 0;
  return { text: rollDigits(hit.ms, t), rolling: t < ROLL_MS };
}

/**
 * 確定の瞬間に画面の中央へ確定ミリ秒を大きく出す（#31）。スクロール位置に関係なく見える。
 * 閃光 → 数字がスロットのように回って止まり、叩きつけられて一瞬止まる（ヒットストップ）→ 5 重の衝撃波。
 * ランクで演出の格が変わり、惜しさ（あと N ms）と大当たり（自己ベスト・S）を出す（#35）。
 * reduced-motion では数字だけを出す。
 */
export function FinalityHit({ hit }: Props) {
  const { t } = useLang();
  const roll = useRoll(hit);
  if (!hit || !roll) return null;
  const { text: shown, rolling } = roll;
  return (
    <div
      className={`finality-hit hit-${hit.kind} ${hit.tier ? `tier-${hit.tier}` : ""} ${hit.jackpot ? "is-jackpot" : ""}`}
      key={hit.id}
      role="status"
      aria-live="assertive"
      aria-label={`${t(hit.kind === "release" ? "hit.release" : "hit.refund")} ${Math.round(hit.ms)} ms`}
    >
      <div className="hit-flash" aria-hidden="true" />
      {hit.jackpot && <div className="hit-rays" aria-hidden="true" />}
      <div className="hit-rings" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="hit-body" aria-hidden="true">
        {hit.jackpot && (
          <span className="hit-jackpot">{t(hit.jackpot === "s-rank" ? "hit.jackpot" : "hit.best")}</span>
        )}
        <span className="hit-kicker">{t(hit.kind === "release" ? "hit.release" : "hit.refund")}</span>
        <strong className={`hit-ms ${rolling ? "rolling" : "locked"}`}>
          {shown}
          <small>ms</small>
        </strong>
        {!rolling && hit.grade && <span className={`hit-grade grade-${hit.grade}`}>{hit.grade}</span>}
        {!rolling && hit.near && (
          <span className={`hit-near ${hit.near.close ? "close" : ""}`}>
            {t("hit.near", { ms: hit.near.shortMs, grade: hit.near.next })}
          </span>
        )}
      </div>
    </div>
  );
}
