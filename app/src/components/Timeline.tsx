import { useLang } from "../lang";
import type { Msg } from "../i18n";

export type TimelineEntry = {
  id: number;
  label: Msg;
  detail?: Msg | string; // 依頼文やエラーの生の文字列はそのまま出す
  ms?: number | null;
  signature?: string;
  tone: "info" | "ok" | "warn" | "error";
};

type Props = {
  entries: TimelineEntry[];
};

const EXPLORER = "https://explorer.solana.com";

/** 1 回の流れで起きたことを、実測の時刻つきで上から流す。 */
export function Timeline({ entries }: Props) {
  const { t, tm } = useLang();
  if (entries.length === 0) {
    return <p className="timeline-empty">{t("timeline.empty")}</p>;
  }
  return (
    <ol className="timeline" aria-live="polite">
      {entries.map((e) => (
        <li key={e.id} className={`tl tl-${e.tone}`}>
          <span className="tl-dot" aria-hidden="true" />
          <span className="tl-label">{tm(e.label)}</span>
          {e.detail && (
            <span className="tl-detail">{typeof e.detail === "string" ? e.detail : tm(e.detail)}</span>
          )}
          {e.ms !== undefined && (
            <span className="tl-ms">{e.ms === null ? t("timeline.unconfirmedMs") : `${Math.round(e.ms)} ms`}</span>
          )}
          {e.signature && (
            <a
              className="tl-link"
              href={`${EXPLORER}/tx/${e.signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              tx ↗
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
