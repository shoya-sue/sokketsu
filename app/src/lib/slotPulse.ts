/** slot を受け取った時刻の列に 1 つ足す（新しい配列を返す）。max を超えたら古いものから捨てる。 */
export function pushSlotTime(times: readonly number[], now: number, max = 32): number[] {
  // slice(-max) は max 件以下ならそのまま、超えたら末尾 max 件を返す。
  return [...times, now].slice(-max);
}

/**
 * slot ごとに 1 つ山が立つ心電図風の SVG path。右端が now、幅 width が windowMs ぶん。
 * 山は「少し前で上がり、直後に下がって戻る」4 点で描く。
 */
export function pulsePath(times: readonly number[], now: number, width: number, height: number, windowMs: number): string {
  const mid = height / 2;
  const parts = [`M0,${mid}`];
  const visible = times.filter((t) => now - t <= windowMs && t <= now).sort((a, b) => a - b);
  for (const t of visible) {
    const x = Math.round(width - ((now - t) / windowMs) * width);
    parts.push(`L${x - 3},${mid}`, `L${x},${Math.round(height * 0.1)}`, `L${x + 3},${Math.round(height * 0.9)}`, `L${x + 6},${mid}`);
  }
  parts.push(`L${width},${mid}`);
  return parts.join(" ");
}
