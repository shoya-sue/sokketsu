export type Toast = { id: number; icon: string; title: string; body: string; tone: "gold" | "green" | "purple" };

type Props = { toasts: Toast[] };

/** 実績解除・レベルアップを右下に積む（自動で消すのは呼び出し側）。 */
export function Toasts({ toasts }: Props) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <span className="toast-icon" aria-hidden="true">
            {toast.icon}
          </span>
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.body}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
