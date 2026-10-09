# 書体とロゴ（#47）

## 書体

候補 4 組（今・A アーケード・B サイバー・C スポーツ中継）を、実際の画面の部品で並べた見本（`font-specimen.png`、元は `tools/brand/font-specimen.html`）をレビューし、組ではなく役割ごとに選んだ。

| 役割 | 書体 | 理由 |
|---|---|---|
| ワードマーク・32px 以上の告知（STOPPED・LEVEL UP・大当たり） | Dela Gothic One | 極太でパチンコ台のロゴのような押し出し。小さいと潰れるので大きい場所だけ |
| 見出し・ボタン（16〜28px） | RocknRoll One | 弾む形で、小さくても字の形が保たれる |
| 数字（確定ミリ秒・カウントダウン・HUD・残高） | Unbounded（700 / 900） | 幅広の極太で、得点表示の勢いが一番出た |
| 計器のラベル（SCORE・COMBO・h2） | Chakra Petch 600（大文字・字間広め） | 角ばってゲームの計器らしい |
| 本文・小さいラベル | M PLUS 1p（400 / 500 / 700） | 癖がなく小さくても読める |
| 等幅（slot・JSON・アドレス） | Share Tech Mono | 本物の等幅。ゼロに斜線 |

外したもの: Orbitron（「7」が鉤の形で一瞬で読めない）、Rajdhani（細く高揚感が弱い）、JetBrains Mono・Space Grotesk・Noto Sans JP（地味に見える原因）。

ライセンス: すべて Google Fonts の SIL Open Font License 1.1。CSS から Google Fonts を読み込む（`app/src/index.css` の先頭）。

## ロゴ

- マーク: `app/public/logo-mark.svg`（favicon も同じ）。金庫の 12 片の判断リングを稲妻が貫く。図形だけで、書体に頼らない
- 画面のロゴは `app/src/components/Logo.tsx`（インラインの SVG）で動かす（`logo-motion.png` は 0.2 秒ごとの 24 コマ）
  - リングが回り続け、その上を 1 片ぶんの光が逆向きに周回する
  - 稲妻が 2.4 秒ごとに光って跳ねる
  - ワードマークは光が流れ続け、4 秒ごとに色ずれのグリッチが走る
  - 確定の瞬間はマークが叩かれて跳ね、ワードマークが白く飛ぶ
  - reduced-motion ではグローバルの規則で止まる
- OGP 画像: `app/public/og.png`（1200×630）。作り直しは `node tools/brand/og.mjs`

画面の確認: `app-1280x900.png`・`app-390x844.png`（はみ出し・折り返しの崩れなし）。
