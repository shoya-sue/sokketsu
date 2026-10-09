import type { JudgeOutput } from "../judge";
import { useLang } from "../lang";

type Props = {
  task: string | null;
  judging: boolean;
  judgement: JudgeOutput | null;
  thresholdBps: number;
  runKey: number;
};

// 長文の LLM 回答のおおよその長さ（表示用の目安。日本語・英語とも 1 語 ≒ 1.3 token として見積もる）。
const llmTokens = (text: string) => Math.round(text.length / 2.6);

/**
 * 判断の中身を見せる。
 * - 依頼文 → 判断する（Jev / モック）→ 判断 へ線が伸びる
 * - LLM に聞いたときの長文と、型付きの答え（選択肢と確率だけ）を並べる
 * - 確率を温度計と閾値の線で示す
 */
export function JudgePanel({ task, judging, judgement, thresholdBps, runKey }: Props) {
  const { t } = useLang();
  if (!task) return null;
  const threshold = thresholdBps / 10000;
  const probability = judgement?.probability ?? 0;
  const passes = judgement !== null && judgement.decision !== "hold" && probability >= threshold;
  const sourceName = judgement?.source === "mock" ? "Mock" : "Jev";
  const state = judging ? "judging" : judgement ? "done" : "idle";
  const llm = t("judge.llmSample");

  return (
    <section className={`judge-panel judge-${state}`} aria-label={t("judge.title")} key={`judge-${runKey}`}>
      <ol className="judge-flow">
        <li className="flow-node flow-request">
          <small>{t("judge.flowRequest")}</small>
          <span title={task}>{task}</span>
        </li>
        <li className="flow-link" aria-hidden="true" />
        <li className={`flow-node flow-judge source-${judgement?.source ?? "jev"}`}>
          <small>{t("judge.flowJudge")}</small>
          <span>{judgement ? sourceName : "Jev"}</span>
        </li>
        <li className="flow-link flow-link-2" aria-hidden="true" />
        <li className={`flow-node flow-result ${passes ? "pass" : judgement ? "stop" : ""}`}>
          <small>{t("judge.flowResult")}</small>
          <span>{judgement ? `${judgement.decision} ${Math.round(probability * 100)}%` : "…"}</span>
        </li>
      </ol>

      {/* プレイ中は図と数字だけにする（#32）。比較の説明は開いたときだけ */}
      <details className="judge-more">
        <summary>{t("judge.more")}</summary>
      <div className="judge-compare">
        <div className="compare-card compare-llm">
          <span className="compare-label">{t("judge.llmLabel")}</span>
          <p className="llm-prose">{llm}</p>
          <span className="compare-meta">{t("judge.llmMeta", { tokens: llmTokens(llm) })}</span>
        </div>
        <div className={`compare-card compare-typed ${passes ? "pass" : judgement ? "stop" : ""}`}>
          <span className="compare-label">{t("judge.typedLabel", { source: sourceName })}</span>
          {judgement ? (
            <pre className="typed-answer">
              <span className="k">decision</span>: <span className="v">"{judgement.decision}"</span>
              {"\n"}
              <span className="k">probability</span>: <span className="v">{probability.toFixed(2)}</span>
            </pre>
          ) : (
            <p className="typed-waiting">{t("judge.waiting")}</p>
          )}
          <span className="compare-meta">{t("judge.typedMeta")}</span>
        </div>
        <div
          className={`meter ${passes ? "pass" : judgement ? "stop" : ""}`}
          role="img"
          aria-label={`${t("judge.meter")} ${Math.round(probability * 100)}% / ${t("judge.meterThreshold", { pct: Math.round(threshold * 100) })}`}
        >
          <span className="meter-label">{t("judge.meter")}</span>
          <div className="meter-tube">
            <div className="meter-fill" style={{ ["--p" as string]: `${probability * 100}%` }} />
            <div className="meter-threshold" style={{ ["--t" as string]: `${threshold * 100}%` }}>
              <span>{t("judge.meterThreshold", { pct: Math.round(threshold * 100) })}</span>
            </div>
          </div>
          <span className="meter-value">{judgement ? `${Math.round(probability * 100)}%` : "—"}</span>
        </div>
      </div>
      </details>
    </section>
  );
}
