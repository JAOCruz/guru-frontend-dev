// GA4 with Consent Mode v2. Off until VITE_GA_ID (the G-XXXX Measurement ID) is set at build time.
export const GA_ID = import.meta.env.VITE_GA_ID as string | undefined;
const KEY = "consent_v1";

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window { dataLayer: unknown[]; gtag?: Gtag }
}

export function savedConsent(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setConsent(value: "granted" | "denied") {
  try { localStorage.setItem(KEY, value); } catch { /* private mode */ }
  window.gtag?.("consent", "update", { analytics_storage: value });
}

export function startAnalytics() {
  if (!GA_ID || typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  // gtag must push the arguments object itself
  window.gtag = function () { window.dataLayer.push(arguments); } as Gtag;
  window.gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    analytics_storage: savedConsent() === "granted" ? "granted" : "denied",
    wait_for_update: 500,
  });
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { anonymize_ip: true });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  // Leads: every WhatsApp / email link, with the section it was clicked in
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return;
    const where = a.closest("section")?.id || (a.closest("footer") ? "footer" : "flotante");
    if (/wa\.me|whatsapp\.com/.test(a.href)) window.gtag?.("event", "whatsapp_click", { location: where });
    else if (a.href.startsWith("mailto:")) window.gtag?.("event", "email_click", { location: where });
  });
}
