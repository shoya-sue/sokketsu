# 即決エスクロー（Sokketsu）企画書

Claude Code への実装依頼用。この文書の「必須」だけを作り、「やらない」は実装しない。

- 文書バージョン: 2026-10-03（Fable / Grok レビュー反映版）
- 対象クラスタ: Solana devnet（Alpenglow 稼働済み）
- 想定作業: 自前プログラム + 1ページのWeb + Jev判断
- 主語: エージェントの小口払いを、文章生成ではなく型付き判断で止め、確定時間をその場で測る

## 1. 一言

発注者が SOL を金庫に預ける。Jev が `release` / `hold` / `refund` のいずれかを確率つきで返す。自前プログラムは、その選択と閾値を満たすときだけ受注者へ解放する。画面は判断、確率、`finalized` までのミリ秒、`getAgGenesisCert` の slot を並べる。

## 2. 背景（ピッチで使う事実だけ）

2026年10月3日時点の Solana 勉強会資料に基づく。実装の根拠であり、アプリ内に長い解説は置かない。

- メインネットのスロットは 250ms。Alpenglow は devnet / testnet のみ。mainnet は観察期間のあと。250ms は mainnet の数字で、devnet のスロット時間としては言わない。
- devnet は 2026-09-25 に Alpenglow へ切り替え。最初の slot は 504148999。確定の目標は約 150ms。confirmed と finalized は同じものとして扱う。
- 移行判定は `getAgGenesisCert`。証明書オブジェクトなら移行済み、`null` なら未移行、`-32601` は不明。日付やバージョン文字列では判定しない。証明書の `block.slot` は移行した最初の slot（固定値）で、現在の slot ではない。
- Tower BFT の finalized 目安は約 12.8秒。これはラベルとしてだけ置き、mainnet へは送らない。
- ブロックハッシュ有効期間は 150 ブロックのまま。スロット短縮により秒数としては短くなっている。12.8秒前提のタイムアウトは使わない。
- 画面の finalized ミリ秒は、ブラウザ→公開 RPC の往復とポーリング間隔を含む値。150ms とは一致しない。ピッチでは「12.8秒との比較」として言う。
- Transaction V1（最大 4,096 バイト）とレント引き下げは口頭補足。必須実装に入れない。

## 3. 誰の何を解くか

AI エージェントへの都度払いは、判断が自由文なのでプログラムが解釈を誤り、払ったあとも finalized まで秒単位で止まる。Jev は選択肢と確率しか返さない。Alpenglow devnet は確定がサブ秒を狙っている。この二つを1件の支払いに接続する。

審査員への一文: 「エージェントの払いは、文章生成ではなく型付き判断で止め、確定は Alpenglow の devnet で測った。」

## 4. スコープ

### 必須

- Anchor プログラム `sokketsu`。命令は `deposit` / `settle` / `refund` / `close` の4つ。
- devnet へデプロイし、program id をフロントの定数にする。
- Vite + React + TypeScript の1ページ。Cloudflare Pages に置く。
- 起動時に devnet RPC へ `getAgGenesisCert` を JSON-RPC で呼ぶ。
- 支払い1件を、預ける → 判断 → 条件を満たせば解放 → `finalized` ミリ秒、の順で通す。
- Jev が使えないときは同じ型のモックを返す。判断の形は先に固定する。
- Pages Function `/api/judge`。トークン照合で 401、キー未設定で 503 を返し、フロントはそのときモックへ落ちる（第7節）。
- 判断のオンチェーン署名検証（2026-10-03 追加）。オラクル（Pages Function）が判断に ed25519 で署名し、`settle` は直前の Ed25519 検証命令を読んでオラクル公開鍵・判断・確率を照合する（第6節・第7節）。
- 日本語 UI（英語へ切り替え可）。

### あれば足す（必須が動いてから）

- `/api/judge` から Jev（`typesafe-ai/jev`）を実際に呼んで判断を得ること。必須は「呼べなければモック」まで。**実装済み。有効なキーの登録待ち。**

実装済みの追加（2026-10-03）:

- 直近5件の計測と中央値（第8節）。
- 受注者を発注者から決定的に導く（第5節2）。
- 英語表示への切り替え（第8節）。
- 公開 RPC の障害時だけ使う予備 RPC（`/api/rpc`、第8節）。
- ゲーム要素: レベル・スコア・コンボ・ランク・実績・効果音（第8節）。
- `hold` を引くデモは、第5節の自動再生に組み込み済み。

### やらない

- mainnet 送金、実在株式、配当、トークン発行、自動売買。
- Jev（モデル提供者）自身の署名の検証。オンチェーンで検証するのは、自前のオラクル（Pages Function）の署名まで。オラクルが Jev の答えを正しく中継していることは、オラクルを信頼する前提とする。
- Transaction V1 の 4,096 バイト対応、アドレス照合表、インデクサ、Geyser。
- ウォレットアダプタ（Phantom 含む）。署名はページ内 keypair だけ。
- 12.8秒の確認待ち。計測の打ち切りは 3秒。

## 5. 体験

操作は極限まで減らし、動きを見せることに振る（2026-10-03 改訂）。人がする操作は「鍵を貼る」「▶ を押す」の2つだけ。

1. ページを開くと、移行判定と証明書の `block.slot`（移行最初の slot）、現在の slot が出る。現在の slot は WebSocket の `slotSubscribe` で進むたびに更新する。
   - 証明書あり: `Alpenglow`。再生ボタン有効。
   - `null`: 「この RPC では Alpenglow を確認できない」と出し、再生ボタンを無効にする。
   - `-32601` / 通信失敗 / 5秒で応答なし: `不明` と警告を出す。再生ボタンは有効のまま（審査中の RPC 不調でデモを止めない）。
2. 発注者の秘密鍵（base58 または solana-keygen の JSON 配列）を貼った瞬間に読み込む。読み込みのボタンは置かない。受注者 keypair は同時に、発注者の秘密鍵から決定的に導く（seed = sha256(発注者の秘密鍵 ‖ "sokketsu-payee-v1")）。同じ発注者なら毎回同じ受注者になり、残高が積み上がる。発注者の鍵があれば受注者の鍵も作り直せる。補助として「airdrop で作る」リンクがあり、失敗（429 など）したら理由を出して貼り付けへ誘導する。
3. 舞台は 発注者 → 金庫 PDA → 受注者 の3ノード。金庫には Jev の判断リング（閾値 70% の目盛り）が付く。
4. 「▶ デモを流す」を押すと、hold → release を自動で連続実行する。間に6秒のカウントダウンを挟む。各依頼は次の順で進む。
   1. 依頼文はプリセット（`hold: wait` / `devnet ping for agent task` / `refund: cancel`）の末尾に `#xxxx` を付けたもの。金額は 0.05 SOL 固定。
   2. `deposit`。コインが 発注者 → 金庫 へ流れる。
   3. Jev またはモックが判断する。リングが回って判断中を示し、判断が出ると確率まで満ちる。
   4. 判断に応じて1つの取引を送る。
      - `release` かつ確率 >= 0.70: `settle(1, bps)`。コインが 金庫 → 受注者 へ流れ、紙吹雪が出る。
      - `refund` かつ確率 >= 0.70: 1つの取引に `settle(3, bps)` と `refund()` の2命令を入れる。コインが 金庫 → 発注者 へ戻る。
      - それ以外（`hold`、または閾値未満）: `settle(decision, bps)` で判断だけ記録し、送金しない。金庫に錠が掛かり STOPPED のスタンプが出る。この escrow は以後判断できない。資金は期限後に ⚙ →「回収」で戻す。
   5. 送金した取引だけ計測する。`sendRawTransaction` 直前の `performance.now()` から processed / finalized を観測した時刻までのミリ秒を出す。比較ラベルは `Tower BFT の finalized 目安 12.8秒`。値の横に「公開 RPC 往復込み」と添える。
   6. 確定が時間内に観測できない取引は成功扱いにしない。再生を止め、タイムラインに tx へのリンクと共に出す。
5. hold / release / refund を1件だけ流すチップも小さく置く。
6. タイムラインに、各段の実測時刻と Explorer の tx リンクを上から流す。1回の再生の中では hold → release を続けて残す。
7. ⚙（設定）には Jev トークン入力、「期限切れ・完了済みの escrow を回収」、鍵の差し替えだけを置く。回収は、期限切れの open に `refund()` + `close()`、settled / refunded に `close()` を送り、預かり金とレントを発注者へ戻す。

デモの合格条件は次の3画面が連続で見えること。

- 証明書あり。
- `hold` で残高が動かない。
- `release` で受注者残高が増え、finalized ミリ秒が出る。

## 6. プログラム

crate 名は `sokketsu`。Anchor は作業環境の `anchor --version` の版を使い、`Anchor.toml` の `[toolchain]` に固定する。cluster は devnet。program id は `anchor keys sync` で `declare_id!` / `Anchor.toml` と揃え、フロントの定数は IDL の `address` から読む。

### 口座

`Escrow`

| フィールド | 型 | 意味 |
| --- | --- | --- |
| payer | Pubkey | 発注者。deposit の署名者 |
| payee | Pubkey | 受注者 |
| amount | u64 | lamports |
| deadline_slot | u64 | この slot 以降は refund 可能 |
| state_hash | [u8; 32] | 依頼文の sha256 |
| decision | u8 | 0=未判断, 1=release, 2=hold, 3=refund |
| probability_bps | u16 | 0〜10000。70% は 7000 |
| bumped | u8 | PDA bump |
| status | u8 | 0=open, 1=settled, 2=refunded |

seeds は `["escrow", payer, state_hash]`。同一発注者・同一依頼で1口座。デモでは依頼文を変えて複数回作れるようにする。

Escrow は Anchor の `init` で作るプログラム所有のデータ口座で、これ自体を金庫にする。中間トークン口座は作らない。

- レントは `init`（`payer = payer`）が払う。`deposit` で手で送るのは `amount` だけ。
- 入金は `system_program::transfer`（payer → escrow）。
- 出金（settle の解放、refund）は system transfer を使えないので、escrow の lamports を直接減らし相手に足す（`sub_lamports` / `add_lamports`）。レント免除の最低残高は残す。
- `close` は Anchor の `close = payer` 制約で残 lamports を payer へ返して口座を閉じる。

### 命令

`deposit(amount, state_hash, deadline_slots)`

- アカウント: payer（signer, mut）、payee（未検査、Pubkey 記録用）、escrow（init, seeds）、system_program。
- amount は 0 より大きい。deadline_slots は 1〜1500。既定 400（devnet でデモ中に期限切れしない値。目安 90〜160秒）。
- `Clock.slot + deadline_slots` を `deadline_slot` にする。unix 時刻は使わない。

`settle(decision, probability_bps)`

- アカウント: payer（signer）、escrow（mut, has_one payer, has_one payee）、payee（mut）、instructions（instructions sysvar、アドレス固定）。
- status は open、decision は 0（未判断）であること。1 口座で判断は1回だけ。
- decision は 1, 2, 3 のみ。probability_bps は 0〜10000。
- 直前の命令が Ed25519 検証命令で、次をすべて満たすこと。満たさなければ拒否する。
  - 署名は 1 つ。
  - 公開鍵・署名・メッセージは、その命令自身のデータ内にある（instruction index = u16::MAX）。
  - 公開鍵は `ORACLE_PUBKEY`。
  - メッセージは `"sokketsu-decision-v2" ‖ escrow のアドレス ‖ escrow.state_hash ‖ decision(u8) ‖ probability_bps(u16 LE)` の 87 バイト。escrow を含むので、同じ依頼文でも別の escrow には署名を使い回せない。

  署名そのものの正しさは ed25519 ネイティブプログラムが検証する（不正なら取引ごと失敗）。
- `ORACLE_PUBKEY` は devnet 用の鍵。feature `localnet-oracle` を付けたビルドだけ、テスト用の固定鍵（seed = [9; 32]）に替わる。
- 値を口座へ記録する。
- decision == 1 かつ probability_bps >= `RELEASE_THRESHOLD_BPS` のときだけ、amount を payee へ送り status = settled。
- それ以外は送金せず、エラーにもしない。status は open のまま。

`refund()`

- アカウント: payer（signer, mut）、escrow（mut, has_one payer）。
- status は open。
- 通る条件はどちらか。`Clock.slot >= deadline_slot`、または decision == 3 かつ probability_bps >= `RELEASE_THRESHOLD_BPS`。
- amount を payer へ戻し status = refunded。

`close()`

- アカウント: payer（signer, mut）、escrow（mut, has_one payer, close = payer）。
- status は settled か refunded。

### エラー

| エラー | 返す命令と条件 |
| --- | --- |
| `AmountZero` | deposit: amount == 0 |
| `BadDeadline` | deposit: deadline_slots が 1〜1500 の外 |
| `BadDecision` | settle: decision が 1〜3 の外 |
| `BadProbability` | settle: probability_bps > 10000 |
| `NotOpen` | settle / refund: status != open |
| `AlreadyDecided` | settle: decision != 0 |
| `RefundNotAllowed` | refund: 期限前かつ refund 判断の閾値を満たさない |
| `NotFinished` | close: status == open |
| `MissingOracleSignature` | settle: 直前が Ed25519 検証命令でない |
| `BadOracleSignature` | settle: オラクル以外の公開鍵、または判断・確率・依頼文がメッセージと一致しない |

閾値 7000 は定数 `RELEASE_THRESHOLD_BPS`。魔数にしない。

### テスト

`anchor build -- --features localnet-oracle` のあと、`anchor test --skip-build` をローカル validator で回す。次の 8 本。

- deposit すると escrow 残高が amount + レント分増える。
- release / 7000 で payee が amount 増え status が settled。
- release / 6999 では残高が動かず status は open のまま。
- hold では送金されず、その後の settle(release, 7000) は `AlreadyDecided` で失敗する。deadline 前の refund は `RefundNotAllowed` で失敗し、settle(refund, 7000) の後なら期限前でも戻る。
- オラクルの署名が無い settle は `MissingOracleSignature`。
- オラクル以外の鍵で署名した判断は `BadOracleSignature`。
- 別の escrow 用の署名を使い回すと `BadOracleSignature`（同じ依頼文でも）。
- hold と署名された判断を release に書き換えると `BadOracleSignature`（確率だけの書き換えも同じ）。

devnet の確定速度はローカルテストの対象外。フロントの計測で見せる。

## 7. Jev

呼び出しが無くてもデモが終わること。インターフェースを先に固定する。

```ts
type DecisionName = "release" | "hold" | "refund";

type JudgeInput = {
  task: string;
  amountLamports: number;
  payer: string;
  payee: string;
  failCount: number;
  alpenglow: boolean;
};

type JudgeOutput = {
  decision: DecisionName;
  probability: number; // 0..1。選ばれた選択肢の確率
  source: "jev" | "mock";
};

interface Judge {
  evaluate(input: JudgeInput): Promise<JudgeOutput>;
}
```

モックの規則:

- 依頼文が `hold:` で始まるなら `{ decision: "hold", probability: 0.91, source: "mock" }`。
- `refund:` で始まるなら `{ decision: "refund", probability: 0.88, source: "mock" }`。
- それ以外は `{ decision: "release", probability: 0.86, source: "mock" }`。

Jev 実装はサーバ側（Cloudflare Pages Function `app/functions/api/judge.ts`）に置く。ブラウザから AI Gateway を直接呼ばない。

- `AI_GATEWAY_API_KEY` と `DEMO_TOKEN` は Pages の secret（ローカルは `app/.dev.vars`、git に入れない）。Function では `context.env` から読む（Workers では `process.env` に載らない）。`VITE_` 接頭辞の環境変数にキーやトークンを置かない。
- フロントは画面で入力された Jev トークンを `Authorization: Bearer <token>` に付けて `POST /api/judge` を呼ぶ。トークンはページ内のメモリだけに持ち、ローカルストレージに書かない。
- Function はトークンを `DEMO_TOKEN` と照合し、不一致・未入力なら 401。`AI_GATEWAY_API_KEY` が無ければ 503。
- フロントは 401 / 503 / その他の失敗をすべてモックへ落とす。トークンを入れなければ常にモックで完走する。

Function から Jev への呼び出しは AI SDK を使わず、Vercel AI Gateway の評価 HTTP API（`POST https://ai-gateway.vercel.sh/v1/evaluate`、`Authorization: Bearer <AI_GATEWAY_API_KEY>`）を `fetch` で叩く。モデル ID は `typesafe-ai/jev`。Gateway がキーを 401 で拒否したら、同じキーで TypeSafe 本体（`POST https://api.typesafe.ai/v1/systemone`、モデル `jev-latest`）へ送り直す（TypeSafe で発行したキーにも対応するため）。キーは前後の空白を除いてから使う。

質問は `decision` の1つだけ。型は choice、`criteria` は次のマップ。

- `release`: 依頼が成立しており、今すぐ受注者へ解放してよい。
- `hold`: 材料不足、または明示的な hold 指示がある。
- `refund`: 明示的な refund 指示がある、または依頼が成立しない。

戻りの選ばれた選択肢を `decision`、`probabilities[decision]` を `probability` にする。`score` 型は 0〜1 を返さないので使わない。state には `JudgeInput` をそのまま渡す。文章生成はさせない。失敗時はモックへ落ち、画面に `source: mock` と出す。確率は bps にしてから命令へ渡す。`Math.round(probability * 10000)`。

### 判断の署名（オラクル）

- `JudgeOutput` に任意の `proof: { bps, signature, publicKey }`（hex）を足す。
- 判断を返す口は 2 つ。どちらも secret `ORACLE_SECRET_KEY`（32 バイト seed の hex）で ed25519 署名する。
  - `/api/judge`: Jev の判断。
  - `/api/decide`: 認証なし。サーバ側でモックの規則を適用した判断。
- フロントは次の順で判断を取る。
  1. トークンがあれば `/api/judge`
  2. だめなら理由を出して `/api/decide`
  3. それもだめなら署名なしのモック（送る前に「判断に署名が無い」で止める）
- 判断はサーバが決めて署名するので、クライアントが判断や確率を書き換えた取引はプログラムに拒否される。
- `JudgeInput` に `escrow`（base58）を足す。サーバは escrow・payer・payee の形式（base58 の公開鍵）、金額（1 lamport〜10 SOL）、回数（0〜10000）、本文（4 KiB まで）を検証する。

### 設計上の判断（2026-10-04 の公開前レビューより）

- **`/api/decide` は認証なしでモック判断に署名する**。
  - モックの規則は公開されていて、依頼文だけで決まる。
  - 署名が保証するのは「判断をクライアントが書き換えていない」ことと「その escrow・依頼文に対する判断である」ことまで。
  - 発注者が自分の払いを自分で承認できる点は、この設計の範囲内とする。
- **`settle` を実行できるのは発注者だけ**。発注者が主導して払うデモで、受注者側からの執行は扱わない。
- **署名のオフセットの検証**。署名本体は ed25519 ネイティブプログラムが検証する。プログラムは、他の命令への参照を `u16::MAX` で塞いだうえで、公開鍵とメッセージを照合する。
- **hold の資金は期限（既定 400 slot）まで凍結**する。期限後は ⚙ →「回収」で発注者へ戻す。
- **DEMO_TOKEN は持ち主がデモのときにだけブラウザに入れる**。メモリにしか持たない。共有すると、Jev の課金と予備 RPC を他人も使えるようになる。
- **Jev に渡す補助の値（金額・当事者・回数）は署名の対象に含めない**。署名が結び付くのは escrow・依頼文・判断・bps。補助の値を差し替えられるのは DEMO_TOKEN を持つ本人だけで、その本人の資金にしか影響しない。
- **プログラムは upgrade 可能なまま**にする（ハッカソン中の改修のため）。凍結は `set-upgrade-authority --final` で行えるが、元に戻せないので持ち主の判断とする。
- 予備 RPC は `HELIUS_RPC_URL` が `https://devnet.` で始まるときだけ中継する。本文のサイズは、`Content-Length` で先に切ってから読む。

## 8. フロント

ディレクトリはリポジトリ直下の `app/`。

- RPC は `https://api.devnet.solana.com`。接続の commitment 既定は `finalized`。
- クライアントは `@solana/web3.js` 1 系 + `@coral-xyz/anchor`。ブラウザ向けに `vite-plugin-node-polyfills` で `Buffer` を補う。ページ内 keypair は Anchor の `Wallet` 型を満たす小さなオブジェクトで包む（`NodeWallet` は使わない）。
- IDL は `anchor build` 後に `target/idl/sokketsu.json` と `target/types/sokketsu.ts` を `app/src/idl/` へコピーする。program id はこの IDL の `address` を使う。
- 起動時に `getAgGenesisCert`（`Connection` に型が無いので生 `fetch` の JSON-RPC、5秒で打ち切り）。現在の slot は WebSocket の `slotSubscribe`。表示は第5節1。
- ホスティングは Cloudflare Pages。Jev 呼び出しは Pages Function `/api/judge` 経由のみ（第7節）。
- 操作は第5節のとおり「鍵の貼り付け」と「▶ デモを流す」だけ。補助に hold / release / refund のチップと ⚙（Jev トークン・回収・鍵の差し替え）。
- 舞台（3ノード・コイン・判断リング）、確定パネル（ms・倍率・Tower BFT との横棒）、タイムライン（各段の実測と tx リンク）を表示する。
- 計測: 取引は `getLatestBlockhash("confirmed")` で署名まで済ませ、`sendRawTransaction(raw, { skipPreflight: true })` の直前で `performance.now()` を取る。主は WebSocket の `signatureSubscribe`（送信前に processed / finalized の2本を購読）。予備に `getSignatureStatuses` を 300ms 間隔で呼び、通知が来たら待ちを打ち切る。`err` が入れば失敗表示。3秒で打ち切り「未確定」と出す。
  - 改訂理由（2026-10-03 実測）: `getSignatureStatuses` の 100ms ポーリングは公開 RPC の 429 に当たり、web3.js の自動リトライ（最大 7.5 秒）が計測値を水増しした。計測用の接続は自動リトライを切り、429 に当たった計測は画面に「値は上振れしうる」と出す。
- 計測しない準備用の取引（deposit / hold の記録）は同じ仕組みで、ポーリング 1 秒間隔・8秒で確定を待つ。
- escrow は「発注者 + 依頼文」で一意なので、プリセットは依頼文の末尾に `#xxxx` の識別子を付ける（判断の接頭辞は先頭のまま）。
- 比較ラベルは静的テキスト。mainnet RPC へは接続しない。
- 秘密鍵はページ内のメモリだけ。ローカルストレージに書かない（ローカルストレージに残すのは、計測履歴・ゲームの進捗・言語・ミュートだけ）。
- 予備 RPC: 公開 RPC が 429 / 5xx / 通信失敗のときだけ、`/api/rpc`（Helius devnet、URL は secret `HELIUS_RPC_URL`）へ送り直す。
  - 使えるのは DEMO_TOKEN が一致したときだけ。許可するのは、このアプリが使うメソッドだけ。
  - 切り替わったらピルに「予備 RPC で接続中」と出す。
  - 「RPC は公開 devnet のみ」の例外（2026-10-03 承認）。
- 直近 5 件: release / refund の finalized ms を棒グラフにし、中央値の線と「全部サブ秒」バッジを出す。
- 英語表示: ヘッダーの EN / 日本語 で切り替える。文言は `src/i18n.ts` の辞書に集め、日英のキーの一致はテストで保証する。
- ゲーム要素（`src/lib/game.ts`）:
  - スコア: 送金は 100 + 速さのボーナス、hold は 50。
  - レベル: 必要 XP は 100 × (L−1)²。
  - コンボ: サブ秒の確定が続く回数（失敗で途切れる）。
  - ランク: S < 600ms / A < 900 / B < 1500 / C。
  - 実績 7 種。
  - 演出:
    - canvas-confetti（ランクに応じた紙吹雪・コンボの打ち上げ・レベルアップの星）
    - WebAudio の効果音（ミュート可）
    - CSS（揺れ・判子・トースト）
  - `prefers-reduced-motion` では、動きを止め、紙吹雪も出さない。

### ローカル開発

- `npm run dev`: Vite だけ。`/api/judge` は無いので常にモック。
- `npm run dev:cf`: `vite build && wrangler pages dev dist`。Function 込みで動き、401 / 503 の確認はこちらか本番 URL で行う。

## 9. ファイル構成

```text
sokketsu/
  Anchor.toml
  programs/sokketsu/src/lib.rs
  tests/sokketsu.ts
  app/
    package.json             # scripts: dev / dev:cf / build
    src/main.tsx
    src/judge.ts
    src/chain.ts
    src/App.tsx              # 自動再生（預け入れ → 判断 → 執行）と状態
    src/i18n.ts / lang.tsx   # 日英の辞書と言語の切り替え
    src/components/          # FlowStage（舞台）/ ResultPanel / Timeline / History / Hud / Toasts
    src/lib/                 # stats / payee / rpcFallback / game / fx / sfx（純粋な計算と演出）
    src/idl/sokketsu.json    # anchor build からコピー
    src/idl/sokketsu.ts
    functions/api/judge.ts   # Jev 呼び出し・トークン照合・オラクル署名
    functions/api/decide.ts  # モック判断のオラクル署名
    functions/api/rpc.ts     # 予備 RPC（Helius devnet）への中継
    server/                  # Function 共通（auth / oracle / judgeInput）
    .dev.vars                # ローカル用 secret。git に入れない
  README.md
```

README には devnet デプロイ手順、IDL のコピー、`npm run dev` / `npm run dev:cf`、テスト、secret の一覧、デモ台本を書く。

## 10. デモ台本

1. 証明書と、動き続ける slot を見せ、「この devnet は Alpenglow」と言う。
2. 発注者の鍵を貼り、「▶ デモを流す」を押す。hold で金庫に錠が掛かり、受注者の残高が動かないことを見せる。
3. カウントダウンのあと release が自動で走る。コインが受注者へ流れ、finalized ミリ秒と Tower BFT との倍率が出る。
4. 「Tower BFT なら約 12.8秒。判断も確定もサブ秒。判断はオラクルが署名し、書き換えた取引はプログラムが拒否する」で終える。HUD のレベル・コンボ・ランクで、繰り返すほど積み上がることも見せる。

事前準備: 発注者 keypair に devnet SOL を入れておく（airdrop が当日失敗しても進めるため）。

## 11. 完了条件

- `anchor test` の 8 本が通る（`localnet-oracle` ビルド）。`npm test`（vitest）が通り、判断・計算・API 層のカバレッジが 80% 以上。
- devnet 上のプログラムが、署名なし・書き換えた判断の settle を拒否する。
- devnet にプログラムがある。
- ブラウザで、証明書表示、hold で非送金、release で送金と finalized ミリ秒、の3つが1回ずつ成功する。
- Jev キーもトークンも無い状態で、モックで上記が完了する。
- mainnet への接続と送金がコードに無い。
- `app/dist/` のビルド成果物に `AI_GATEWAY_API_KEY` と `DEMO_TOKEN` の値が含まれない。`npm run dev:cf` で、トークン不一致なら `/api/judge` が 401、キー未設定なら 503 を返す。

## 12. Claude Code への依頼文

初版（2026-10-03 朝）の依頼文を、履歴として残す。以降の改訂は第 4〜11 節が正。

```text
リポジトリに即決エスクロー Sokketsu を実装せよ。仕様の正本はこの企画書。必須だけ作り、やらないに書いたものは作るな。

1. Anchor プログラム sokketsu を作れ。命令は deposit / settle / refund / close。口座、lamports 移動方式、アカウント一覧、settle は1口座1回、閾値 7000 bps、エラー表、テスト4本は企画書第6節どおり。Anchor は手元の版を [toolchain] に固定せよ。
2. ローカルテストが通ったら devnet へデプロイし、IDL を app/src/idl/ へコピーして program id を揃えよ。
3. app/ に Vite + React + TypeScript の1ページを作れ。RPC は https://api.devnet.solana.com のみ。クライアントは @solana/web3.js 1 系 + @coral-xyz/anchor。
4. 起動時に getAgGenesisCert（5秒で打ち切り）と slotSubscribe。null なら再生を無効化、-32601 / 失敗は警告のみ。
5. 発注者は秘密鍵の貼り付けで即読み込み、受注者は自動生成、airdrop は補助。操作は「鍵を貼る」「▶ デモを流す」の2つに絞れ（第5節）。
6. judge.ts に Judge インターフェースとモックを実装。依頼文の接頭辞 hold: / refund: / それ以外で企画書第7節の戻りを返せ。Jev は Pages Function /api/judge から /v1/evaluate を fetch で呼べ。choice の probabilities を確率に使え。キーと DEMO_TOKEN は secret、Bearer で照合、401 / 503 / 失敗時はモック。
7. 執行は第5節4のとおり。refund は settle(3)+refund() を1取引にまとめよ。未確定は成功扱いにするな。
8. 計測は performance.now() と signatureSubscribe（主）+ getSignatureStatuses 300ms（予備）。skipPreflight、3秒で打ち切り。12.8秒待ちは禁止。比較ラベルだけ静的に置け。
9. README に起動手順とデモ台本を書け。
完了条件は企画書第11節。
```
