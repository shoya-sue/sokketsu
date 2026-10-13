# Sokketsu 作業状況（2026-10-13 時点）

## 結論

ハッカソンへの提出は済んだ（2026-10-12 18:44 PDT = 10-13 10:44 JST・締切の約 5 時間前）。本番は main `eb32309` の Pages `709f08ee`。その後の main の変更はアプリの外（LICENSE・`pitch/`・`video/`・README）だけなので、本番の再デプロイは要らない。残りは審査後に持ち主が決める事項だけ。

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
| サイト | https://sokketsu.pages.dev — Pages `709f08ee`（Production・main `eb32309`）。2026-10-13 に HTTP 200 を確認 |
| devnet プログラム | `Fuceqdwk2uxT2nNREHC5QJiwKU9uwcnRqdnXD7bHiUwp`。upgrade authority は未放棄（2026-10-07 の記録。以後 upgrade していない） |
| faucet | `53jRBxa8R67DExTqUiykwzgJtVKNnyevNxYuTYEEJm7j`、残高 1.79995 SOL（2026-10-13 実測・お試し約 15 回分）。足りなくなったらこのアドレスへ devnet SOL を送る |
| Cloudflare | Kojin アカウント（`CLOUDFLARE_ACCOUNT_ID` の既定は別アカウントなので、wrangler では指定が要る） |

## 審査後に持ち主が決めること

- upgrade authority の放棄（元に戻せない。審査が終わってから）
- 作業中に出力に表示された鍵の交換（Helius キーほか。対象は持ち主が把握している）
- 審査中は本番・faucet・devnet プログラムをそのまま動かしておく

## 環境メモ

- act：arm64 では x86_64 の Anchor バイナリが動かない。anchor ジョブは GitHub Actions で確認する
- Pages の secret は再デプロイしないと反映されない
- 公開 devnet faucet は 429 がほとんど。faucet の補充は手元の鍵から送る
- 動画の作り直しは `video/README.md`・`pitch/README.md` の手順で
