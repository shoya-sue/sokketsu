# 提出フォームの文面（Colosseum・#64）

提出項目は Colosseum の公式ページ（https://colosseum.com/hackathon 、2026-10-11 に確認）に合わせた。英語の文面はそのまま貼れる。**`TODO（持ち主）` の項目は事実を持っていないので空けてある。必ず埋めてから提出する。**

| 項目 | 中身 | 状態 |
|---|---|---|
| ピッチ動画（2〜3 分） | `video/sokketsu-pitch.mp4`（127.1 秒・1920×1080・60fps） | YouTube などに上げて URL を貼る（未実施） |
| 技術デモ動画（3 分以内） | `pitch/sokketsu-tech-demo.mp4`（154.6 秒・1920×1080・60fps） | 同上（未実施） |
| GitHub | https://github.com/shoya-sue/sokketsu （public） | 済み |
| ロゴ・画像 | `pitch/assets/logo-1024.png`（1024×1024・透過）・`app/public/og.png`（1200×630） | 済み |
| スライド（任意） | `pitch/sokketsu-deck.pdf`（10 ページ）・`pitch/slides.html` | 済み |
| チームと経歴・所在地 | 下の「Team」 | **TODO（持ち主）** |
| 需要の検証 | 下の「Demand validation」 | **TODO（持ち主）** |

---

## Product name

Sokketsu

## One-liner

Stop agent payments with typed decisions, not generated text — and settle them in under a second on Solana.

## Description

Sokketsu is an escrow on Solana for payments made by or to AI agents. Instead of asking an LLM for a paragraph and hoping a program can act on "probably fine", Sokketsu asks Jev, a typed judge, which returns only a decision (`release` / `hold` / `refund`) and a probability. Our oracle signs that decision together with the escrow address and a hash of the request, and the Anchor program verifies the Ed25519 signature on-chain before anything moves. Funds go to the payee only when a signed `release` clears a 70% threshold; `hold` stops the payment without moving a lamport.

Users approve once: the wallet signs only the deposit, and an in-page operator key sends the settlement. Visitors without a wallet can press "Try it" to get a throwaway devnet key funded from our faucet. The page measures finality live — on Alpenglow devnet the release reached `finalized` in 858 ms, about 15× faster than Tower BFT's ~12.8 s.

## How it works

1. **Deposit** — the payer locks SOL in an escrow PDA with a deadline and a hash of the request.
2. **Decide** — `/api/judge` calls Jev (or a mock fallback) and returns a choice and a probability.
3. **Sign** — the oracle signs `"sokketsu-decision-v3" ‖ escrow ‖ sha256(request) ‖ decision ‖ probability_bps ‖ source`.
4. **Verify & settle** — `settle` checks that the previous instruction is the Ed25519 program with the oracle's key and this exact message, then pays only on `release` ≥ 7000 bps. Missing, altered, re-used or re-sourced signatures fail with `MissingOracleSignature` / `BadOracleSignature`.
5. **Who can settle** — a Jev decision can be submitted by anyone (the payer can't block a valid release); a mock decision only by the payer or its operator key (`UnauthorizedSubmitter`). Refund and close always return funds to the payer.

## Blockchains and tools

- **Solana** devnet (Alpenglow), Anchor 0.31, native Ed25519 program + instructions sysvar
- Program: `Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp` (devnet)
- Frontend: React 19, Vite, `@solana/web3.js`, Solana wallet adapter
- Backend: Cloudflare Pages Functions (`/api/judge`, `/api/decide`, `/api/fund`, `/api/rpc`)
- Judge: Jev by TypeSafe (typed decisions), with a mock fallback
- Finality measurement: WebSocket `signatureSubscribe` (processed / finalized)
- Testing: 14 anchor tests, 554 vitest tests, Stryker mutation testing, GitHub Actions CI

## Links

- Live: https://sokketsu.pages.dev
- Code: https://github.com/shoya-sue/sokketsu
- Pitch video: TODO（持ち主：アップロード後の URL）
- Technical demo: TODO（持ち主：アップロード後の URL）

## Go-to-market strategy (plan)

Start where agents already pay for work: agent marketplaces and task platforms that escrow a payment for a job done by an AI agent and need a release rule they can audit. We distribute Sokketsu as an open-source Anchor program plus a small API (`/api/judge` returns a signed, typed decision), so a platform can add "release only on a verifiable decision" in one transaction without building its own judge or signer.

## Distribution plan (plan)

1. Open-source the program and API (already public) with a one-page integration guide.
2. Reach builders where agent payments are discussed: Solana and AI-agent developer communities, hackathon follow-ups, and integrations with agent frameworks.
3. Before mainnet: verify the model provider's own signature on-chain (today we verify our oracle's signature), freeze the program's upgrade authority, and get an audit.

## Demand validation

TODO（持ち主）：話した相手・反応・試用の数など、実際にあった事実だけを書く。無ければ「まだ無い。提出後に◯◯で検証する」と書く。

## Team

TODO（持ち主）：メンバー全員の名前・役割・経歴（GitHub: shoya-sue ほか）。

## Team location

TODO（持ち主）

---

## 提出前に持ち主がやること

1. ピッチ動画と技術デモ動画をアップロードし、URL を上の Links に貼る
2. Team・Team location・Demand validation を埋める
3. Colosseum のダッシュボードで締切（公式ページの表記は「Sep 14 — Oct 12」、時刻は未確認）と項目を確かめ、チームを登録して提出する
4. ナレーションを一度聞いて確かめる（「Sokketsu」「Ed25519」の読み方。未確認）
