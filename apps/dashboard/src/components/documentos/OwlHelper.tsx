import { useEffect, useState } from "react";
import { X } from "lucide-react";

const KEY = "guru-os-owl-hidden";

// The owl's speech bubble: one short hint that follows what the digitador is doing.
// Fixed on desktop (next to the dashboard's own owl, never over the action buttons),
// a plain strip under the header on phones. Dismissed for the session with the ×.
export default function OwlHelper({ message }: { message: string }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  const [bump, setBump] = useState(false);

  useEffect(() => {
    setBump(true);
    const t = setTimeout(() => setBump(false), 400);
    return () => clearTimeout(t);
  }, [message]);

  if (hidden) return null;
  const hide = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* private mode: just hides for this render */
    }
  };

  return (
    <div className="gos-owl" data-bump={bump} role="status" aria-live="polite">
      <div className="gos-owl-bubble">
        <span aria-hidden="true" className="shrink-0 text-base leading-none">
          🦉
        </span>
        <span className="min-w-0 flex-1">{message}</span>
        <button type="button" onClick={hide} aria-label="Ocultar la ayuda del búho" className="gos-owl-close">
          <X size={12} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
