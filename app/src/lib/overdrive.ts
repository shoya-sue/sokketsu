/** 何重にも重ねる演出レイヤー（#56）。描画は components/Overdrive.tsx・DataRain.tsx、ここは計算だけ。 */
import type { Phase } from "./phase";
import { median } from "./stats";

/** Tower BFT の確定までの目安（ミリ秒）。比較の表示に使う。 */
export const TOWER_BFT_MS = 12_800;

const ENERGY: Record<Phase, number> = {
  idle: 0.35,
  depositing: 0.6,
  judging: 0.85,
  holding: 0.7,
  stopped: 0.7,
  releasing: 0.9,
  released: 1,
  refunding: 0.75,
  refunded: 0.8,
  error: 0.5,
};

/** 段階ごとのレイヤーの強さ（0〜1）。CSS の --od-energy に渡し、光・速さ・濃さをこれで上げる。 */
export const energyOf = (phase: Phase): number => ENERGY[phase];

type TickerInput = {
  phase: Phase;
  slot: number | null;
  /** 直近の確定ミリ秒（新しい順）。 */
  lastMs: readonly number[];
};

/** 上下に流すティッカーの項目。実測の値（slot・確定ミリ秒）と仕組みの決まり文句を並べる。 */
export function tickerItems({ phase, slot, lastMs }: TickerInput): string[] {
  const items: string[] = [`PHASE ${phase.toUpperCase()}`];
  if (slot !== null) items.push(`SLOT ${slot.toLocaleString("en-US")}`);
  const last = lastMs[0];
  if (last !== undefined) {
    items.push(`LAST FINALITY ${last} MS`, `×${Math.round(TOWER_BFT_MS / last)} VS TOWER BFT`);
    items.push(`MEDIAN ${Math.round(median(lastMs) as number)} MS`);
  }
  items.push("THRESHOLD 70%", "ED25519 VERIFIED ON-CHAIN", "TYPED DECISIONS", "ALPENGLOW · DEVNET");
  return items;
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * データの雨の 1 列ぶんの文字。乱数が 0.5 未満なら slot の数字を順に、以上なら base58 の 1 文字を入れる。
 * slot が無ければ base58 だけ。
 */
export function rainGlyphs(slot: number | null, n: number, rand: () => number): string[] {
  const digits = slot === null ? "" : String(slot);
  return Array.from({ length: n }, (_, i) => {
    const r = rand();
    if (digits && r < 0.5) return digits[i % digits.length];
    return BASE58[Math.floor(r * BASE58.length) % BASE58.length];
  });
}

export type Drop = { x: number; y: number; speed: number; len: number };

/** 雨の列の間隔（px）と、落ちる速さ（px/秒）の範囲。 */
export const RAIN_COL_PX = 22;
export const DROP_MIN_SPEED = 40;
export const DROP_MAX_SPEED = 160;

/** 幅 w・高さ h の画面に雨の列を並べる。rand は 0..1 を返す関数（テストでは固定列を渡す）。 */
export function seedDrops(w: number, h: number, rand: () => number): Drop[] {
  return Array.from({ length: Math.floor(w / RAIN_COL_PX) }, (_, i) => ({
    x: i * RAIN_COL_PX + RAIN_COL_PX / 2,
    y: rand() * h,
    speed: DROP_MIN_SPEED + rand() * (DROP_MAX_SPEED - DROP_MIN_SPEED),
    len: 6 + Math.floor(rand() * 14),
  }));
}

/** dt 秒ぶん落とした新しい列を返す。下を抜けた列は上の画面外から出直す。 */
export function stepDrops(drops: readonly Drop[], dt: number, h: number): Drop[] {
  return drops.map((d) => {
    const y = d.y + d.speed * dt;
    return { ...d, y: y > h ? -d.len * RAIN_COL_PX : y };
  });
}

/** 画面の下を流れるブロックの帯に出す slot（古い順に n 個、最新が最後）。0 より前は出さない。 */
export function recentBlocks(slot: number | null, n: number): number[] {
  if (slot === null) return [];
  const from = Math.max(0, slot - n + 1);
  return Array.from({ length: slot - from + 1 }, (_, i) => from + i);
}

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, "0");

/**
 * 四隅に出す 16 進ダンプ（rows 行・各行 8 バイト）。slot から決まる擬似乱数で埋める（同じ slot なら同じ中身）。
 * 飾りなので暗号的な意味は無い。
 */
export function hexDump(slot: number | null, rows: number): string[] {
  let x = ((slot ?? 0) ^ 0x9e3779b9) >>> 0;
  const next = () => {
    if (slot === null) return 0;
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x >>> 24;
  };
  return Array.from({ length: rows }, (_, r) => {
    const addr = (r * 8).toString(16).toUpperCase().padStart(4, "0");
    const bytes = Array.from({ length: 8 }, () => hex2(next())).join(" ");
    return `${addr} ${bytes}`;
  });
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 経過ミリ秒を 時:分:秒:コマ（30 コマ/秒）のタイムコードにする。 */
export function timecode(ms: number): string {
  const t = Math.max(0, ms);
  const frames = Math.floor(((t % 1000) * 30) / 1000);
  const s = Math.floor(t / 1000);
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}:${pad2(frames)}`;
}
