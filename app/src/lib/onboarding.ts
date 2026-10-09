/** 初回の案内ポップアップ（#53）。見終わったら localStorage に覚え、2 回目からは出さない。 */
export const ONBOARDING_KEY = "sokketsu.onboarded.v1";
export const ONBOARDED = "1";

/** 保存された値から、案内を出すかどうか。見終わった印（"1"）があるときだけ出さない。 */
export const shouldShowOnboarding = (stored: string | null): boolean => stored !== ONBOARDED;

/** 案内の 3 枚（順に跳ねて出る）。文言は i18n の onboard.<key>.title / body。 */
export const ONBOARDING_STEPS = [
  { key: "typed", icon: "⚖️" },
  { key: "verify", icon: "🔏" },
  { key: "finality", icon: "⚡" },
] as const;

/** カード i が跳ねて出るまでの遅れ（ms）。開く演出の後に 0.18 秒ずつずらす。 */
export const stepDelayMs = (i: number): number => 420 + i * 180;
