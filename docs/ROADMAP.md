# 対応ロードマップ（2026-10-14 時点）

提出（2026-10-12 18:44 PDT）から結果発表、その後までにやることの一覧。状態の正本は [`STATUS.md`](../STATUS.md)、作業の単位は GitHub の Issue。

## 前提（一次情報）

| 項目 | 内容 | 出典 |
|---|---|---|
| 結果発表 | 提出締切のおよそ 1 か月後（**2026-11 中旬の見込み**）。日付は未発表で、ダッシュボードに出る | https://colosseum.com/hackathon 「announced roughly one month after the submission deadline」・https://colosseum.com/arena/hackathon「Results have not been published yet」 |
| 審査の流れ | 複数回の選考 → 審査員 → さらに絞って **15 分の Zoom 面接** → 入賞の決定 | https://colosseum.com/hackathon |
| 評価の観点 | Founder + Market Fit・Insight・Product + Execution（改善を出す速さを含む）・Potential Market Size・Founder Communication・Viability・Traction | 同上 |
| 提出後に書ける欄 | Builder updates（提出物は変わらない）・Live product link など一部 | ダッシュボード（2026-10-14 確認） |
| 本番 | https://sokketsu.pages.dev — Pages `6c3a63fe`（main と同じツリー） | `STATUS.md` |
| faucet | 31.08 SOL（お試し約 258 回分。2026-10-14 に持ち主が 30 SOL 補充） | `solana balance -u devnet 53jRBxa8R67DExTqUiykwzgJtVKNnyevNxYuTYEEJm7j` |

## 1. 審査中（〜結果発表）

**本番・faucet・devnet プログラムは止めない。** 本番を変えるときは、持ち主の承認 → 本番で確かめる → merge の順（承認は 1 回ごと）。

| # | やること | 担当 | Issue | いつ | 終わりの確かめ方 |
|---|---|---|---|---|---|
| 1-1 | 本物のウォレット（Solflare）で、預け入れ → hold → release を通す | 持ち主（devnet の SOL は `4g2L…oWfS` から送れる） | #80 | 今週 | 画面右の履歴（ウォレット名・取引・確定ミリ秒）を #80 に貼る |
| 1-2 | Builder updates を週 1 回出す。下書きは Claude、投稿は持ち主 | Claude → 持ち主 | #94 | 10-14・10-21・10-28・11-04・11-11 ごろ | `pitch/BUILDER-UPDATES.md` に文面、#94 に投稿日 |
| 1-3 | 15 分の Zoom 面接の準備（7 観点の想定質問と答え・デモの手順・弱い点への答え） | Claude → 持ち主が通し練習 | #95 | 10 月中 | `pitch/INTERVIEW.md` があり、#95 に練習した日 |
| 1-4 | 本番が動いているかを週 1 回見る（HTTP 200・お試しが通る・faucet の残高） | Claude | — | Builder updates と同じ日 | `curl` と `solana balance` の結果を #94 のコメントに添える |
| 1-5 | （任意）お試しで使った SOL を faucet に戻す | Claude（出すなら持ち主の承認） | #96 | faucet が 5 SOL を切ったら検討 | #96 の提案を実装するかを決める |

## 2. 結果発表のあと

| # | やること | 担当 | Issue | 終わりの確かめ方 |
|---|---|---|---|---|
| 2-1 | upgrade authority を放棄するか決める（元に戻せない） | 持ち主 | #81 | `solana program show` の Authority の行と判断を #81 に |
| 2-2 | 結果を `STATUS.md` と Obsidian に記録する | Claude | 発表後に起票 | 結果の画面の URL と順位が `STATUS.md` にある |
| 2-3 | 続けるか決める（入賞・Accelerator なら mainnet に向けた計画、そうでなければ公開を続けるか止めるか） | 持ち主 | 発表後に起票 | 決めた方針が `STATUS.md` にある |
| 2-4 | 止めるなら片付ける（本番・faucet の残高・プログラムの扱い） | Claude（持ち主の承認） | 2-3 で決める | — |

## 決めたこと（やらないこと）

- 作業中に会話ログへ表示された鍵は交換しない。devnet の範囲は許容（#82・not planned）。値は手元の会話ログから消した
- Phantom は持ち主の Chrome に無いので、#80 は Solflare で行う

## 手元の片付け（Issue にしない）

- worktree `../sokketsu-design`（#56 の作業場所・`eb32309` で止まったまま・変更なし）は不要。消すかは持ち主が決める
