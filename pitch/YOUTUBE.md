# YouTube に載せる文面

公開範囲は「限定公開（URL を知っている人）」か「公開」。審査員が見られれば、どちらでもよい。

## 1. ピッチ動画（`video/sokketsu-pitch.mp4`・2:07）

**Thumbnail**：`pitch/assets/youtube-thumb-pitch.jpg`（1280×720）

**Title**

```
Sokketsu — Stop agent payments with typed decisions (Solana · Colosseum Crypto World's Fair pitch)
```

**Description**

```
Sokketsu is a typed-decision escrow on Solana. Instead of asking an LLM for a paragraph, it asks Jev, a typed judge, for a decision (release / hold / refund) and a probability. Our oracle signs the decision, and the Anchor program verifies the Ed25519 signature on-chain before any lamport moves. Funds go to the payee only when a signed release clears 70%.

Measured on Alpenglow devnet: 858 ms from send to finalized — about 15x faster than Tower BFT (~12.8 s). Every number in this video comes from a real devnet transaction.

▶ Try it live: https://sokketsu.pages.dev
💻 Code (MIT): https://github.com/shoya-sue/sokketsu
🛠 Technical demo: TECH_DEMO_URL

0:00 Hook — 12.8 s vs 858 ms
0:14 Problem — prose can't stop a payment
0:31 How it works
0:51 Live demo on devnet (hold → release)
1:28 Measured
1:39 Why Solana
1:54 Try it

Built for the Colosseum Crypto World's Fair hackathon.

#Solana #AIagents #Colosseum #Alpenglow #Anchor #Escrow #Hackathon #Web3
```

## 2. 技術デモ動画（`pitch/sokketsu-tech-demo.mp4`・2:34）

**Thumbnail**：`pitch/assets/youtube-thumb-tech.jpg`（1280×720）

**Title**

```
Sokketsu technical demo — oracle-signed typed decisions verified on-chain (Solana · Anchor)
```

**Description**

```
Technical walkthrough of Sokketsu, a typed-decision escrow on Solana devnet.

- Architecture: the wallet signs only the deposit; an in-page operator key sends settle. Cloudflare Pages Functions call Jev (typed judge) or a mock fallback, and an oracle signs the result with ed25519.
- Program: deposit / settle / refund / close. settle pays only on a signed release with probability ≥ 7000 bps.
- Signed decisions: an 88-byte message ("sokketsu-decision-v3" ‖ escrow ‖ sha256(request) ‖ decision ‖ probability_bps ‖ source). settle checks the Ed25519 instruction right before it — otherwise BadOracleSignature.
- Who can settle: a Jev decision can be submitted by anyone; a mock decision only by the payer or its operator key.
- Finality measured in the browser with WebSocket signatureSubscribe: 858 ms to finalized.
- Tests: 14 anchor tests, 554 vitest tests.

▶ Try it live: https://sokketsu.pages.dev
💻 Code (MIT): https://github.com/shoya-sue/sokketsu
🎬 Pitch video: PITCH_VIDEO_URL
Program (devnet): Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp

0:00 Overview & architecture
0:28 On-chain program
0:47 Signed decisions & Ed25519 verification
1:12 Live demo on devnet
1:49 Who can settle
2:05 Measuring finality
2:17 Tests & links

#Solana #Anchor #Ed25519 #AIagents #Colosseum #Rust #TypeScript #Web3
```

## メモ

- YouTube の章は各 10 秒以上が必要。技術デモの冒頭（8 秒）とリンク（6.7 秒）は隣とまとめた
- 章の時刻は `video/sokketsu-pitch.timeline.json` と `pitch/build.mjs` の各ページの長さから出した（ピッチ：hook 14.2・problem 17.2・flow 20.0・demo 36.9・numbers 11.5・solana 15.1・close 12.3 秒 / 技術デモ：8.0・19.3・19.4・25.1・36.9・15.6・12.4・11.4・6.7 秒）
- タグの欄が無いので、ハッシュタグを説明文の最後に入れた（空白なし・15 個以下。最初の 3 個がタイトルの上に出る）
- YouTube の説明文には `<` と `>` を使えない。`TECH_DEMO_URL` / `PITCH_VIDEO_URL` は、2 本とも上げた後にもう片方の URL へ置き換える（説明文は後から編集できる）
