/** 確定までの内訳。値は整数 ms（タイムラインの表示と一致させる）。 */
export type Breakdown = {
  events: { key: "sent" | "processed" | "finalized"; at: number }[];
  segments: { key: "processed" | "finalized"; from: number; to: number }[];
  windowMs: number;
};

export function breakdown(m: { processedMs: number | null; finalizedMs: number }): Breakdown {
  const finalized = Math.round(m.finalizedMs);
  const processed = m.processedMs === null ? null : Math.round(m.processedMs);
  const events: Breakdown["events"] = [{ key: "sent", at: 0 }];
  const segments: Breakdown["segments"] = [];
  if (processed !== null) {
    events.push({ key: "processed", at: processed });
    segments.push({ key: "processed", from: 0, to: processed });
  }
  events.push({ key: "finalized", at: finalized });
  segments.push({ key: "finalized", from: processed ?? 0, to: finalized });
  return { events, segments, windowMs: Math.max(1000, Math.ceil(finalized / 1000) * 1000) };
}

/** 時刻を x、段階（送信 → processed → finalized）を y にした階段グラフの SVG points。上ほど確定に近い。 */
export function stairPoints(b: Breakdown, width: number, height: number): string {
  const x = (ms: number) => Math.round((ms / b.windowMs) * width);
  const levels = b.events.length - 1;
  const y = (level: number) => Math.round(height - (level / levels) * height);
  const points: string[] = [];
  b.events.forEach((e, i) => {
    if (i > 0) points.push(`${x(e.at)},${y(i - 1)}`);
    points.push(`${x(e.at)},${y(i)}`);
  });
  points.push(`${width},${y(levels)}`);
  return points.join(" ");
}
