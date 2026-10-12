# 提出フォームの文面（Colosseum・#64）

提出項目は Colosseum の公式ページ（https://colosseum.com/hackathon 、2026-10-11 に確認）に合わせた。英語の文面はそのまま貼れる。Team・Location は GitHub のプロフィールとコミット履歴、Demand validation は devnet の取引履歴（2026-10-12 に `solana transaction-history` で確認）だけから書いた。

| 項目 | 中身 | 状態 |
|---|---|---|
| ピッチ動画（2〜3 分） | `video/sokketsu-pitch.mp4`（127.1 秒・1920×1080・60fps） | 公開リポジトリの URL（下の Links・開けることを確認済み）。GitHub は大きいファイルを再生プレビューしない（ダウンロードで見られる）ので、YouTube に上げ直して差し替えるのを推奨 |
| 技術デモ動画（3 分以内） | `pitch/sokketsu-tech-demo.mp4`（154.6 秒・1920×1080・60fps） | 同上 |
| GitHub | https://github.com/shoya-sue/sokketsu （public） | 済み |
| ロゴ・画像 | ロゴ `pitch/assets/logo-1024.png`（1024×1024・透過）・英語のバナー `pitch/assets/og-en-1200x630.png`・表紙 `pitch/assets/cover-1920x1080.png` | 済み（サイトの `app/public/og.png` は日本語のまま） |
| スライド（任意） | `pitch/sokketsu-deck.pdf`（10 ページ）・`pitch/slides.html` | 済み |
| チームと経歴・所在地 | 下の「Team」「Team location」 | 済み（経歴を足すなら追記） |
| 需要の検証 | 下の「Demand validation」 | 済み（検証の実績が出たら追記） |

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
- Pitch video: https://github.com/shoya-sue/sokketsu/blob/main/video/sokketsu-pitch.mp4
- Technical demo: https://github.com/shoya-sue/sokketsu/blob/main/pitch/sokketsu-tech-demo.mp4
- Slides (PDF): https://github.com/shoya-sue/sokketsu/blob/main/pitch/sokketsu-deck.pdf

## Go-to-market strategy (plan)

Start where agents already pay for work: agent marketplaces and task platforms that escrow a payment for a job done by an AI agent and need a release rule they can audit. We distribute Sokketsu as an open-source Anchor program plus a small API (`/api/judge` returns a signed, typed decision), so a platform can add "release only on a verifiable decision" in one transaction without building its own judge or signer.

## Distribution plan (plan)

1. Open-source the program and API (already public) with a one-page integration guide.
2. Reach builders where agent payments are discussed: Solana and AI-agent developer communities, hackathon follow-ups, and integrations with agent frameworks.
3. Before mainnet: verify the model provider's own signature on-chain (today we verify our oracle's signature), freeze the program's upgrade authority, and get an audit.

## Demand validation

Honest status: Sokketsu is at the working-prototype stage. No external user interviews or pilots are recorded for this project yet.

What we can show today:

- A live product anyone can try without a wallet: https://sokketsu.pages.dev ("Try it" funds a throwaway devnet key).
- 348 devnet transactions to the program and 11 faucet transactions so far (as of 2026-10-12, from devnet RPC history). Most of these come from our own end-to-end tests and demo captures, so we do not count them as external demand.

How we will validate next:

1. Show the demo to teams building agent marketplaces and task platforms in the Solana and AI-agent developer communities, and ask whether "release only on a verifiable decision" would replace their current manual approval step.
2. Offer a free devnet integration (program + `/api/judge`) to the first teams, and measure how many escrows they settle through Sokketsu.

## Team

SHO — solo builder (GitHub [@shoya-sue](https://github.com/shoya-sue), X [@be_into_net](https://x.com/be_into_net)). Designed and built everything in this repository between 2026-10-04 and 2026-10-12 (85 commits): the Anchor program, the oracle signer, the Cloudflare Pages Functions, the React app, and the pitch and technical demo videos. Claude Code was used as a coding assistant.

## Team location

Japan

---

## 提出前に持ち主がやること

1. 動画を YouTube などに上げ直すなら、上の Links の URL を差し替える（今は公開リポジトリの URL）
2. Team に経歴を足すなら追記する（今は GitHub のプロフィールとコミット履歴にある事実だけ）
3. Colosseum のダッシュボードで締切（公式ページの表記は「Sep 14 — Oct 12」、時刻は未確認）と項目を確かめ、チームを登録して提出する
4. ナレーションを一度聞いて確かめる（「Sokketsu」「Ed25519」の読み方。未確認）
