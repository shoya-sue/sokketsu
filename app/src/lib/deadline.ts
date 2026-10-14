/**
 * hold した escrow の期限までの残り slot。期限を過ぎたら 0。どちらかが分からなければ null。
 * hold の時点で 1 回だけ計算すると減らないので（#101）、期限の slot を持ち、表示のたびにいまの slot から計算する。
 */
export const slotsUntil = (deadline: number | null, current: number | null): number | null =>
  deadline === null || current === null ? null : Math.max(0, deadline - current);
