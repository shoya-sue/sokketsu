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
    crypto.subtle.timingSafeEqual(b, b);
    return false;
  }
  return crypto.subtle.timingSafeEqual(a, b);
}

/** Authorization: Bearer <token> が DEMO_TOKEN と一致するか。DEMO_TOKEN 未設定なら常に false。 */
export function isAuthorized(request: Request, demoToken: string | undefined): boolean {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  return Boolean(demoToken && token && tokenMatches(token, demoToken));
}
