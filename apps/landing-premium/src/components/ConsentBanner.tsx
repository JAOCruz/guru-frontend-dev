import { useState } from "react";
import { GA_ID, savedConsent, setConsent } from "../lib/analytics";

// Asks once before analytics cookies are used (only when analytics is configured)
export default function ConsentBanner() {
  const [open, setOpen] = useState(() => Boolean(GA_ID) && !savedConsent());
  if (!open) return null;
  const answer = (v: "granted" | "denied") => { setConsent(v); setOpen(false); };
  return (
    <div role="dialog" aria-label="Cookies" className="brut fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-2xl bg-paper p-4 text-sm md:text-base">
      <span className="min-w-[12rem] flex-1">Usamos cookies de analítica para mejorar el sitio.</span>
      <button type="button" onClick={() => answer("denied")} className="rounded-full border-2 border-ink px-4 py-2 font-bold">No</button>
      <button type="button" onClick={() => answer("granted")} className="brut-sm press rounded-full bg-guru px-4 py-2 font-bold text-white">Aceptar</button>
    </div>
  );
}
