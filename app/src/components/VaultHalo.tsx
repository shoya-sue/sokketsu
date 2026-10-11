import type { CSSProperties } from "react";
import { haloReadouts, tickLines } from "../lib/halo";
import type { Phase } from "../lib/phase";

type Props = {
  phase: Phase;
  /** 判断の確率（0〜1）。まだ判断が無ければ null。 */
  probability: number | null;
  thresholdPct: number;
  /** 変わるたびに（段階・回が変わるたびに）層を順に展開し直す。 */
  unfoldKey: string;
  /** 出た判断。軌道を回る 3 択のうち、これだけを光らせる。 */
  decision?: string | null;
};

const TICKS = tickLines(120, 190, 6, 16, 10);
const INNER_TICKS = tickLines(60, 112, 5, 12, 5);
const CHOICES = ["RELEASE", "HOLD", "REFUND"] as const;
const ARCS = 6;
const ARC_R = 140;
const ARC_C = 2 * Math.PI * ARC_R;
const RING_TEXT = "TYPED DECISION · ED25519 VERIFIED ON-CHAIN · THRESHOLD 70% · ALPENGLOW FINALITY · ";
const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * 2 * Math.PI - Math.PI / 2;
  return `${(Math.cos(a) * 122).toFixed(1)},${(Math.sin(a) * 122).toFixed(1)}`;
}).join(" ");

/** 展開の順番（0 から）。CSS の --i で遅らせる。 */
const at = (i: number) => ({ ["--i" as string]: i }) as CSSProperties;

/**
 * 舞台の金庫を何重にも囲む演出（#56）。外から、目盛りの環・回る文字の環・弧の環・六角形・照準・衛星・
 * 判断中のレーダー・四方の計器の読み・確定の衝撃波。段階が変わるたびに層が内から外へ順に展開する。
 * 外側の div が展開し、内側が回り続ける（transform がぶつからないように分ける）。
 */
export function VaultHalo({ phase, probability, thresholdPct, unfoldKey, decision = null }: Props) {
  const readouts = haloReadouts({ phase, probability, thresholdPct });
  const settled = phase === "released" || phase === "refunded";
  return (
    <div className={`halo halo-${phase}`} key={unfoldKey} aria-hidden="true">
      <div className="halo-l halo-sweep" style={at(0)}>
        <div className="halo-spin" />
      </div>
      <div className="halo-l halo-hex" style={at(1)}>
        <svg className="halo-spin" viewBox="-200 -200 400 400">
          <polygon points={HEX} />
        </svg>
      </div>
      <div className="halo-l halo-arcs" style={at(2)}>
        <svg className="halo-spin" viewBox="-200 -200 400 400">
          <circle r={ARC_R} strokeDasharray={`${(ARC_C / ARCS) * 0.62} ${(ARC_C / ARCS) * 0.38}`} />
        </svg>
      </div>
      <div className="halo-l halo-sats" style={at(3)}>
        <div className="halo-spin">
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="halo-l halo-text" style={at(4)}>
        <svg className="halo-spin" viewBox="-200 -200 400 400">
          <defs>
            <path id="halo-text-path" d="M0,-165 a165,165 0 1,1 0,330 a165,165 0 1,1 0,-330" />
          </defs>
          <text>
            <textPath href="#halo-text-path">{RING_TEXT}</textPath>
          </text>
        </svg>
      </div>
      <div className="halo-l halo-ticks" style={at(5)}>
        <svg className="halo-spin" viewBox="-200 -200 400 400">
          {TICKS.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className={t.long ? "long" : undefined} />
          ))}
        </svg>
      </div>
      <div className="halo-l halo-inner" style={at(6)}>
        <svg className="halo-spin" viewBox="-200 -200 400 400">
          {INNER_TICKS.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className={t.long ? "long" : undefined} />
          ))}
        </svg>
      </div>
      <div className="halo-l halo-choices" style={at(7)}>
        <div className="halo-spin">
          {CHOICES.map((c) => (
            <span key={c} className={`halo-choice ${decision === c.toLowerCase() ? "is-on" : ""}`}>
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="halo-l halo-chevrons" style={at(8)}>
        <i className="l">›››</i>
        <i className="r">‹‹‹</i>
      </div>
      {settled && <div className="halo-pillar" />}
      <div className="halo-l halo-cross" style={at(6)}>
        <i className="h" />
        <i className="v" />
        <b className="tl" />
        <b className="tr" />
        <b className="bl" />
        <b className="br" />
      </div>
      {readouts.map((r, i) => (
        <span className={`halo-read halo-read-${i}`} style={at(9 + i)} key={i}>
          {r}
        </span>
      ))}
      {settled && (
        <div className="halo-shock">
          <i />
          <i />
          <i />
        </div>
      )}
    </div>
  );
}
