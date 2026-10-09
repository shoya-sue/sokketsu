// コマごとの差分面積（%）から、動きの量の指標を出す純粋関数。

/** これ未満の差分面積のコマを「静止」とみなす（%）。 */
export const STATIC_PCT = 0.3;
/** コマの間がこれより空いたら、別の区間をつないだものとみなして静止の連続を切る（秒）。 */
export const GAP_S = 0.1;

/**
 * @param {{ t: number, pct: number }[]} frames 時刻（秒）と差分面積（%）
 * @returns {{ frames: number, staticRatio: number, meanPct: number, longestStaticS: number, secondsOver1: number }}
 */
export function summarize(frames) {
  if (frames.length === 0) return { frames: 0, staticRatio: 0, meanPct: 0, longestStaticS: 0, secondsOver1: 0 };
  const isStatic = frames.map((f) => f.pct < STATIC_PCT);
  const staticCount = isStatic.filter(Boolean).length;
  const meanPct = frames.reduce((sum, f) => sum + f.pct, 0) / frames.length;

  // 静止が続いた最長の区間。各コマの差分は直前のコマからの変化なので、静止の連続は
  // 最初の静止コマの直前のコマの時刻から数える（先頭や、時刻の空いた直後はそのコマの時刻から）。
  let longest = 0;
  let runStart = null;
  frames.forEach((f, i) => {
    if (i > 0 && f.t - frames[i - 1].t > GAP_S) runStart = null;
    if (isStatic[i]) {
      if (runStart === null) runStart = i === 0 || f.t - frames[i - 1].t > GAP_S ? f.t : frames[i - 1].t;
      longest = Math.max(longest, f.t - runStart);
    } else {
      runStart = null;
    }
  });

  // 1 秒ごとの平均が 1% を超えた秒の数。
  const buckets = new Map();
  for (const f of frames) {
    const s = Math.floor(f.t);
    const b = buckets.get(s) ?? { sum: 0, n: 0 };
    buckets.set(s, { sum: b.sum + f.pct, n: b.n + 1 });
  }
  const secondsOver1 = [...buckets.values()].filter((b) => b.sum / b.n > 1).length;

  return {
    frames: frames.length,
    staticRatio: staticCount / frames.length,
    meanPct,
    longestStaticS: longest,
    secondsOver1,
  };
}

/**
 * 段階の切り替わり（marks）で区切って集計する。同じ名前の区間はまとめる。
 * @param {{ t: number, pct: number }[]} frames
 * @param {{ label: string, at: number }[]} marks 段階の切り替わり（順不同でよい）
 */
export function bySegment(frames, marks) {
  const groups = new Map();
  // 印は記録の都合で前後することがある（afterglow は後から足す）ので、時刻順に並べてから区切る。
  const ordered = [...marks].sort((a, b) => a.at - b.at);
  ordered.forEach((m, i) => {
    const end = i + 1 < ordered.length ? ordered[i + 1].at : Infinity;
    if (end <= m.at || m.label === "end") return;
    const inRange = frames.filter((f) => f.t >= m.at && f.t < end);
    groups.set(m.label, [...(groups.get(m.label) ?? []), ...inRange]);
  });
  return [...groups.entries()].map(([label, fs]) => ({ label, ...summarize(fs) }));
}

const pct = (x) => `${(x * 100).toFixed(0)}%`;

/** 結果を Markdown の表にする。 */
export function formatTable(result) {
  const head = "| 区間 | コマ数 | 静止（<0.3%） | 平均の差分面積 | 最長の静止 | 1% 超の秒 |\n|---|---|---|---|---|---|";
  const row = (label, s) =>
    `| ${label} | ${s.frames} | ${pct(s.staticRatio)} | ${s.meanPct.toFixed(2)}% | ${s.longestStaticS.toFixed(2)} s | ${s.secondsOver1} |`;
  return [
    `${result.url} · ${result.mode} · ${result.viewport}${result.reducedMotion ? " · reduced-motion" : ""}`,
    "",
    head,
    row("全体", result.overall),
    ...result.segments.map((s) => row(s.label, s)),
  ].join("\n");
}
