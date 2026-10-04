export type JudgeInput = {
  task: string;
  escrow: string; // 署名を結び付ける escrow（base58）
  amountLamports: number;
  payer: string;
  payee: string;
  failCount: number;
  alpenglow: boolean;
};

const MAX_TASK_LENGTH = 200;
const MAX_AMOUNT_LAMPORTS = 10_000_000_000; // 10 SOL
const MAX_FAIL_COUNT = 10_000;
export const MAX_BODY_BYTES = 4 * 1024;

const isBase58Pubkey = (v: unknown): v is string =>
  typeof v === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
const isIntIn = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;

/** 本文をサイズ上限つきで読み、JSON にする。大きすぎる・壊れていれば null。 */
export async function readJsonLimited(request: Request): Promise<unknown> {
  // 申告サイズで先に切る（巨大な本文を読み込まない）。申告が無い・偽りでも読んだあとで再確認する。
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** /api/judge・/api/decide に届いた本文を検証する。不正なら null。 */
export function parseJudgeInput(body: unknown): JudgeInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const ok =
    typeof b.task === "string" &&
    b.task.length > 0 &&
    b.task.length <= MAX_TASK_LENGTH &&
    isBase58Pubkey(b.escrow) &&
    isIntIn(b.amountLamports, 1, MAX_AMOUNT_LAMPORTS) &&
    isBase58Pubkey(b.payer) &&
    isBase58Pubkey(b.payee) &&
    isIntIn(b.failCount, 0, MAX_FAIL_COUNT) &&
    typeof b.alpenglow === "boolean";
  if (!ok) return null;
  return {
    task: b.task as string,
    escrow: b.escrow as string,
    amountLamports: b.amountLamports as number,
    payer: b.payer as string,
    payee: b.payee as string,
    failCount: b.failCount as number,
    alpenglow: b.alpenglow as boolean,
  };
}
