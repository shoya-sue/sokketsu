import { msg, type Msg } from "./i18n";

export type DecisionName = "release" | "hold" | "refund";

export type JudgeInput = {
  task: string;
  escrow: string; // 署名を結び付ける escrow（base58）
  amountLamports: number;
  payer: string;
  payee: string;
  failCount: number;
  alpenglow: boolean;
};

/** オラクル（Pages Function）の署名。settle の直前の Ed25519 命令に載せ、プログラムが検証する。 */
export type Proof = {
  bps: number;
  signature: string; // 64 バイト（hex）
  publicKey: string; // 32 バイト（hex）
};

/** 判断の出所。オラクルの署名に含まれ、プログラムが escrow に記録する。 */
export type SourceName = "jev" | "mock";
/** lib.rs の SOURCE_JEV / SOURCE_MOCK と同じ値。 */
export const SOURCE_CODE: Record<SourceName, number> = { jev: 1, mock: 2 };

export type JudgeOutput = {
  decision: DecisionName;
  probability: number; // 0..1。選ばれた選択肢の確率
  source: SourceName;
  proof?: Proof; // 署名が無ければ、オンチェーンで拒否される
};

export interface Judge {
  evaluate(input: JudgeInput): Promise<JudgeOutput>;
}

const DECISIONS: readonly DecisionName[] = ["release", "hold", "refund"];

const FALLBACK_REASON: Record<number, string> = {
  401: "fallback.http401",
  503: "fallback.http503",
  502: "fallback.http502",
  400: "fallback.http400",
};

export function mockDecision(task: string): JudgeOutput {
  if (task.startsWith("hold:")) return { decision: "hold", probability: 0.91, source: "mock" };
  if (task.startsWith("refund:")) return { decision: "refund", probability: 0.88, source: "mock" };
  return { decision: "release", probability: 0.86, source: "mock" };
}

export const mockJudge: Judge = {
  evaluate: async (input) => mockDecision(input.task),
};

export function toBps(probability: number): number {
  return Math.round(probability * 10000);
}

const isHex = (v: unknown, bytes: number): v is string =>
  // Stryker disable next-line ConditionalExpression: 文字列以外は length が合わず false になる。typeof は型を絞るためだけ
  typeof v === "string" && v.length === bytes * 2 && /^[0-9a-f]+$/i.test(v);

/**
 * 署名の形（hex の長さ）だけを見る。bps の型と範囲は、呼び出し側で「bps === toBps(確率)」かつ確率が 0〜1 であることを
 * 確かめるので、ここでは重ねて見ない（文字列の "9300" は数値と一致しない）。
 */
function parseProof(raw: unknown): Proof | null {
  // オブジェクト以外（文字列・数値）は、取り出した項目が undefined になり isHex で弾かれる。null と undefined だけ先に弾く。
  if (raw == null) return null;
  const { bps, signature, publicKey } = raw as Record<string, unknown>;
  if (!isHex(signature, 64) || !isHex(publicKey, 32)) return null;
  return { bps: bps as number, signature, publicKey };
}

/** 署名付きの判断として読めなければ null。source は呼んだ口（jev / mock）と一致すること。 */
function parseSigned(body: unknown, source: JudgeOutput["source"]): JudgeOutput | null {
  // オブジェクト以外は、取り出した項目が undefined になり以降の検査で弾かれる。null と undefined だけ先に弾く。
  if (body == null) return null;
  const b = body as Record<string, unknown>;
  if (!DECISIONS.includes(b.decision as DecisionName)) return null;
  if (typeof b.probability !== "number" || b.probability < 0 || b.probability > 1) return null;
  if (b.source !== source) return null;
  const proof = parseProof(b.proof);
  if (!proof || proof.bps !== toBps(b.probability)) return null;
  return { decision: b.decision as DecisionName, probability: b.probability, source, proof };
}

const post = (url: string, input: JudgeInput, token?: string) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });

/**
 * 判断を取る。
 * 1. トークンがあれば /api/judge（Jev・署名付き）
 * 2. だめなら理由を知らせ、/api/decide（サーバ側のモック判断・署名付き）
 * 3. それもだめなら署名なしのモック（オンチェーンでは拒否される）
 */
export function createJudge(getToken: () => string, onFallback: (reason: Msg) => void): Judge {
  return {
    evaluate: async (input) => {
      const token = getToken().trim();
      if (!token) {
        onFallback(msg("fallback.noToken"));
      } else {
        try {
          const res = await post("/api/judge", input, token);
          if (res.ok) {
            const signed = parseSigned(await res.json(), "jev");
            if (signed) return signed;
            onFallback(msg("fallback.badResponse"));
          } else {
            const known = FALLBACK_REASON[res.status];
            onFallback(known ? msg(known) : msg("fallback.http", { status: res.status }));
          }
        } catch (e) {
          onFallback(msg("fallback.network", { error: e instanceof Error ? e.message : String(e) }));
        }
      }

      try {
        const res = await post("/api/decide", input);
        if (res.ok) {
          const signed = parseSigned(await res.json(), "mock");
          if (signed) return signed;
        }
      } catch {
        // 下の署名なしモックへ
      }
      return mockDecision(input.task);
    },
  };
}
