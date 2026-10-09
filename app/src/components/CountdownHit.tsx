import { useLang } from "../lang";

type Props = { countdown: { next: string; seconds: number } | null };

/**
 * 次の依頼までの残り秒を画面の中央に大きく出す（#34）。1 秒ごとに数字が叩きつけられ、輪が 1 周で減っていく。
 * reduced-motion では数字だけを出す。
 */
export function CountdownHit({ countdown }: Props) {
  const { t } = useLang();
  if (!countdown) return null;
  return (
    <div className="countdown-hit" aria-hidden="true">
      <div className="cd-body" key={countdown.seconds}>
        <svg className="cd-ring" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" />
        </svg>
        <strong className="cd-num">{countdown.seconds}</strong>
      </div>
      <span className="cd-next">{t("play.next", { next: countdown.next })}</span>
    </div>
  );
}
