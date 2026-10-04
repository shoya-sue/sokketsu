/// <reference types="@cloudflare/workers-types" />
import { json } from "../../server/auth";
import { parseJudgeInput, readJsonLimited } from "../../server/judgeInput";
import { signDecision } from "../../server/oracle";
import { mockDecision } from "../../src/judge";

interface Env {
  ORACLE_SECRET_KEY?: string;
}

/**
 * モック判断（企画書第7節の規則）をサーバ側で出し、オラクルの署名を付けて返す。
 * Jev が使えないときもオンチェーンの署名検証を通すため。判断はサーバが決めるので、
 * クライアントが判断や確率を書き換えた取引はプログラムに拒否される。
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ORACLE_SECRET_KEY) return json({ error: "oracle unavailable" }, 503);
  const input = parseJudgeInput(await readJsonLimited(request));
  if (!input) return json({ error: "bad request" }, 400);
  const decided = mockDecision(input.task);
  try {
    const proof = await signDecision(
      env.ORACLE_SECRET_KEY,
      input.escrow,
      input.task,
      decided.decision,
      decided.probability,
    );
    return json({ ...decided, proof }, 200);
  } catch (e) {
    console.error("oracle signing failed", e);
    return json({ error: "oracle failed" }, 500);
  }
};
