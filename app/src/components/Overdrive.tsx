import { useEffect, useState } from "react";
import { hexDump, recentBlocks, timecode } from "../lib/overdrive";
import { DataRain } from "./DataRain";
import { DotMark } from "./DotMark";
import type { Phase } from "../lib/phase";

type BackProps = {
  slot: number | null;
  tone: readonly [string, string];
  /** 変わるたびに全レイヤーを一度に光らせる（確定の瞬間）。 */
  hitKey: number | null;
  /** 舞台に見えている段階。点の格子のマークがこれに合わせて灯る。 */
  phase?: Phase;
};

const BAND_A = "即決 · SOKKETSU · FINALITY < 1 S · ";
const BAND_B = "TYPED DECISION · ED25519 · ON-CHAIN · 70% · ";
const SEAL = "SOKKETSU · INSTANT-DECISION ESCROW · ALPENGLOW DEVNET · SUB-SECOND FINALITY · ";
const CHAIN_N = 9;

/** 帯の文字を十分な長さに繰り返す（2 回並べて半分ずらすと継ぎ目なく流れる）。 */
const repeat = (s: string, n: number) => Array.from({ length: n }, () => s).join("");

/**
 * 画面の奥に何重にも重ねる演出（#56）。奥から順に、Solana のグラデーションの回転光・六角形の格子・
 * Sokketsu マークの透かし（3 枚・逆回転）・斜めに流れる巨大な文字の帯・データの雨・確定の閃光。
 * どの層も色調（--tone-a / --tone-b）と段階の強さ（--od-energy）に従う。Solana の公式ロゴはここに使わない。
 */
export function OverdriveBack({ slot, tone, hitKey, phase = "idle" }: BackProps) {
  // ティッカーを画面の端から端まで出すため、縦のスクロールバーの幅を CSS に渡す（100vw はそれを含んではみ出す）。
  useEffect(() => {
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--od-sbw", `${window.innerWidth - root.clientWidth}px`);
    measure();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    ro?.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return (
    <div className="od-back" aria-hidden="true">
      <div className="od-aurora" />
      <div className="od-leak" />
      <div className="od-hex" />
      <div className="od-beams">
        <i />
        <i />
        <i />
      </div>
      <div className="od-seal">
        <svg viewBox="-500 -500 1000 1000">
          <defs>
            <path id="od-seal-path" d="M0,-440 a440,440 0 1,1 0,880 a440,440 0 1,1 0,-880" />
          </defs>
          <circle r="470" />
          <circle r="410" />
          <text>
            <textPath href="#od-seal-path">{SEAL + SEAL}</textPath>
          </text>
        </svg>
      </div>
      <div className="od-marks">
        <img className="od-mark od-mark-1" src="/logo-mark.svg" alt="" />
        <img className="od-mark od-mark-2" src="/logo-mark.svg" alt="" />
        <DotMark phase={phase} />
        <div className="od-orbit od-orbit-1" />
        <div className="od-orbit od-orbit-2" />
      </div>
      <div className="od-bands">
        <div className="od-band od-band-a">
          <span>{repeat(BAND_A, 6)}</span>
          <span>{repeat(BAND_A, 6)}</span>
        </div>
        <div className="od-band od-band-b">
          <span>{repeat(BAND_B, 6)}</span>
          <span>{repeat(BAND_B, 6)}</span>
        </div>
      </div>
      <DataRain slot={slot} tone={tone} />
      <pre className="od-dump od-dump-tr">{hexDump(slot, 6).join("\n")}</pre>
      <pre className="od-dump od-dump-bl">{hexDump(slot === null ? null : slot + 1, 6).join("\n")}</pre>
      <div className="od-chain">
        {recentBlocks(slot, CHAIN_N).map((b) => (
          <span className="od-block" key={b}>
            <b>BLOCK</b>
            {b}
          </span>
        ))}
      </div>
      {hitKey !== null && <div className="od-flash" key={hitKey} />}
    </div>
  );
}

type FrontProps = {
  slot: number | null;
  /** 段階の強さ（0〜1）。右下の計器に出す。 */
  energy: number;
  phase: string;
};

/**
 * 画面の手前に重ねる演出（#56）。走査線とノイズ、四隅の HUD 枠と目盛り、計器の読み。クリックは素通しする。
 */
export function OverdriveFront({ slot, energy, phase }: FrontProps) {
  return (
    <div className="od-front" aria-hidden="true">
      <div className="od-vignette" />
      <div className="od-scan" />
      <div className="od-glitch" />
      <div className="od-glitch od-glitch-2" />
      <div className="od-corner od-corner-tl" />
      <div className="od-corner od-corner-tr" />
      <div className="od-corner od-corner-bl" />
      <div className="od-corner od-corner-br" />
      <div className="od-ruler od-ruler-l" />
      <div className="od-ruler od-ruler-r" />
      <div className="od-readout od-readout-tl">
        <RecClock />
        <span>SOKKETSU//OVERDRIVE</span>
        <span>{`PHASE ${phase.toUpperCase()}`}</span>
      </div>
      <div className="od-readout od-readout-br">
        <span>{slot === null ? "SLOT ——" : `SLOT ${slot}`}</span>
        <span className="od-meter">
          {`ENERGY ${Math.round(energy * 100)}%`}
          <i style={{ ["--od-meter" as string]: `${Math.round(energy * 100)}%` }} />
        </span>
      </div>
    </div>
  );
}

/** 右上の REC ランプと、開いてからの経過のタイムコード。 */
function RecClock() {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => setMs(performance.now() - t0), 100);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="od-rec">
      <i />
      REC <span>{timecode(ms)}</span>
    </span>
  );
}

/** 横に流れ続けるティッカー。項目を 2 回並べて半分ずらすと継ぎ目なく流れる。 */
export function Ticker({ items, reverse = false }: { items: readonly string[]; reverse?: boolean }) {
  const row = items.map((s, i) => (
    <span className="od-tick" key={i}>
      {s}
    </span>
  ));
  return (
    <div className={`od-ticker ${reverse ? "is-reverse" : ""}`} aria-hidden="true">
      <div className="od-ticker-track">
        <div className="od-ticker-row">{row}</div>
        <div className="od-ticker-row">{row}</div>
      </div>
    </div>
  );
}

/**
 * Solana の公式ロゴ（配布元の SVG をそのまま）。ブランド規約に従い、変形・影・縁取り・ほかの図像との重ね合わせをせず、
 * 周りに余白を取って 1 か所だけ置く。https://solana.com/branding
 */
export function SolanaLogo({ label }: { label: string }) {
  return (
    <div className="solana-logo-zone">
      <img className="solana-logo" src="/brand/solana-logo.svg" alt={label} width={646} height={96} />
    </div>
  );
}
