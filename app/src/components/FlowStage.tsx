import type { PublicKey } from "@solana/web3.js";
import type { JudgeOutput } from "../judge";
import { useLang } from "../lang";
import { RING_COUNT, ringsBroken, thresholdRing } from "../lib/rings";

import type { Phase } from "../lib/phase";
import { StageDeck } from "./StageDeck";
import { VaultHalo } from "./VaultHalo";

export type { Phase };

type Party = { address: PublicKey | null; balance: number | null };

type Props = {
  phase: Phase;
  payer: Party;
  payee: Party;
  vaultLamports: number | null;
  judgement: JudgeOutput | null;
  fallbackReason: string | null;
  thresholdBps: number;
  runKey: number;
  /** 送金しない再生（#30）のときの確定ミリ秒。null なら本物の進行。 */
  replayMs?: number | null;
  /** 確定したときの確定ミリ秒。金庫の中央に出す（#32）。 */
  finalizedMs?: number | null;
};

const EXPLORER = "https://explorer.solana.com";
const RADIUS = 58;
const CIRC = 2 * Math.PI * RADIUS;
const SHARD_R = 66;
const SHARD_SPAN = 360 / RING_COUNT;
const SHARD_GAP = 4;

/** 外周の欠片 i（0 が真上から時計回り）の円弧。 */
function shardPath(i: number): string {
  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const a0 = rad(i * SHARD_SPAN + SHARD_GAP / 2);
  const a1 = rad((i + 1) * SHARD_SPAN - SHARD_GAP / 2);
  const p = (a: number) => `${(70 + SHARD_R * Math.cos(a)).toFixed(2)},${(70 + SHARD_R * Math.sin(a)).toFixed(2)}`;
  return `M${p(a0)} A${SHARD_R},${SHARD_R} 0 0 1 ${p(a1)}`;
}

/** 欠片 i が外れるときに飛ぶ向き（欠片の中央の角度の外向き）。 */
function shardOut(i: number): { dx: number; dy: number } {
  const a = (((i + 0.5) * SHARD_SPAN - 90) * Math.PI) / 180;
  return { dx: Math.cos(a) * 10, dy: Math.sin(a) * 10 };
}

// コインの位置（舞台幅に対する %）。3 ノードを等間隔に置く。
const AT_PAYER = 16.67;
const AT_VAULT = 50;
const AT_PAYEE = 83.33;

// コインは「動いているあいだ」だけ出し、到着したら弾けて消える（ノードの数字を隠さない）。
const TRAVEL: Partial<Record<Phase, { from: number; to: number; tone: string }>> = {
  depositing: { from: AT_PAYER, to: AT_VAULT, tone: "green" },
  releasing: { from: AT_VAULT, to: AT_PAYEE, tone: "green" },
  refunding: { from: AT_VAULT, to: AT_PAYER, tone: "cyan" },
};

const sol = (lamports: number | null) =>
  lamports === null ? "—" : (lamports / 1_000_000_000).toFixed(4);
const short = (key: PublicKey) => {
  const s = key.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};

export function FlowStage({
  phase,
  payer,
  payee,
  vaultLamports,
  judgement,
  fallbackReason,
  thresholdBps,
  runKey,
  replayMs = null,
  finalizedMs = null,
}: Props) {
  const { t } = useLang();
  const threshold = thresholdBps / 10000;
  const probability = judgement?.probability ?? 0;
  const passes = judgement !== null && judgement.decision !== "hold" && probability >= threshold;
  const scanning = phase === "judging";
  const showRing = judgement !== null && phase !== "depositing" && phase !== "idle";
  const travel = TRAVEL[phase];
  const leftActive = phase === "depositing" || phase === "refunding";
  const rightActive = phase === "releasing";
  const tickAngle = threshold * 2 * Math.PI - Math.PI / 2;
  // 判断が出たら、確率の分だけ外周の欠片が外れる。閾値の欠片まで外れれば執行される。
  // hold は執行しない判断なので、確率が高くても欠片は外さない（外れると「執行された」ように見える）。
  const broken = showRing && judgement?.decision !== "hold" ? ringsBroken(probability) : 0;
  const thresholdShard = thresholdRing(threshold) - 1;
  const settled = phase === "released" || phase === "refunded";
  const doneMs = settled ? (replayMs ?? finalizedMs) : null;

  return (
    <div className={`stage phase-${phase} ${replayMs !== null ? "is-replay" : ""}`}>
      <StageDeck />
      {replayMs !== null && (
        <span className="replay-tag" aria-hidden="true">
          REPLAY
        </span>
      )}

      <div className={`rail rail-left ${leftActive ? "active" : ""} ${phase === "refunding" ? "reverse" : ""}`} aria-hidden="true" />
      <div className={`rail rail-right ${rightActive ? "active" : ""}`} aria-hidden="true" />

      {travel && (
        <div
          key={`${phase}-${runKey}`}
          className={`coin coin-${travel.tone}`}
          style={{ ["--from" as string]: `${travel.from}%`, ["--to" as string]: `${travel.to}%` }}
          aria-hidden="true"
        >
          ◎
        </div>
      )}

      <Node
        role={t("stage.payer")}
        party={payer}
        glow={phase === "refunded"}
        dim={false}
        className="node-payer"
      />

      <div className={`vault ${passes ? "pass" : judgement ? "stop" : ""}`}>
        <VaultHalo
          phase={phase}
          probability={showRing ? probability : null}
          thresholdPct={Math.round(threshold * 100)}
          unfoldKey={`${phase}-${runKey}`}
          decision={showRing ? (judgement?.decision ?? null) : null}
        />
        <svg viewBox="0 0 140 140" className={`gate ${scanning ? "scanning" : ""}`} aria-hidden="true">
          <defs>
            <linearGradient id="gate-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--sol-purple)" />
              <stop offset="100%" stopColor="var(--sol-green)" />
            </linearGradient>
          </defs>
          <g className="shards" key={`shards-${runKey}`}>
            {Array.from({ length: RING_COUNT }, (_, i) => {
              const out = shardOut(i);
              return (
                <path
                  key={i}
                  d={shardPath(i)}
                  className={`shard ${i < broken ? "broken" : ""} ${i === thresholdShard ? "threshold" : ""}`}
                  style={{
                    ["--i" as string]: i,
                    ["--dx" as string]: `${out.dx}px`,
                    ["--dy" as string]: `${out.dy}px`,
                  }}
                />
              );
            })}
          </g>
          <circle className="gate-track" cx="70" cy="70" r={RADIUS} />
          {scanning && <circle className="gate-scan" cx="70" cy="70" r={RADIUS} strokeDasharray={`${CIRC * 0.22} ${CIRC}`} />}
          {showRing && (
            <circle
              key={`ring-${runKey}`}
              className="gate-fill"
              cx="70"
              cy="70"
              r={RADIUS}
              strokeDasharray={CIRC}
              style={{ ["--dash-to" as string]: CIRC * (1 - probability), ["--circ" as string]: CIRC }}
              transform="rotate(-90 70 70)"
            />
          )}
          <line
            className="gate-tick"
            x1={70 + (RADIUS - 11) * Math.cos(tickAngle)}
            y1={70 + (RADIUS - 11) * Math.sin(tickAngle)}
            x2={70 + (RADIUS + 11) * Math.cos(tickAngle)}
            y2={70 + (RADIUS + 11) * Math.sin(tickAngle)}
          />
        </svg>
        <div className="vault-core">
          {phase === "stopped" || phase === "holding" ? (
            <span className="vault-lock" aria-hidden="true">🔒</span>
          ) : null}
          {doneMs !== null ? (
            <>
              <span className="vault-label">{t("stage.finalized")}</span>
              <span className="vault-ms" key={`ms-${runKey}`}>
                {Math.round(doneMs)}
                <small>ms</small>
              </span>
            </>
          ) : (
            <>
              <span className="vault-label">{t("stage.vault")}</span>
              <span className="vault-amount" key={`v-${vaultLamports ?? "none"}`}>
                {sol(vaultLamports)}
              </span>
            </>
          )}
          <span className="vault-judge" aria-live="polite">
            {scanning
              ? t("stage.judging")
              : judgement
                ? `${judgement.decision} ${Math.round(probability * 100)}%`
                : t("stage.threshold")}
          </span>
        </div>
        {judgement && replayMs === null && (
          <span className={`source source-${judgement.source}`}>
            source: {judgement.source}
            {judgement.proof ? ` · ✓ ${t("stage.signed")}` : ""}
            {judgement.source === "mock" && fallbackReason ? ` · ${fallbackReason}` : ""}
          </span>
        )}
      </div>

      <Node role={t("stage.payee")} party={payee} glow={phase === "released"} dim={false} className="node-payee" />

      {phase === "stopped" && (
        <div className="stage-stamp" key={`s-${runKey}`}>
          STOPPED
        </div>
      )}
    </div>
  );
}

function Node({
  role,
  party,
  glow,
  dim,
  className,
}: {
  role: string;
  party: Party;
  glow: boolean;
  dim: boolean;
  className: string;
}) {
  return (
    <div className={`node ${className} ${glow ? "glow" : ""} ${dim ? "dim" : ""}`}>
      <span className="node-role">{role}</span>
      <span className="node-balance" key={party.balance ?? "none"}>
        {sol(party.balance)}
        <small>SOL</small>
      </span>
      {party.address ? (
        <a
          className="node-addr"
          href={`${EXPLORER}/address/${party.address.toBase58()}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {short(party.address)}
        </a>
      ) : (
        <span className="node-addr">—</span>
      )}
    </div>
  );
}
