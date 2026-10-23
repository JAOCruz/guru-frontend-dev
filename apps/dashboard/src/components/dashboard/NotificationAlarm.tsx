import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellRing } from "lucide-react";
import api from "../../services/api";
import { notificationPath } from "../../lib/notificationLinks";

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  link?: string;
}

interface NotificationAlarmProps {
  onUnreadCountChange?: (count: number) => void;
  onOpenList?: () => void; // opens the bell list (used by the summary on load)
  pollMs?: number;
}

// Short two-tone chime with Web Audio; silently does nothing if the browser blocks sound.
function chime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // ignore
  }
}

function systemNotify(list: AppNotification[]) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
    const first = list[0];
    const title = list.length > 1 ? `${list.length} notificaciones nuevas` : first.title;
    new Notification(title, { body: list.length > 1 ? first.title : first.message, tag: "guru-notificaciones" });
  } catch {
    // ignore
  }
}

const stripCount = (t: string) => t.replace(/^\(\d+\)\s/, "");

// Visual alarm: new notifications open a window that stays until the user closes it with a button.
const NotificationAlarm: React.FC<NotificationAlarmProps> = ({ onUnreadCountChange, onOpenList, pollMs = 15000 }) => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [summary, setSummary] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState<string>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const seen = useRef<Set<number>>(new Set());
  const firstPoll = useRef(true);
  const baseTitle = useRef(stripCount(document.title));

  const updateUnread = useCallback((count: number) => {
    setUnread(count);
    onUnreadCountChange?.(count);
  }, [onUnreadCountChange]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await api.get("/notifications", { params: { unread: "true", limit: 20 } });
        if (!alive) return;
        const list: AppNotification[] = res.data.notifications || [];
        updateUnread(res.data.unreadCount || 0);
        const fresh = list.filter((x) => !seen.current.has(x.id));
        fresh.forEach((x) => seen.current.add(x.id));
        if (firstPoll.current) {
          firstPoll.current = false;
          if ((res.data.unreadCount || 0) > 0) setSummary(res.data.unreadCount);
          return;
        }
        if (fresh.length) {
          setAlerts((prev) => [...fresh, ...prev]);
          chime();
          systemNotify(fresh);
        }
      } catch {
        // ignore: the next poll tries again
      }
    };
    poll();
    const interval = setInterval(poll, pollMs);
    return () => { alive = false; clearInterval(interval); };
  }, [pollMs, updateUnread]);

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) ${baseTitle.current}` : baseTitle.current;
  }, [unread]);
  useEffect(() => () => { document.title = baseTitle.current; }, []);

  const markRead = (item: AppNotification) => {
    setAlerts((prev) => prev.filter((x) => x.id !== item.id));
    setUnread((c) => {
      const next = Math.max(0, c - 1);
      onUnreadCountChange?.(next);
      return next;
    });
    api.post(`/notifications/${item.id}/read`).catch(() => {});
  };
  const open = (item: AppNotification) => {
    markRead(item);
    const path = notificationPath(item.link);
    if (path) navigate(path);
  };
  const markAll = async () => {
    setAlerts([]);
    setSummary(null);
    updateUnread(0);
    try { await api.post("/notifications/read-all"); } catch { /* ignore */ }
  };
  const askPermission = async () => {
    try { setPermission(await Notification.requestPermission()); } catch { /* ignore */ }
  };

  if (!alerts.length && summary === null) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* The backdrop does not close the window: it only closes with a button. */}
      <div data-testid="notification-alarm-backdrop" className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="notification-alarm-title"
        className="relative w-full max-w-md animate-in zoom-in-95 fade-in-0 rounded-base border-2 border-border bg-background p-5 shadow-shadow"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 animate-pulse items-center justify-center rounded-full border-2 border-border bg-main text-main-foreground">
            <BellRing size={20} />
          </span>
          <h2 id="notification-alarm-title" className="font-heading text-lg font-black uppercase tracking-wider">
            {alerts.length ? (alerts.length > 1 ? `${alerts.length} notificaciones nuevas` : "Notificación nueva") : "Notificaciones pendientes"}
          </h2>
        </div>

        {alerts.length ? (
          <div className="max-h-[50vh] space-y-3 overflow-y-auto custom-scroll">
            {alerts.map((item) => (
              <div key={item.id} className="rounded-base border-2 border-main bg-main/5 p-3">
                <p className="font-bold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-foreground/75">{item.message}</p>
                <div className="mt-3 flex gap-2">
                  {notificationPath(item.link) && (
                    <button
                      type="button"
                      onClick={() => open(item)}
                      className="rounded-base border-2 border-border bg-main px-3 py-1.5 text-sm font-bold text-main-foreground shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                    >
                      Ver
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => markRead(item)}
                    className="rounded-base border-2 border-border bg-secondary-background px-3 py-1.5 text-sm font-bold text-foreground shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-base text-foreground">
            Tienes <strong>{summary} {summary === 1 ? "notificación sin leer" : "notificaciones sin leer"}</strong>.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t-2 border-border pt-4">
          {permission === "default" ? (
            <button type="button" onClick={askPermission} className="text-xs font-bold text-main underline">
              Avisarme también en el escritorio
            </button>
          ) : <span />}
          <div className="flex gap-2">
            {!alerts.length && (
              <button
                type="button"
                onClick={() => { setSummary(null); onOpenList?.(); }}
                className="rounded-base border-2 border-border bg-main px-3 py-1.5 text-sm font-bold text-main-foreground shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                Ver notificaciones
              </button>
            )}
            {(alerts.length > 1 || !alerts.length) && (
              <button
                type="button"
                onClick={markAll}
                className="rounded-base border-2 border-border bg-secondary-background px-3 py-1.5 text-sm font-bold text-foreground shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationAlarm;
