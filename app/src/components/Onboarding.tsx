import { useEffect, useRef, useState } from "react";
import { useLang } from "../lang";
import { ONBOARDING_STEPS, stepDelayMs } from "../lib/onboarding";
import { prefersReducedMotion } from "../lib/motion";

type Props = {
  open: boolean;
  /** 閉じ終わったとき（「はじめる」・Esc・背景のクリック）。 */
  onClose: () => void;
  /** 「はじめる」を押した瞬間の演出（紙吹雪など）。 */
  onStart?: () => void;
};

const CLOSE_MS = 320;

/**
 * 初回の案内（#53）。ロゴが叩きつけられて開き、光線が回り、3 枚のカードが順に跳ねて出る。
 * 「はじめる」で弾けて縮みながら閉じる。reduced-motion では動きを止めて中身だけ出す。
 */
export function Onboarding({ open, onClose, onStart }: Props) {
  const { t } = useLang();
  const [closing, setClosing] = useState(false);
  const cta = useRef<HTMLButtonElement>(null);

  const close = (start: boolean) => {
    if (closing) return;
    if (start) onStart?.();
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, CLOSE_MS);
  };

  useEffect(() => {
    if (!open) return;
    cta.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // close は描画ごとに作り直すが、開いている間の Esc の扱いは同じ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div className={`onboard ${closing ? "is-closing" : ""}`} onClick={() => close(false)}>
      <div className="onboard-rays" aria-hidden="true" />
      <section
        className="onboard-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <img className="onboard-logo" src="/logo-mark.svg" alt="" width="96" height="96" />
        <span className="onboard-kicker">{t("onboard.kicker")}</span>
        <h2 id="onboard-title" className="onboard-title">
          {t("onboard.title")}
        </h2>
        <ol className="onboard-steps">
          {ONBOARDING_STEPS.map((step, i) => (
            <li key={step.key} className="onboard-step" style={{ animationDelay: `${stepDelayMs(i)}ms` }}>
              <span className="onboard-icon" aria-hidden="true">
                {step.icon}
              </span>
              <span className="onboard-no">{String(i + 1).padStart(2, "0")}</span>
              <strong>{t(`onboard.${step.key}.title`)}</strong>
              <p>{t(`onboard.${step.key}.body`)}</p>
            </li>
          ))}
        </ol>
        <button ref={cta} className="onboard-cta" onClick={() => close(true)}>
          {t("onboard.cta")} ▶
        </button>
      </section>
    </div>
  );
}
