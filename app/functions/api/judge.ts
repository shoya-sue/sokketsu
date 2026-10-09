/// <reference types="@cloudflare/workers-types" />
import { isAuthorized, json } from "../../server/auth";
import { parseJudgeInput, readJsonLimited, type JudgeInput } from "../../server/judgeInput";
import { signDecision, type DecisionName } from "../../server/oracle";

interface Env {
  AI_GATEWAY_API_KEY?: string;
  DEMO_TOKEN?: string;
  ORACLE_SECRET_KEY?: string;
}

const DECISIONS: readonly DecisionName[] = ["release", "hold", "refund"];
const EVALUATE_URL = "https://ai-gateway.vercel.sh/v1/evaluate";
const MODEL_ID = "typesafe-ai/jev";
// TypeSafe 本体の API（https://docs.typesafe.ai/api.md）。答えの形は Gateway と同じ。
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_MODEL_ID = "jev-latest";
const GATEWAY_TIMEOUT_MS = 8000;

/** choice の質問 1 つを投げる。Vercel AI Gateway と TypeSafe で同じ形（choice + probabilities）が返る。 */
function callJev(url: string, model: string, key: string, input: JudgeInput): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      state: input,
      questions: {
        decision: {
          type: "choice",
          instructions:
            "この小口払いを今すぐ受注者へ解放してよいか。材料不足や明示的な hold / refund 指示ならそれに従え。",
          criteria: {
            release: "依頼が成立しており、今すぐ受注者へ解放してよい",
            hold: "材料不足、または明示的な hold 指示がある",
            refund: "明示的な refund 指示がある、または依頼が成立しない",
          },
        },
      },
    }),
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
  });
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!isAuthorized(request, env.DEMO_TOKEN)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.AI_GATEWAY_API_KEY || !env.ORACLE_SECRET_KEY) {
    return json({ error: "jev unavailable" }, 503);
  }

  const input = parseJudgeInput(await readJsonLimited(request));
  if (!input) return json({ error: "bad request" }, 400);

  try {
    // まず Vercel AI Gateway。キーを拒否されたら（TypeSafe で発行したキーの可能性）、同じキーで TypeSafe へ直接。
    // 貼り付け時に混ざる前後の空白・改行を除く。
    const key = env.AI_GATEWAY_API_KEY.trim();
    let res = await callJev(EVALUATE_URL, MODEL_ID, key, input);
    let route = "vercel-ai-gateway";
    if (res.status === 401) {
      res = await callJev(TYPESAFE_URL, TYPESAFE_MODEL_ID, key, input);
      route = "typesafe-direct";
    }
    if (!res.ok) {
      console.error("jev error", route, res.status, await res.text());
      return json({ error: "jev failed" }, 502);
    }
    console.log("jev ok", route);
    const body = (await res.json()) as {
      answers?: { decision?: { choice?: string; probabilities?: Record<string, number> } };
    };
    const answer = body.answers?.decision;
    const decision = answer?.choice as DecisionName | undefined;
    const probability = decision ? answer?.probabilities?.[decision] : undefined;
    if (
      !decision ||
      !DECISIONS.includes(decision) ||
      typeof probability !== "number" ||
      probability < 0 ||
      probability > 1
    ) {
      console.error("jev unexpected answer", JSON.stringify(body.answers));
      return json({ error: "jev failed" }, 502);
    }
    // オンチェーンで検証できるよう、判断にオラクルの署名を付ける。
    const proof = await signDecision(env.ORACLE_SECRET_KEY, input.escrow, input.task, decision, probability);
    return json({ decision, probability, source: "jev", proof }, 200);
  } catch (e) {
    console.error("jev request failed", e);
    return json({ error: "jev failed" }, 502);
  }
};
