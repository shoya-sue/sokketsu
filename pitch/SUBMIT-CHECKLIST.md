# 提出の手順（2026-10-13）

**締切：2026-10-13（火）15:59 JST**（= 2026-10-12 23:59 PT。公式ルール「5. Timing」）。主催者の時計が正式なので、遅くとも 15:00 までに出す。

残りは「動画 2 本をアップロード → フォームの 2 欄に貼る → 提出」だけ。文面は `pitch/YOUTUBE.md` からコピーする。

## 0. 準備

```sh
cd ~/Public/shoya-sue/solana-hackathon-sokketsu && git switch main && git pull
```

## 1. YouTube に 2 本アップロードする（公開範囲は「公開」か「限定公開」。「非公開」は不可）

| # | ファイル | タイトル・説明文 | サムネイル |
|---|---|---|---|
| A | `pitch/sokketsu-demo.mp4`（0:56） | `pitch/YOUTUBE.md` の「A. デモ動画」 | `pitch/assets/youtube-thumb-pitch.jpg` |
| B | `video/sokketsu-pitch-short.mp4`（1:44・103.7 秒） | `pitch/YOUTUBE.md` の「B. ピッチ動画・短い版」 | `pitch/assets/youtube-thumb-pitch.jpg` |

- 説明文に `<` `>` を入れない（YouTube が受け付けない）
- B の説明文の `DEMO_VIDEO_URL` は、A を上げた後に A の URL へ置き換える
- 上げたら、ログインしていないウィンドウで 2 本とも再生できることを確かめる

## 2. Colosseum のフォームに貼る

https://colosseum.com/arena/hackathon/project/editor?section=media

| 欄 | 入れるもの |
|---|---|
| Please submit a demo video of your product | **A の URL** |
| Pitch video | **B の URL**（A と別の URL になっていること） |

ほかの欄（ロゴ・GitHub・リポジトリの説明・Live product link・Access instructions・X profile）は 2026-10-12 時点で入力済み・Project details / Media and code / Team は Complete。

## 3. 提出する

1. 右側の「Review and submit」を開き、内容を確かめる
2. 最後のアンケートに答えて提出する
3. 「Final submission」が submitted になったことを確かめる

## 4. 提出後（任意）

A・B の URL を Claude に送れば、`pitch/SUBMISSION.md` と README の動画リンクを差し替えて main に入れる。

## 参考：動画の確認済みの事実

| ファイル | 長さ | 中身 |
|---|---|---|
| `pitch/sokketsu-demo.mp4` | 56.2 秒・1920×1080・60fps | 本番の画面（案内 → お試し → hold 99% → release 97%・finalized 858 ms）+ Solana Explorer の同じ取引（Success・Finalized・受注者 +0.05 SOL・Ed25519 の検証命令）。文字起こしで不適切な語 0 |
| `video/sokketsu-pitch-short.mp4` | 1:44・103.7 秒・1920×1080・60fps | 掴み → 自己紹介（SHO・日本・1 人で・9 日間）→ 課題 → 仕組み → 計測 → Why Solana → 締め |
