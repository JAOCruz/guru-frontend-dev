// Turns the link stored with a notification into a dashboard route.
// Older notifications point to paths that never existed (/documentos, /cases/45, /dashboard/...).
export function notificationPath(link?: string | null): string | null {
  if (!link) return null;
  let p = link.startsWith("/") ? link : `/${link}`;
  p = p.replace(/^\/dashboard(?=\/|$)/, "") || "/";
  const [path, query] = p.split("?");
  let route = path;
  if (route === "/documentos") route = "/documents";
  if (/^\/cases\/\d+$/.test(route)) route = "/cases";
  return query ? `${route}?${query}` : route;
}
