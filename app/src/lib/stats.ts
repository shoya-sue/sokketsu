export type Sample = { ms: number; at: number; label: string };

export const HISTORY_SIZE = 5;

/** 中央値。空なら null。 */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 新しい計測を先頭に足し、直近 HISTORY_SIZE 件だけ残す（元の配列は変えない）。 */
export function pushSample(history: readonly Sample[], sample: Sample): Sample[] {
  return [sample, ...history].slice(0, HISTORY_SIZE);
}

/** すべてサブ秒（1000ms 未満）か。空なら false。 */
export function allSubSecond(history: readonly Sample[]): boolean {
  return history.length > 0 && history.every((s) => s.ms < 1000);
}

/** localStorage から読んだ値を検証して Sample[] に戻す。壊れていれば空。 */
export function parseHistory(raw: string | null): Sample[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (s): s is Sample =>
          typeof s === "object" &&
          s !== null &&
          typeof (s as Sample).ms === "number" &&
          Number.isFinite((s as Sample).ms) &&
          typeof (s as Sample).at === "number" &&
          typeof (s as Sample).label === "string",
      )
      .slice(0, HISTORY_SIZE);
  } catch {
    return [];
  }
}
