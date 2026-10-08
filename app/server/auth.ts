/// <reference types="@cloudflare/workers-types" />

export const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

function tokenMatches(given: string, expected: string): boolean {
  const enc = new TextEncoder();
  const a = enc.encode(given);
  const b = enc.encode(expected);
  if (a.byteLength !== b.byteLength) {
    // 長さ違いでも同じだけ比較してから false を返し、時間差を小さくする。
    // Stryker disable next-line CallExpression: 時間差をならすためだけの呼び出しで、戻り値は使わない（テストで観測できない）
    crypto.subtle.timingSafeEqual(b, b);
    return false;
  }
  return crypto.subtle.timingSafeEqual(a, b);
}

/** Authorization: Bearer <token> が DEMO_TOKEN と一致するか。DEMO_TOKEN 未設定なら常に false。 */
export function isAuthorized(request: Request, demoToken: string | undefined): boolean {
  // Stryker disable next-line StringLiteral: ヘッダが無いときの既定値。どの文字列でも Bearer で始まらなければ同じ結果
  const auth = request.headers.get("Authorization") ?? "";
  if (!demoToken || !auth.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length);
  // 空のトークンは長さが合わないので tokenMatches が false を返す。
  return tokenMatches(token, demoToken);
}
