# 対応ロードマップ（2026-10-14 時点）

**ゴール：機能として完成した状態を保つ。** 審査向けの作業（#94 Builder updates・#95 面接の準備）は持ち主の判断で行わない（not planned）。状態の正本は [`STATUS.md`](../STATUS.md)、作業の単位は GitHub の Issue。

## 機能の確認（2026-10-14・本番 https://sokketsu.pages.dev ・Pages `88c89073`）

画面にある操作を 1 つずつ本番で流した（Playwright・devnet）。壊れていたのは 1 か所で、#101 で直して本番に出した。

| 操作 | 結果 | 確かめ方 |
|---|---|---|
| 初回の案内（表示・閉じる・「?」で開き直す） | OK | Playwright |
| 言語の切り替え（英 ⇄ 日） | OK。エラーの括弧の中も切り替わる（#90） | Playwright |
| 効果音の切り替え（🔊 ⇄ 🔇） | OK | Playwright |
| お試し（使い捨ての鍵 + faucet 0.12 SOL） | OK | Playwright |
| faucet の連打制限 | OK。「10 分に 1 回まで・あと M:SS」（#74） | Playwright（10-13） |
| 1 件ずつ流す：refund | OK。refund 88% → escrow は refunded、発注者へ返金 | Playwright + オンチェーン |
| 1 件ずつ流す：release | OK。release 86% → settled、受注者へ 0.05 SOL | Playwright + オンチェーン |
| 1 件ずつ流す：hold | OK。hold 91% → open（送金なし） | Playwright + オンチェーン |
| hold の期限の表示 | **直した**（#101）。残り slot が減り、期限後は「回収できる」、回収後は消える | 本番で 391 → 139 slot（60 秒）・回収後 0 件 |
| ⚙ 回収（期限切れ・完了済みの escrow） | OK。`1 refunded · 3 closed`、発注者の残高が戻る | Playwright |
| ⚙ 発注者の切り替え | OK。始める前の画面に戻る | Playwright |
| 鍵を貼って始める | OK（入力欄が開く） | Playwright（中身はローカルのテスト鍵で確認） |
| デモの通し（hold → release） | OK | お試し（10-13）・ウォレット（下） |
| ウォレット接続（本物） | OK。Backpack のアプリ、承認は預け入れの 2 回だけ、確定 1064 / 829 / 986 ms（#80） | 持ち主 + オンチェーン |
| セキュリティヘッダ | OK。CSP・Permissions-Policy・X-Frame-Options、CSP 違反 0（#79） | curl・Playwright |
| Jev の判断（デモトークン付きの `/api/judge`） | OK。hold 99%・release 93%・refund 98%、3 つとも出所 jev・オラクル署名付き・約 0.5 秒 | 本番の API に CLI から送った（#105） |

確かめていないもの：Jev の判断を使ったオンチェーンの通し（settle の経路は mock と同じで、出所の値が jev になるだけ。最後に通したのは 10-12 の動画の撮影）。デモトークンは非公開なので、公開の利用者は mock の判断になる。

## 残り

| やること | 担当 | Issue | いつ |
|---|---|---|---|
| （任意）お試しで使った SOL を faucet に戻す | Claude（出すなら持ち主の承認） | #96 | faucet が 5 SOL を切ったら検討（10-14 時点 30.84 SOL） |
| upgrade authority を放棄するか決める（元に戻せない） | 持ち主 | #81 | 結果発表のあと（2026-11 中旬の見込み） |

## 守ること

- 本番を変えるときは、持ち主の承認 → 本番で確かめる → merge の順（承認は 1 回ごと）
- 作業中に会話ログへ表示された鍵は交換しない。devnet の範囲は許容（#82・not planned）

## 手元の片付け（Issue にしない）

- ~~worktree `../sokketsu-design`~~ → 2026-10-14 に持ち主の承認で消した（変更 0・stash 0・698 MB。中身は main の履歴 `eb32309` にある）
