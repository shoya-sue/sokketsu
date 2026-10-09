import { useCallback, useEffect, useRef, useState } from "react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  DEPOSIT_LAMPORTS,
  RELEASE_THRESHOLD_BPS,
  airdropTo,
  depositIx,
  escrowAddress,
  fetchAlpenglowStatus,
  fetchEscrow,
  fundAddress,
  getBalance,
  keypairSigner,
  getSlot,
  parseSecretKey,
  refundIx,
  sendAndMeasure,
  sendSetup,
  settleIxs,
  stateHashOf,
  subscribeSlots,
  sweepEscrows,
  topUpIx,
  onRpcRoute,
  setRpcFallbackToken,
  type AlpenglowStatus,
  type Measurement,
  type SweepResult,
} from "./chain";
import { createJudge, toBps, type JudgeOutput } from "./judge";
import { FlowStage, type Phase } from "./components/FlowStage";
import { ResultPanel, type Outcome } from "./components/ResultPanel";
import { Timeline, type TimelineEntry } from "./components/Timeline";
import { History } from "./components/History";
import { JudgePanel } from "./components/JudgePanel";
import { ProgressTrack } from "./components/ProgressTrack";
import { SlotPulse } from "./components/SlotPulse";
import { BadgeOverlay, type Badge } from "./components/BadgeOverlay";
import { Ambient } from "./components/Ambient";
import { Logo } from "./components/Logo";
import { Onboarding } from "./components/Onboarding";
import { ONBOARDED, ONBOARDING_KEY, shouldShowOnboarding } from "./lib/onboarding";
import { FinalityHit, type Hit } from "./components/FinalityHit";
import { useAttract } from "./hooks/useAttract";
import { ATTRACT_PROBABILITY, attractMs } from "./lib/attract";
import { TONE_RGB, toneOf } from "./lib/tone";
import { energyOf, tickerItems } from "./lib/overdrive";
import { OverdriveBack, OverdriveFront, SolanaLogo, Ticker } from "./components/Overdrive";
import { stepStates } from "./lib/steps";
import { pushSlotTime } from "./lib/slotPulse";
import { parseHistory, pushSample, type Sample } from "./lib/stats";
import { derivePayee, derivePayeeAddress } from "./lib/payee";
import { operatorTopUp, type PayerSession } from "./lib/session";
import { KeyedError, describeError, msg, type Msg } from "./i18n";
import { useLang } from "./lang";
import { Hud } from "./components/Hud";
import { Toasts, type Toast } from "./components/Toasts";
import { INITIAL_GAME, applyRun, levelFromXp, parseGame, type GameState, type Grade, type Run } from "./lib/game";
import { burstAt, sideCannons, starShower } from "./lib/fx";
import { isMuted, play as playSfx, playNotes, setMuted, vibrate } from "./lib/sfx";
import { TIER_OF, VIBRATE, jackpotFor, nearMiss } from "./lib/thrill";
import { useBgm } from "./hooks/useBgm";
import { countdownNotes } from "./lib/sfxPlan";
import { CountdownHit } from "./components/CountdownHit";
import { useShake } from "./hooks/useShake";

const GAME_KEY = "sokketsu.game.v1";
const TOAST_MS = 3800;
const LEVEL_UP_MS = 1800;
const BADGE_SHOW_MS = 2900; // BadgeOverlay の表示時間（2.8 秒）+ 余白
const HIT_MS = 2600; // 確定ミリ秒を画面中央に出しておく時間（#31）
const ACH_ICON: Record<string, string> = {
  first_finality: "⚡",
  sub_500: "🚀",
  combo_3: "🔥",
  combo_5: "💥",
  stopper: "🛑",
  all_paths: "🧭",
  level_5: "👑",
};

function loadGame(): GameState {
  try {
    return parseGame(localStorage.getItem(GAME_KEY));
  } catch {
    return INITIAL_GAME;
  }
}

function loadOnboarding(): boolean {
  try {
    return shouldShowOnboarding(localStorage.getItem(ONBOARDING_KEY));
  } catch {
    return true;
  }
}

function saveOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, ONBOARDED);
  } catch {
    // 覚えられなくても閉じられる（次に来たときにもう一度出るだけ）
  }
}

function saveGame(game: GameState): void {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(game));
  } catch {
    // 保存できなくても遊べる
  }
}
let toastSeq = 0;

const HISTORY_KEY = "sokketsu.history.v1";

// 計測履歴は秘密情報ではないので localStorage に残す（使えない環境では黙って諦める）。
function loadHistory(): Sample[] {
  try {
    return parseHistory(localStorage.getItem(HISTORY_KEY));
  } catch {
    return [];
  }
}

function saveHistory(history: Sample[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // private モードなどで保存できなくても表示は続ける
  }
}

type Preset = { key: "hold" | "release" | "refund"; label: string; task: string };

const PRESETS: Preset[] = [
  { key: "hold", label: "hold", task: "hold: wait" },
  // Jev は納品の根拠が無い依頼文を hold（約 60%）と判断するため、完了と承認を明記する（2026-10-06 実測: release 91〜95%）。
  { key: "release", label: "release", task: "release: delivered the devnet ping report; payer verified and approved" },
  { key: "refund", label: "refund", task: "refund: cancel" },
];
// デモ台本の順（hold で止まる → release で即決）。
const DEMO_SEQUENCE = [PRESETS[0], PRESETS[1]];
// 次の依頼までの間。公開 RPC の呼び出し回数の窓（10 秒）をまたがせ、カウントダウンとして見せる。
const PAUSE_BETWEEN_SECONDS = 6;
const JUDGE_MIN_VISIBLE_MS = 900; // 判断リングのスキャンを見せる最短時間（計測値には含めない）
const SLOT_UI_THROTTLE_MS = 250;
// escrow のレント（約 0.0017 SOL）と手数料ぶんの余裕。
const MIN_EXTRA_LAMPORTS = 3_000_000;

// escrow は「発注者 + 依頼文」で一意なので、末尾に識別子を付けて毎回別の escrow にする。
const withRunId = (task: string) => `${task} #${Math.random().toString(36).slice(2, 6)}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let entrySeq = 0;

type SweepNote = { kind: "busy" } | { kind: "done"; result: SweepResult } | { kind: "error"; error: unknown };

export default function App() {
  const { lang, toggle, t, tm } = useLang();
  const [alpenglow, setAlpenglow] = useState<AlpenglowStatus | null>(null);
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [session, setSession] = useState<PayerSession | null>(null);
  const wallet = useWallet();
  const [payee, setPayee] = useState<PublicKey | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState<Msg | null>(null);
  const [jevToken, setJevToken] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [balances, setBalances] = useState<{ payer: number | null; payee: number | null }>({
    payer: null,
    payee: null,
  });
  const [vaultLamports, setVaultLamports] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  // 失敗したとき、どの段で止まったかを段階表示に出すため、直前の段階を覚えておく。
  const prevPhase = useRef<Phase>("idle");
  const [beforeError, setBeforeError] = useState<Phase | undefined>(undefined);
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [slotTimes, setSlotTimes] = useState<number[]>([]);
  const [badge, setBadge] = useState<Badge | null>(null);
  const [judgement, setJudgement] = useState<JudgeOutput | null>(null);
  const [fallbackReason, setFallbackReason] = useState<Msg | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [measuringSince, setMeasuringSince] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [slotsLeft, setSlotsLeft] = useState<number | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [funding, setFunding] = useState(false);
  const [countdown, setCountdown] = useState<{ next: string; seconds: number } | null>(null);
  const [sweepNote, setSweepNote] = useState<SweepNote | null>(null);
  const [history, setHistory] = useState<Sample[]>(loadHistory);
  const [usingFallbackRpc, setUsingFallbackRpc] = useState(false);
  const [game, setGame] = useState<GameState>(loadGame);
  // 自動デモは 1 つの関数の中で hold → release と続くので、最新のゲーム状態は ref で持つ。
  const gameRef = useRef(game);
  const [gain, setGain] = useState<{ amount: number; key: number } | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const stageCardRef = useRef<HTMLDivElement>(null);
  useShake(stageCardRef, shakeKey);
  const [muted, setMutedState] = useState(isMuted);
  const [hit, setHit] = useState<Hit | null>(null);
  const [onboarding, setOnboarding] = useState(loadOnboarding);

  /** 確定の瞬間を画面中央に出し、舞台を揺らす（#31）。格・惜しさ・大当たりも出す（#35）。 */
  const showHit = (kind: Hit["kind"], ms: number, g: Grade | null, prevBest: number | null) => {
    const id = Date.now();
    const tier = g ? TIER_OF[g] : null;
    setHit({ id, kind, ms, grade: g, near: nearMiss(ms), tier, jackpot: g ? jackpotFor(prevBest, ms, g) : null });
    setShakeKey((k) => k + 1);
    if (tier) vibrate(VIBRATE[tier]);
    later(() => setHit((h) => (h?.id === id ? null : h)), HIT_MS);
  };

  const clearBadge = useCallback(() => setBadge(null), []);
  // 再生中は小さな BGM を流す（コンボ中は音を重ねる）（#35）。
  useBgm(running !== null && running !== "sweep", game.combo);
  // 演出の予約（バッジ・レベルアップ・その効果音）。次の再生を始めたら取り消す（前の回の演出が途中に出ないように）。
  const pending = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => {
    pending.current.push(setTimeout(fn, ms));
  };
  const cancelPending = () => {
    pending.current.forEach(clearTimeout);
    pending.current = [];
  };
  const showBadge = (b: Badge, delayMs: number) => (delayMs > 0 ? later(() => setBadge(b), delayMs) : setBadge(b));

  const toast = (t0: Omit<Toast, "id">) => {
    const id = ++toastSeq;
    setToasts((list) => [...list, { ...t0, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), TOAST_MS);
  };

  /** 1 回の結果をゲームに反映し、点・実績・レベルアップを演出する。 */
  const scoreRun = (run: Run): Grade | null => {
    const result = applyRun(gameRef.current, run);
    gameRef.current = result.next;
    setGame(result.next);
    saveGame(result.next);
    if (result.gained > 0) setGain({ amount: result.gained, key: Date.now() });
    // 中央に出すもの（S ランク・実績）は 1 本の列にして順に出す。実績を同時に複数解除したら 2 つ目からはトースト。
    // 確定した回は、中央の確定ミリ秒（#31）と重ならないよう、それが消えてから出す。
    const badgeDelay = run.kind === "release" || run.kind === "refund" ? HIT_MS : 0;
    const queue: Badge[] = [];
    if (result.grade === "S" && run.ms != null) {
      queue.push({ id: Date.now(), icon: "⚡", kicker: t("game.grade"), title: t("badge.rank"), body: t("badge.rankBody", { ms: Math.round(run.ms) }) });
    }
    result.unlocked.forEach((id, i) => {
      const view = { icon: ACH_ICON[id] ?? "🏅", title: t(`ach.${id}.title`), body: t(`ach.${id}.body`) };
      if (i === 0) queue.push({ id: Date.now() + 1, kicker: t("badge.achievement"), ...view });
      else toast({ ...view, tone: "gold" });
    });
    queue.forEach((b, i) => showBadge(b, badgeDelay + i * BADGE_SHOW_MS));
    if (result.unlocked.length > 0) later(() => playSfx("achievement"), badgeDelay + 350);
    if (result.levelUp) {
      const level = levelFromXp(result.next.xp);
      // バッジが出る回は、それが全部消えてから（中央で重ならないように）。
      const levelDelay = badgeDelay + queue.length * BADGE_SHOW_MS;
      later(() => setLevelUp(level), levelDelay);
      later(() => setLevelUp(null), levelDelay + LEVEL_UP_MS);
      later(() => {
        playSfx("levelup");
        starShower();
      }, levelDelay + 600);
      toast({ icon: "⬆", title: t("game.levelUp"), body: t("game.levelUpBody", { level }), tone: "purple" });
    }
    if (result.next.combo >= 2 && run.kind !== "hold") {
      playSfx("combo");
      sideCannons();
    }
    return result.grade;
  };

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };

  const recordSample = (ms: number, label: string) =>
    setHistory((h) => {
      const next = pushSample(h, { ms, at: Date.now(), label });
      saveHistory(next);
      return next;
    });

  useEffect(() => {
    onRpcRoute((route) => setUsingFallbackRpc(route === "fallback"));
    fetchAlpenglowStatus().then(setAlpenglow);
  }, []);

  // 予備 RPC は DEMO_TOKEN（Jev と同じトークン）が入っているときだけ使う。
  // 公開 RPC が落ちていて判定が「不明」だったなら、予備が使えるようになった時点で取り直す。
  useEffect(() => {
    setRpcFallbackToken(jevToken);
    if (jevToken.trim() && alpenglow?.kind === "unknown") {
      fetchAlpenglowStatus().then(setAlpenglow);
    }
    // alpenglow は判定のやり直しの条件にだけ使う。トークンが変わったときだけ走らせる。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jevToken]);

  // slot を生きた数字として見せる。WebSocket の push なので RPC の呼び出し回数を使わない。
  useEffect(() => {
    let last = 0;
    getSlot().then(setCurrentSlot).catch(() => undefined);
    return subscribeSlots((slot) => {
      const now = performance.now();
      setSlotTimes((times) => pushSlotTime(times, now));
      if (now - last < SLOT_UI_THROTTLE_MS) return;
      last = now;
      setCurrentSlot(slot);
    });
  }, []);

  useEffect(() => {
    if (phase === "error") setBeforeError(prevPhase.current);
    prevPhase.current = phase;
  }, [phase]);

  // まだ 1 回も流していない待機中は、舞台で送金しない再生を流し続ける（#30）。
  const attract = useAttract(phase === "idle" && !running);
  const stage = attract
    ? {
        phase: attract.phase,
        judgement: attract.judged ? { decision: "release" as const, probability: ATTRACT_PROBABILITY, source: "jev" as const } : null,
        vaultLamports: attract.phase === "depositing" || attract.phase === "judging" ? DEPOSIT_LAMPORTS : 0,
        runKey: -1 - attract.cycle,
      }
    : { phase, judgement, vaultLamports, runKey };

  // 画面全体の色調は舞台に見えている段階に従う（再生中も色が巡る）（#33）。
  const tone = toneOf(stage.phase);
  const toneStyle = {
    ["--tone-a" as string]: `rgb(${TONE_RGB[tone][0]})`,
    ["--tone-b" as string]: `rgb(${TONE_RGB[tone][1]})`,
    ["--od-energy" as string]: String(energyOf(stage.phase)),
  };
  // 何重にも重ねる演出（#56）のティッカー。実測の slot と確定ミリ秒を流す。
  const ticker = tickerItems({ phase: stage.phase, slot: currentSlot, lastMs: history.map((s) => s.ms) });

  const sendingAllowed = alpenglow !== null && alpenglow.kind !== "legacy";
  const ready = session !== null && payee !== null;
  const payerKey = session?.signer.publicKey ?? null;
  const lowBalance = balances.payer !== null && balances.payer < DEPOSIT_LAMPORTS + MIN_EXTRA_LAMPORTS;

  const refreshBalances = async (p: PublicKey, q: PublicKey) => {
    const [pb, qb] = await Promise.all([getBalance(p), getBalance(q)]);
    setBalances({ payer: pb, payee: qb });
  };

  // 受注者は発注者から決定的に導く（毎回同じ受注者になり、残高が積み上がる）。
  const adoptSession = async (next: PayerSession, receiver: PublicKey) => {
    setSession(next);
    setPayee(receiver);
    setKeyInput("");
    setKeyError(null);
    await refreshBalances(next.signer.publicKey, receiver);
  };

  // 貼った鍵（開発者向け）: 発注者の鍵がそのまま操作鍵。受注者は秘密鍵から導く（従来と同じ受注者）。
  const adoptPastedKey = async (kp: Keypair) =>
    adoptSession({ kind: "pasted", signer: keypairSigner(kp), operator: kp }, (await derivePayee(kp)).publicKey);

  // 貼り付けた瞬間に読み込む。ボタンは置かない。
  const onKeyInput = (text: string) => {
    setKeyInput(text);
    if (!text.trim()) return setKeyError(null);
    try {
      void adoptPastedKey(parseSecretKey(text));
    } catch (e) {
      setKeyError(e instanceof KeyedError ? e.msg : msg("err.keyFormat"));
    }
  };

  /** devnet SOL を受け取る。自前の faucet を先に使い、だめなら公開 faucet の airdrop を試す。 */
  const receiveSol = async (pubkey: PublicKey) => {
    try {
      await fundAddress(pubkey);
    } catch (fundError) {
      try {
        await airdropTo(pubkey);
      } catch {
        throw fundError;
      }
    }
  };

  // お試し: ブラウザ内で捨て鍵を作り、SOL を入れて、そのまま発注者にする（秘密鍵を貼らない）。
  const startTrial = async () => {
    setPreparing(true);
    setKeyError(null);
    try {
      const kp = Keypair.generate();
      await receiveSol(kp.publicKey);
      await adoptSession(
        { kind: "trial", signer: keypairSigner(kp), operator: kp },
        await derivePayeeAddress(kp.publicKey),
      );
    } catch (e) {
      setKeyError(msg("setup.trialFailed", { error: describeError(lang, e) }));
    } finally {
      setPreparing(false);
    }
  };

  // ウォレットで始めたが devnet の SOL が無いとき。
  const fundWallet = async () => {
    if (!session || !payee) return;
    setFunding(true);
    setKeyError(null);
    try {
      await receiveSol(session.signer.publicKey);
      await refreshBalances(session.signer.publicKey, payee);
    } catch (e) {
      setKeyError(msg("setup.fundFailed", { error: describeError(lang, e) }));
    } finally {
      setFunding(false);
    }
  };

  // ウォレットを接続したら発注者にする。操作鍵はページ内で作り、預け入れのときに手数料ぶんだけ送る。
  const walletKey = wallet.publicKey?.toBase58() ?? null;
  useEffect(() => {
    const { publicKey, signTransaction } = wallet;
    if (!publicKey) {
      setSession((s) => (s?.kind === "wallet" ? null : s));
      return;
    }
    if (!signTransaction) {
      setKeyError(msg("err.walletNoSign"));
      return;
    }
    void (async () =>
      adoptSession(
        { kind: "wallet", signer: { publicKey, signTransaction }, operator: Keypair.generate() },
        await derivePayeeAddress(publicKey),
      ))();
    // 接続先のアドレスが変わったときだけ作り直す（wallet オブジェクトは描画ごとに変わる）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletKey]);

  const push = (entry: Omit<TimelineEntry, "id">) =>
    setTimeline((list) => [...list, { ...entry, id: ++entrySeq }]);

  /** 3 秒以内に finalized を観測できなかった送金。成功扱いにせず、再生を止める。 */
  const unconfirmed = (labelKey: "label.release" | "label.refund", m: Measurement): false => {
    setOutcome({ kind: "sent", labelKey, measurement: m });
    setPhase("error");
    playSfx("fail");
    scoreRun({ kind: "fail" });
    push({
      label: msg("tl.unconfirmed", { label: `@${labelKey}` }),
      detail: msg("tl.unconfirmedDetail"),
      ms: null,
      signature: m.signature,
      tone: "warn",
    });
    return false;
  };

  const sweep = async () => {
    if (!session || running) return;
    setRunning("sweep");
    setSweepNote({ kind: "busy" });
    try {
      // refund / close は誰が出してもよいので、承認の要らない操作鍵が出す（資金とレントは発注者へ戻る）。
      const result = await sweepEscrows(keypairSigner(session.operator), session.signer.publicKey);
      setSweepNote({ kind: "done", result });
      if (payee) await refreshBalances(session.signer.publicKey, payee);
    } catch (error) {
      setSweepNote({ kind: "error", error });
    } finally {
      setRunning(null);
    }
  };

  const sweepText = (note: SweepNote): string => {
    if (note.kind === "busy") return t("settings.sweeping");
    if (note.kind === "error") return t("settings.sweepError", { error: describeError(lang, note.error) });
    const { refunded, closed, waiting, failed } = note.result;
    return (
      t("settings.sweepResult", { refunded, closed, waiting }) +
      (failed ? t("settings.sweepFailed", { failed }) : "")
    );
  };

  /** 1 件の支払いを 預け入れ → 判断 → 執行 まで自動で流す。成功なら true。 */
  const runScenario = async (preset: Preset, s: PayerSession, q: PublicKey): Promise<boolean> => {
    const p = s.signer;
    const operator = keypairSigner(s.operator);
    setRunKey((k) => k + 1);
    cancelPending();
    setHit(null); // 前の回の確定の重ね表示を、新しい預け入れ・判断に重ねない
    setGrade(null);
    setJudgement(null);
    setOutcome(null);
    setSlotsLeft(null);
    setFallbackReason(null);
    const task = withRunId(preset.task);
    setCurrentTask(task);
    setBeforeError(undefined);
    push({ label: msg("tl.request", { preset: preset.label }), detail: task, tone: "info" });
    try {
      // 1. 預け入れ
      setPhase("depositing");
      const hash = await stateHashOf(task);
      const escrow = escrowAddress(p.publicKey, hash);
      // 残高不足は生のエラーではなく、足りない額で知らせる（預かり金 + レント + 手数料の余裕）。
      const have = await getBalance(p.publicKey);
      if (have < DEPOSIT_LAMPORTS + MIN_EXTRA_LAMPORTS) {
        throw new KeyedError("err.insufficientFunds", {
          need: ((DEPOSIT_LAMPORTS + MIN_EXTRA_LAMPORTS - have) / 1e9).toFixed(4),
        });
      }
      // ウォレットのときは操作鍵の手数料を同じ取引で送り、承認を 1 回に保つ。
      const topUp =
        s.kind === "wallet" ? operatorTopUp(await getBalance(s.operator.publicKey)) : 0;
      const depositIxs = [
        ...(topUp > 0 ? [topUpIx(p.publicKey, s.operator.publicKey, topUp)] : []),
        await depositIx(p.publicKey, q, hash, s.operator.publicKey),
      ];
      const dep = await sendSetup(p, depositIxs);
      if (dep.error) throw new KeyedError("err.depositTx", { error: dep.error });
      if (dep.finalizedMs === null) throw new KeyedError("err.depositUnconfirmed");
      setVaultLamports(DEPOSIT_LAMPORTS);
      push({ label: msg("tl.deposit"), ms: dep.finalizedMs, signature: dep.signature, tone: "ok" });
      playSfx("deposit");
      await refreshBalances(p.publicKey, q);

      // 2. 判断
      setPhase("judging");
      playSfx("judge");
      const judge = createJudge(() => jevToken, setFallbackReason);
      const [decision] = await Promise.all([
        judge.evaluate({
          task,
          escrow: escrow.toBase58(),
          amountLamports: DEPOSIT_LAMPORTS,
          payer: p.publicKey.toBase58(),
          payee: q.toBase58(),
          failCount,
          alpenglow: alpenglow?.kind === "alpenglow",
        }),
        sleep(JUDGE_MIN_VISIBLE_MS),
      ]);
      setJudgement(decision);
      // 執行はオラクルが署名した bps で行う（プログラムが署名と照合する）。
      const bps = decision.proof?.bps ?? toBps(decision.probability);
      const meets = bps >= RELEASE_THRESHOLD_BPS;
      push({
        label: msg("tl.judge", { decision: decision.decision }),
        detail: msg(decision.proof ? "tl.judgeDetailSigned" : "tl.judgeDetail", {
          pct: (decision.probability * 100).toFixed(1),
          source: decision.source,
        }),
        tone: decision.decision !== "hold" && meets ? "ok" : "warn",
      });

      // 3. 執行
      // 執行は操作鍵が出す（Jev の判断は誰が出してもよく、モックは操作鍵なら通る）。発注者の承認は要らない。
      const settle = await settleIxs(s.operator.publicKey, p.publicKey, q, escrow, hash, decision);
      playSfx("verify");
      if (decision.decision === "release" && meets) {
        const m = await sendAndMeasure(operator, settle, undefined, (at) => {
          setMeasuringSince(at);
          setPhase("releasing");
        });
        setMeasuringSince(null);
        if (m.error) throw new KeyedError("err.releaseTx", { error: m.error });
        if (m.finalizedMs === null) return unconfirmed("label.release", m);
        setVaultLamports(0);
        setOutcome({ kind: "sent", labelKey: "label.release", measurement: m });
        recordSample(m.finalizedMs, "release");
        setPhase("released");
        playSfx("finalize");
        const prevBest = gameRef.current.bestMs;
        const g = scoreRun({ kind: "release", ms: m.finalizedMs });
        setGrade(g);
        showHit("release", m.finalizedMs, g, prevBest);
        if (g) burstAt(".node-payee", g);
        push({
          label: msg("tl.sent", { label: "@label.release" }),
          detail: m.rateLimited ? msg("tl.rateLimited") : undefined,
          ms: m.finalizedMs,
          signature: m.signature,
          tone: "ok",
        });
      } else if (decision.decision === "refund" && meets) {
        const m = await sendAndMeasure(operator, [...settle, await refundIx(p.publicKey, escrow)], undefined, (at) => {
          setMeasuringSince(at);
          setPhase("refunding");
        });
        setMeasuringSince(null);
        if (m.error) throw new KeyedError("err.refundTx", { error: m.error });
        if (m.finalizedMs === null) return unconfirmed("label.refund", m);
        setVaultLamports(0);
        setOutcome({ kind: "sent", labelKey: "label.refund", measurement: m });
        recordSample(m.finalizedMs, "refund");
        setPhase("refunded");
        playSfx("finalize");
        const prevBest = gameRef.current.bestMs;
        const g = scoreRun({ kind: "refund", ms: m.finalizedMs });
        setGrade(g);
        showHit("refund", m.finalizedMs, g, prevBest);
        if (g) burstAt(".node-payer", g);
        push({
          label: msg("tl.sent", { label: "@label.refund" }),
          detail: m.rateLimited ? msg("tl.rateLimited") : undefined,
          ms: m.finalizedMs,
          signature: m.signature,
          tone: "ok",
        });
      } else {
        setPhase("holding");
        const m = await sendSetup(operator, settle);
        if (m.error) throw new KeyedError("err.holdTx", { error: m.error });
        if (m.finalizedMs === null) throw new KeyedError("err.holdUnconfirmed");
        setOutcome({ kind: "stopped", judge: decision });
        setPhase("stopped");
        playSfx("stamp");
        setShakeKey((k) => k + 1);
        scoreRun({ kind: "hold" });
        push({
          label: msg("tl.stopped"),
          detail: msg("tl.stoppedDetail", { decision: decision.decision }),
          signature: m.signature,
          tone: "warn",
        });
        const [view, slot] = await Promise.all([fetchEscrow(escrow), getSlot()]);
        if (view) setSlotsLeft(Math.max(0, view.deadlineSlot - slot));
      }
      await refreshBalances(p.publicKey, q);
      return true;
    } catch (e) {
      setMeasuringSince(null);
      setFailCount((n) => n + 1);
      setPhase("error");
      playSfx("fail");
      scoreRun({ kind: "fail" });
      push({
        label: msg("tl.failed"),
        detail: e instanceof KeyedError ? e.msg : describeError(lang, e),
        tone: "error",
      });
      return false;
    }
  };

  const play = async (sequence: Preset[], label: string) => {
    if (!session || !payee || running) return;
    setRunning(label);
    setTimeline([]); // 1 回の再生の中では hold → release を続けて残す
    try {
      for (const [i, preset] of sequence.entries()) {
        if (i > 0) {
          for (let s = PAUSE_BETWEEN_SECONDS; s > 0; s--) {
            setCountdown({ next: preset.label, seconds: s });
            playNotes(countdownNotes(s));
            await sleep(1000);
          }
          setCountdown(null);
        }
        const ok = await runScenario(preset, session, payee);
        if (!ok) break;
      }
    } finally {
      setCountdown(null);
      setRunning(null);
    }
  };

  return (
    <div className="shell" data-phase={phase} data-stage={stage.phase} data-tone={tone} style={toneStyle}>
      <div className="bg-glow" aria-hidden="true" />
      <div className="tone-wash" key={`wash-${tone}`} aria-hidden="true" />
      <Ambient slotTimes={slotTimes} burstId={hit?.id ?? null} tone={TONE_RGB[tone]} />
      <OverdriveBack slot={currentSlot} tone={TONE_RGB[tone]} hitKey={hit?.id ?? null} />
      <Ticker items={ticker} />
      <header className="top">
        <div className="brand">
          <Logo hitKey={hit?.id ?? null} />
        </div>
        <div className="top-right">
          <ClusterPill status={alpenglow} currentSlot={currentSlot} fallbackRpc={usingFallbackRpc} />
          {alpenglow?.kind === "alpenglow" && <SlotPulse slotTimes={slotTimes} />}
          <button
            className="icon-btn"
            onClick={toggleMute}
            aria-pressed={!muted}
            aria-label={muted ? t("sfx.unmute") : t("sfx.mute")}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button className="icon-btn help-btn" onClick={() => setOnboarding(true)} aria-label={t("onboard.help")}>
            ?
          </button>
          <button className="lang-btn" onClick={toggle} aria-label={t("lang.switchLabel")}>
            {t("lang.switch")}
          </button>
          {ready && (
            <button
              className="icon-btn"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              aria-label={t("settings.label")}
            >
              ⚙
            </button>
          )}
        </div>
      </header>

      {ready && showSettings && (
        <section className="settings">
          <input
            type="password"
            placeholder={t("settings.token")}
            value={jevToken}
            onChange={(e) => setJevToken(e.target.value)}
            autoComplete="off"
            aria-label={t("settings.token")}
          />
          <div className="settings-actions">
            <button className="link-btn" onClick={sweep} disabled={!!running}>
              {t("settings.sweep")}
            </button>
            {sweepNote && <span className="hint">{sweepText(sweepNote)}</span>}
            <button
              className="link-btn"
              onClick={() => {
                if (session?.kind === "wallet") void wallet.disconnect();
                setSession(null);
                setPayee(null);
                setShowSettings(false);
              }}
              disabled={!!running}
            >
              {t("settings.swapKey")}
            </button>
          </div>
        </section>
      )}

      {/* 箱で区切らない（#56）。中央の舞台と、左右に浮かぶ計器だけで 1 枚の画面にする */}
      <div className="cockpit">
      <aside className="dock dock-left">
        <Hud game={game} gain={gain} />
        <div className="gauge gauge-result">
          <span className="gauge-tag">{t("card.result")}</span>
          <ResultPanel outcome={outcome} measuringSince={measuringSince} slotsLeft={slotsLeft} grade={grade} />
          <History history={history} />
        </div>
      </aside>

      <div className="arena" ref={stageCardRef}>
        {levelUp !== null && (
          <div className="levelup" aria-live="assertive">
            <span>{t("game.levelUp")}</span>
            <strong>LV {levelUp}</strong>
          </div>
        )}
        {ready && <ProgressTrack phase={phase} beforeError={beforeError} />}
        <FlowStage
          phase={stage.phase}
          payer={{ address: payerKey, balance: balances.payer }}
          payee={{ address: payee, balance: balances.payee }}
          vaultLamports={stage.vaultLamports}
          judgement={stage.judgement}
          fallbackReason={fallbackReason ? tm(fallbackReason) : null}
          thresholdBps={RELEASE_THRESHOLD_BPS}
          runKey={stage.runKey}
          replayMs={attract ? attractMs(history) : null}
          finalizedMs={outcome?.kind === "sent" ? outcome.measurement.finalizedMs : null}
        />
        {!ready ? (
          <div className="setup">
            <p className="setup-title">{t("setup.title")}</p>
            <div className="setup-actions">
              <WalletMultiButton />
              <button className="trial-btn" onClick={startTrial} disabled={preparing}>
                {preparing ? t("setup.trialing") : t("setup.trial")}
              </button>
            </div>
            <p className="hint">{t("setup.trialHint")}</p>
            {keyError && (
              <p className="error" role="alert">
                {tm(keyError)}
              </p>
            )}
            <details className="paste-key">
              <summary>{t("setup.pasteToggle")}</summary>
              <input
                type="password"
                placeholder={t("setup.placeholder")}
                value={keyInput}
                onChange={(e) => onKeyInput(e.target.value)}
                autoComplete="off"
                aria-label={t("setup.keyLabel")}
              />
              <p className="hint key-warning">{t("setup.warning")}</p>
            </details>
          </div>
        ) : (
          <div className="controls">
            {lowBalance && (
              <div className="fund-row">
                <span className="hint">{t("setup.lowBalance")}</span>
                <button className="link-btn" onClick={fundWallet} disabled={funding || !!running}>
                  {funding ? t("setup.funding") : t("setup.fundWallet")}
                </button>
              </div>
            )}
            {keyError && (
              <p className="error" role="alert">
                {tm(keyError)}
              </p>
            )}
            <button
              className={`play ${running && !countdown ? "is-running" : ""}`}
              onClick={() => play(DEMO_SEQUENCE, "demo")}
              disabled={!!running || !sendingAllowed}
            >
              <span className="play-icon" aria-hidden="true">
                {countdown ? (
                  <span className="play-count" key={countdown.seconds}>
                    {countdown.seconds}
                  </span>
                ) : running ? (
                  <span className="play-steps">
                    {stepStates(phase, beforeError).map((state, i) => (
                      <i key={i} className={`play-step play-step-${state}`} />
                    ))}
                  </span>
                ) : (
                  "▶"
                )}
              </span>
              <span aria-live="polite">
                <strong>
                  {countdown ? t("play.next", { next: countdown.next }) : running ? t("play.running") : t("play.demo")}
                </strong>
                <small>{t("play.sub")}</small>
              </span>
            </button>
            <div className="chips" role="group" aria-label={t("play.chips")}>
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  className={`chip-btn chip-${p.key}`}
                  onClick={() => play([p], p.key)}
                  disabled={!!running || !sendingAllowed}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <aside className="dock dock-right">
        {currentTask && (
          <div className="gauge gauge-judge">
            <span className="gauge-tag">{t("judge.title")}</span>
            <JudgePanel
              task={currentTask}
              judging={phase === "judging"}
              judgement={judgement}
              thresholdBps={RELEASE_THRESHOLD_BPS}
              runKey={runKey}
            />
          </div>
        )}
        <div className="gauge gauge-timeline">
          <span className="gauge-tag">{t("card.timeline")}</span>
          <Timeline entries={timeline} />
        </div>
      </aside>
      </div>

      <Ticker items={ticker} reverse />
      <footer className="foot">
        <SolanaLogo label={t("foot.solana")} />
        <p>{t("app.footer")}</p>
        <p className="foot-note">{t("foot.notAffiliated")}</p>
      </footer>
      <OverdriveFront slot={currentSlot} energy={energyOf(stage.phase)} phase={stage.phase} />
      <Toasts toasts={toasts} />
      <Onboarding
        open={onboarding}
        onStart={() => {
          playSfx("levelup");
          starShower();
        }}
        onClose={() => {
          setOnboarding(false);
          saveOnboarded();
        }}
      />
      <FinalityHit hit={hit} />
      <CountdownHit countdown={countdown} />
      <div className="dim-veil" aria-hidden="true" />
      <BadgeOverlay badge={badge} onDone={clearBadge} />
    </div>
  );
}

function ClusterPill({
  status,
  currentSlot,
  fallbackRpc,
}: {
  status: AlpenglowStatus | null;
  currentSlot: number | null;
  fallbackRpc: boolean;
}) {
  const { t, tm } = useLang();
  const tone = !status ? "wait" : status.kind === "alpenglow" ? "ok" : status.kind === "legacy" ? "ng" : "warn";
  const label = !status
    ? t("pill.checking")
    : status.kind === "alpenglow"
      ? t("pill.alpenglow")
      : status.kind === "legacy"
        ? t("pill.legacy")
        : t("pill.unknown", { reason: tm(status.reason) });
  return (
    <div className={`pill pill-${tone}`} role="status">
      <span className="pill-dot" />
      <div>
        <strong>{label}</strong>
        <span className="pill-sub">
          {status?.kind === "alpenglow" && (
            <span className="pill-genesis">{`${t("pill.genesis", { slot: status.genesisSlot.toLocaleString() })} · `}</span>
          )}
          {t("pill.slot")}{" "}
          <span className="slot-now" key={currentSlot ?? "none"}>
            {currentSlot?.toLocaleString() ?? "—"}
          </span>
        </span>
        {fallbackRpc && <span className="pill-fallback">{t("pill.fallback")}</span>}
      </div>
    </div>
  );
}
