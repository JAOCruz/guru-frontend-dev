// Public Cloudflare Turnstile site key. Each Netlify site builds with its own
// widget key (VITE_TURNSTILE_SITE_KEY in apps/dashboard/.env.production);
// empty (local dev) → no human check on the login.
export function turnstileSiteKey(): string {
  return import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
}
