type Props = {
  /** 変わるたびにロゴを叩いて光らせる（確定の瞬間）。 */
  hitKey?: number | null;
};

/**
 * 動くロゴ（#47）。12 片の判断リングが回り続け、稲妻が一定の間隔で走り、ワードマークは光が流れてときどきグリッチする。
 * 確定の瞬間（hitKey が変わる）はマークごと跳ねる。reduced-motion ではグローバルの規則で止まる。
 * 図形は public/logo-mark.svg（favicon）と同じ。
 */
export function Logo({ hitKey = null }: Props) {
  return (
    <div className={`logo ${hitKey !== null ? "is-hit" : ""}`} key={hitKey ?? "idle"}>
      <svg className="logo-mark" viewBox="0 0 128 128" aria-hidden="true">
        <defs>
          <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9945ff" />
            <stop offset="0.55" stopColor="#00d1ff" />
            <stop offset="1" stopColor="#14f195" />
          </linearGradient>
          <linearGradient id="logo-bolt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#fff3c4" />
          </linearGradient>
        </defs>
        <rect className="logo-plate" width="128" height="128" rx="30" fill="url(#logo-bg)" />
        <circle cx="64" cy="64" r="42" fill="#07060d" opacity="0.9" />
        <circle
          className="logo-ring"
          cx="64"
          cy="64"
          r="42"
          fill="none"
          stroke="url(#logo-bg)"
          strokeWidth="7"
          strokeDasharray="17.6 4.4"
        />
        <circle className="logo-spark" cx="64" cy="64" r="42" fill="none" strokeWidth="7" strokeDasharray="17.6 246" />
        <path
          className="logo-bolt"
          d="M72 22 L41 71 H60 L53 106 L88 54 H68 Z"
          fill="url(#logo-bolt)"
          stroke="#07060d"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </svg>
      <h1 className="logo-word" data-text="Sokketsu">
        Sokketsu
      </h1>
    </div>
  );
}
