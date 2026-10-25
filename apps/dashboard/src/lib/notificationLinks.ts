import { useRef } from "react";
import { useLocation } from "react-router-dom";

// Turns the link stored with a notification into a dashboard route.
// Older notifications point to paths that never existed (/documentos, /cases/45, /dashboard/...);
// /cases/45 opens that case.
export function notificationPath(link?: string | null): string | null {
  if (!link) return null;
  let p = link.startsWith("/") ? link : `/${link}`;
  p = p.replace(/^\/dashboard(?=\/|$)/, "") || "/";
  const [path, query] = p.split("?");
  let route = path;
  if (route === "/documentos") route = "/documents";
  const caseId = route.match(/^\/cases\/(\d+)$/)?.[1];
  if (caseId) return `/cases?case=${caseId}`;
  return query ? `${route}?${query}` : route;
}

// Opening a notification remounts the page, so it opens what the link points to even when it is
// the page already on screen (another chat in Mensajes, another case in Casos).
export const notificationNav = () => ({ state: { fromNotification: Date.now() } });

export function useNotificationPageKey(): number {
  const location = useLocation();
  const key = useRef(0);
  const last = useRef<number | null>(null);
  const opened = (location.state as { fromNotification?: number } | null)?.fromNotification ?? null;
  if (opened !== null && opened !== last.current) {
    last.current = opened;
    key.current += 1;
  }
  return key.current;
}
