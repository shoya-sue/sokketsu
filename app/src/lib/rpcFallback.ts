export type RpcRoute = "public" | "fallback";

type Options = {
  fallbackUrl: string;
  getToken: () => string;
  onRoute: (route: RpcRoute) => void;
  baseFetch?: typeof fetch;
};

const shouldFallback = (res: Response) => res.status === 429 || res.status >= 500;

/**
 * 公開 RPC を先に試し、429 / 5xx / 通信失敗のときだけ予備（/api/rpc）へ送り直す fetch。
 * 予備はトークンが要る。トークンが無い、または予備も失敗したら、公開 RPC の結果をそのまま返す。
 */
export function createFallbackFetch({ fallbackUrl, getToken, onRoute, baseFetch }: Options) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const doFetch = baseFetch ?? fetch;
    let primary: Response | null = null;
    let primaryError: unknown = null;
    try {
      primary = await doFetch(input, init);
      if (!shouldFallback(primary)) {
        onRoute("public");
        return primary;
      }
    } catch (e) {
      primaryError = e;
    }

    const token = getToken().trim();
    if (!token) {
      if (primary) return primary;
      throw primaryError;
    }
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    try {
      const fallback = await doFetch(fallbackUrl, { ...init, headers });
      if (fallback.ok) {
        onRoute("fallback");
        return fallback;
      }
      if (primary) return primary;
      return fallback;
    } catch (e) {
      if (primary) return primary;
      throw e;
    }
  };
}
