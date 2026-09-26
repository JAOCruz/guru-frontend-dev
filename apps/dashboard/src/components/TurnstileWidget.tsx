import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("turnstile script failed")));
  });
}

interface Props {
  siteKey: string;
  onToken: (token: string | null) => void;
  resetSignal?: number; // bump to get a fresh token (tokens are single-use)
}

// Cloudflare Turnstile "¿eres humano?" check (Managed mode: usually no click needed)
export default function TurnstileWidget({ siteKey, onToken, resetSignal = 0 }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          language: "es",
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) {
      onTokenRef.current(null);
      window.turnstile.reset(widgetId.current);
    }
  }, [resetSignal]);

  return <div ref={container} className="flex justify-center" />;
}
