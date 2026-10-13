# YouTube に載せる文面

公開範囲は「限定公開（URL を知っている人）」か「公開」。審査員が見られれば、どちらでもよい。

## Colosseum の提出フォームとの対応（2026-10-12 にフォームの文言で確認）

| フォームの欄 | 要件 | 入れる動画 |
|---|---|---|
| Please submit a demo video of your product | 3 分以内。実際のプロダクトを見せる（スライド・コードの説明は不可） | **A. デモ動画** `pitch/sokketsu-demo.mp4`（56 秒） |
| Pitch video | 2 分以内。デモ動画とは別。自己紹介・何を作っているか・なぜ自分たちか | **B. ピッチ動画（短い版）** `video/sokketsu-pitch-short.mp4`（1:44・103.7 秒） |

下の 1・2（2:07 のピッチ動画・技術デモ動画）は欄の要件に合わないので、提出フォームには使わない（補足として説明文やリポジトリから見られればよい）。

## A. デモ動画（`pitch/sokketsu-demo.mp4`・0:56）— 公開済み https://youtu.be/o4CSw7txkWo

**Thumbnail**：`pitch/assets/youtube-thumb-pitch.jpg`

**Title**

```
Sokketsu live demo — stop or settle an agent payment on Solana devnet in under a second
```

**Description**

```
Live product demo of Sokketsu on Solana devnet, recorded on the real site with no edits to the numbers.

1. A first-time visitor sees a three-card walkthrough, then starts a trial: the page creates a throwaway devnet key and funds it from our faucet.
2. Hold: Jev, a typed judge, returns hold at 99%. The vault locks and not a single lamport moves.
3. Release: Jev returns release at 97%. The program verifies the oracle's Ed25519 signature and pays out, finalized in 858 ms.
4. The same release on Solana Explorer: success, finalized, the payee receives 0.05 SOL, and the Ed25519 signature check runs right before our program.

▶ Try it live: https://sokketsu.pages.dev
💻 Code (MIT): https://github.com/shoya-sue/sokketsu

0:00 Live app on devnet: hold, then release
0:37 The release on Solana Explorer

#Solana #AIagents #Colosseum #Alpenglow #Anchor #Escrow #Web3
```

## B. ピッチ動画・短い版（`video/sokketsu-pitch-short.mp4`・1:44・103.7 秒）— 公開済み https://youtu.be/QC_3TBrA9Zw

**Thumbnail**：`pitch/assets/youtube-thumb-pitch.jpg`

**Title**

```
Sokketsu — Stop agent payments with typed decisions (Colosseum Crypto World's Fair pitch, 2 min)
```

**Description**

```
I'm SHO, a solo builder from Japan. During the Colosseum Crypto World's Fair I built Sokketsu, a typed-decision escrow on Solana: an AI judge returns a choice and a probability, an oracle signs it, and the Anchor program verifies the Ed25519 signature on-chain before a single lamport moves. On Alpenglow devnet a release reached finalized in 858 ms, about 15x faster than Tower BFT.

▶ Try it live: https://sokketsu.pages.dev
💻 Code (MIT): https://github.com/shoya-sue/sokketsu
🎬 Live demo: https://youtu.be/o4CSw7txkWo

0:00 12.8 s vs 858 ms
0:15 Who is building this
0:28 Problem — prose can't stop a payment
0:45 How it works
1:05 Measured on devnet
1:17 Why Solana
1:32 Try it

#Solana #AIagents #Colosseum #Alpenglow #Anchor #Escrow #Hackathon #Web3
```

## C. ショート（`pitch/sokketsu-short.mp4`・0:56・縦 1080×1920）— 公開済み https://youtube.com/shorts/ABic4f27Ac4（2026-10-13 時点のタイトルは B のもの。C のタイトルに変えると紛らわしくない）

提出フォームには使わない（任意）。YouTube は縦長・60 秒以内の動画を自動でショートとして扱う。

**Title**

```
An AI decides, Solana settles in 858 ms — Sokketsu live demo #shorts
```

**Description**

```
A typed AI decision stops or releases an escrow on Solana devnet. The oracle-signed decision is verified on-chain before any lamport moves, and the release reaches finalized in 858 ms.

▶ Try it: https://sokketsu.pages.dev
💻 Code (MIT): https://github.com/shoya-sue/sokketsu

#shorts #Solana #AIagents #Colosseum #Web3
```

## 1. ピッチ動画（`video/sokketsu-pitch.mp4`・2:07）— 公開済み https://youtu.be/odzsFW4E_NU

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
🎬 Pitch video: https://youtu.be/odzsFW4E_NU
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
- YouTube の説明文には `<` と `>` を使えない。`DEMO_VIDEO_URL` / `TECH_DEMO_URL` / `PITCH_VIDEO_URL` は、2 本とも上げた後にもう片方の URL へ置き換える（説明文は後から編集できる）
