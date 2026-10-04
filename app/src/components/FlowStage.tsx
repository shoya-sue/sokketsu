import type { PublicKey } from "@solana/web3.js";
import type { JudgeOutput } from "../judge";
import { useLang } from "../lang";

export type Phase =
  | "idle"
  | "depositing"
  | "judging"
  | "holding"
  | "releasing"
  | "refunding"
  | "stopped"
  | "released"
  | "refunded"
  | "error";

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
};

const EXPLORER = "https://explorer.solana.com";
const RADIUS = 58;
const CIRC = 2 * Math.PI * RADIUS;

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

  return (
    <div className={`stage phase-${phase}`}>

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
        <svg viewBox="0 0 140 140" className={`gate ${scanning ? "scanning" : ""}`} aria-hidden="true">
          <defs>
            <linearGradient id="gate-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--sol-purple)" />
              <stop offset="100%" stopColor="var(--sol-green)" />
            </linearGradient>
          </defs>
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
          <span className="vault-label">{t("stage.vault")}</span>
          <span className="vault-amount" key={`v-${vaultLamports ?? "none"}`}>
            {sol(vaultLamports)}
          </span>
          <span className="vault-judge" aria-live="polite">
            {scanning
              ? t("stage.judging")
              : judgement
                ? `${judgement.decision} ${Math.round(probability * 100)}%`
                : t("stage.threshold")}
          </span>
        </div>
        {judgement && (
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
