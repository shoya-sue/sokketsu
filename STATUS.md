# Sokketsu 作業状況（2026-10-14 時点）

## 結論

ハッカソンへの提出は済んだ（2026-10-12 18:44 PDT = 10-13 10:44 JST・締切の約 5 時間前）。提出後の 10-13 に、実測で見つけた残作業を #74〜#90 として起票し、#81 以外を閉じた（#80 は 10-14 に持ち主が Backpack で済ませた）。10-14 に本番の全操作を確かめ、壊れていた 1 か所（#101）を直した。本番は main と同じツリーの Pages `88c89073`。ゴールは機能として完成した状態を保つこと（[`docs/ROADMAP.md`](docs/ROADMAP.md)）。残りは任意の #96 と、審査後の判断 #81。

## 提出先

| 項目 | 内容 |
|---|---|
| ハッカソン | Colosseum Crypto World's Fair（Payments & Remittance）— https://colosseum.com/arena/projects/17163/submission |
| 締切 | 2026-10-12 23:59 PT = 2026-10-13 15:59 JST（公式ルール「5. Timing」） |
| 状態 | **Submitted**（October 12, 2026 at 6:44 PM PDT・"Your project is entered for judging."）。チーム・説明・動画・アンケートはロック済み。Live product link など一部の欄だけ編集できる |

## 提出物（2026-10-13 に提出画面で確認）

| 欄 | 提出したもの | リポジトリ |
|---|---|---|
| Demo video（3 分以内・実画面） | https://www.youtube.com/watch?v=o4CSw7txkWo | `pitch/sokketsu-demo.mp4`（56.2 秒） |
| Pitch video（2 分以内・自己紹介つき） | https://www.youtube.com/watch?v=QC_3TBrA9Zw | `video/sokketsu-pitch-short.mp4`（103.7 秒） |
| GitHub | https://github.com/shoya-sue/sokketsu | — |
| Live product | https://sokketsu.pages.dev（ログイン不要・「Try it」で使い捨ての devnet 鍵） | `app/` |
| 説明・技術・チェーン・チーム・所在地 | 入力済み（Submission profile: Complete） | 文面は `pitch/SUBMISSION.md` |
| ロゴ・X profile・Telegram | 入力済み | `pitch/assets/` |

提出外（README からリンク）：技術デモ動画 https://youtu.be/nxYCGoRqyPk（`pitch/sokketsu-tech-demo.mp4`）・YouTube ショート https://youtube.com/shorts/ABic4f27Ac4（`pitch/sokketsu-short.mp4`）・スライド `pitch/sokketsu-deck.pdf`。

## 本番

| 項目 | 状態 |
|---|---|
| サイト | https://sokketsu.pages.dev — Pages `88c89073`（Production・`592ccd8`、main とツリーが同じ）。2026-10-14 に HTTP 200 を確認。応答に CSP・Permissions-Policy・X-Frame-Options（#79） |
| devnet プログラム | `Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp`。Authority はデプロイ用の鍵 `CcVM…3UPk`、最後の upgrade は slot 508309128（2026-10-07）のまま（10-13 に `solana program show` で確認） |
| escrow | 135 口座（発注者 17）。open 66 件・計 3.396 SOL はすべて期限切れの hold（お試しの使い捨て鍵が戻り先なので、refund しても faucet には戻らない）（10-13 実測） |
| faucet | `53jRBxa8R67DExTqUiykwzgJtVKNnyevNxYuTYEEJm7j`、残高 30.83991 SOL（2026-10-14 実測。同日に持ち主が 30 SOL 補充・お試し約 257 回分。1 回 0.12 SOL で戻らない）。足りなくなったらこのアドレスへ devnet SOL を送る（持ち主が送る） |
| Cloudflare | Kojin アカウント（`CLOUDFLARE_ACCOUNT_ID` の既定は別アカウントなので、wrangler では指定が要る） |

## 2026-10-13 提出後の対応（実測から起票）

| Issue | 内容 | 結果 |
|---|---|---|
| #74 | お試しの 2 回目で faucet の制限に当たると「応答しなかった」と出た | 制限であることと残り時間（あと M:SS）を出す。キャッシュの記録が 10 分を過ぎても残っていたので、予約の時刻で制限を解く |
| #75 | Pages のプレビュー環境 16 件 | 削除（持ち主の承認）。残り 0 件 |
| #76 / #86 | npm・cargo audit | 件ごとに判断して `docs/audit/static-audit.md` に記録。mocha 12・wrangler 4.149 に更新 |
| #77 | 初回の JS が gzip 301.8 kB | 195.9 kB（ウォレット一式・anchor・紙吹雪を遅延読み込み、Buffer の二重読み込みを解消） |
| #78 | `chain.ts` のカバレッジ 24% | 92.8% |
| #79 | セキュリティヘッダが無い | CSP・Permissions-Policy・X-Frame-Options |
| #82 | 作業中に表示された鍵 | 交換しない（持ち主の判断・devnet の範囲は許容）。手元の会話ログから値を消した |
| #90 | 言語を切り替えるとエラーの括弧の中が前の言語のまま | 描画時の言語で訳し直す |
| #94・#95 | Builder updates・面接の準備 | 行わない（持ち主の判断・ゴールは機能の完成） |
| #101 | hold の残り slot が減らず、回収後も案内が残る（10-14 の機能の確認で発見） | 期限の slot を持って毎回計算、回収で消す。本番 `88c89073` で確認 |

## 持ち主の操作・判断を待つもの

これからの作業と、本番の機能の確認表は [`docs/ROADMAP.md`](docs/ROADMAP.md)。

- ~~#80：本物のウォレットで通す~~ → **済み**（2026-10-14・Backpack のアプリ。ウォレットの承認は預け入れの 2 回だけ、確定 1064 / 829 / 986 ms）
- #81：upgrade authority を放棄するか（元に戻せない。審査後。#82 で鍵を変えないので、放棄の前の upgrade は要らない）
- 審査中は本番・faucet・devnet プログラムをそのまま動かしておく

## 環境メモ

- act：arm64 では x86_64 の Anchor バイナリが動かない。anchor ジョブは GitHub Actions で確認する
- Pages の secret は再デプロイしないと反映されない
- 公開 devnet faucet は 429 がほとんど。faucet の補充は手元の鍵から送る
- 本番へのデプロイは `CLOUDFLARE_ACCOUNT_ID=<Kojin> npx wrangler pages deploy dist --project-name sokketsu --branch main`（持ち主の承認が要る）
- 動画の作り直しは `video/README.md`・`pitch/README.md` の手順で
