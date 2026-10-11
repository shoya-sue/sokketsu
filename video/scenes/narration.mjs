// 発表動画の英語ナレーション（読み上げる文）。数値はすべて撮影データ（run.json）から入れ、作った数字は言わない。

const pctOf = (text) => {
  const m = /(\d+(?:\.\d+)?)%/.exec(text ?? "");
  return m ? Math.round(Number(m[1])) : null;
};

const atPct = (p) => (p === null ? "." : `, at ${p} percent.`);

/**
 * @param {object} run capture.mjs の run.json
 * @returns {{ hook: string, problem: string, flow: string, numbers: string, solana: string, close: string, demo: { mark: string, nth: number, text: string }[] }}
 */
export function narrationFor(run) {
  const ms = Math.round(run.result.finalizedMs);
  const hold = pctOf(run.timeline?.find((e) => e.label === "Decision: hold")?.detail);
  const release = pctOf(run.finality?.decision);
  return {
    hook:
      `On Solana's old consensus, Tower BFT, a payment took about twelve point eight seconds to finalize. ` +
      `On Alpenglow, we measured ${ms} milliseconds. This is Sokketsu: agent payments that don't wait.`,
    problem:
      "AI agents are starting to pay for work. But ask a language model whether to release an escrow, " +
      "and you get a paragraph: probably fine, but to be safe. A program can't act on prose. " +
      "Sokketsu asks Jev, a typed judge, which returns only a decision and a probability.",
    flow:
      "Here's how it works. The payer deposits SOL into a program-owned vault. Jev decides: release, hold, or refund. " +
      "Our oracle signs that decision, and the Anchor program verifies the Ed25519 signature on-chain. " +
      "Funds move only when a signed release clears a seventy percent threshold.",
    demo: [
      { mark: "onboard", nth: 0, text: "This is the live app on devnet. First-time visitors get a three-card walkthrough." },
      {
        mark: "start",
        nth: 0,
        text: "We start a trial. The page creates a throwaway key and funds it from our devnet faucet, so there is no private key to paste.",
      },
      {
        mark: "depositing",
        nth: 0,
        text: `First request: hold. Jev says hold${atPct(hold)} The vault locks, and not a single lamport moves.`,
      },
      {
        mark: "countdown",
        nth: 0,
        text: `Next, a delivered job. The payer verified the work, so Jev returns release${atPct(release)}`,
      },
      { mark: "released", nth: 0, text: `The program checks the oracle's signature and pays out. Finalized in ${ms} milliseconds.` },
    ],
    numbers:
      `${ms} milliseconds from send to finalized. About ${run.result.speedup} times faster than Tower BFT. ` +
      "These measurements come from real devnet transactions you can open in the explorer.",
    solana:
      "Why Solana? Alpenglow gives sub-second finality, so the decision and the payment settle together. " +
      "Native Ed25519 verification lets the program trust a signed judgment cheaply. And fees stay at a fraction of a cent.",
    close:
      "Sokketsu is live on devnet today. Connect a wallet, approve once, and watch an agent payment stop, or settle, " +
      "in under a second. Try it at sokketsu dot pages dot dev. Thank you.",
  };
}
