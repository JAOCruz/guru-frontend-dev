import { Instagram, Mail, MapPin } from "lucide-react";
import { ADDRESS, EMAIL, INSTAGRAM, MAPS_URL, whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";

export default function Footer() {
  return (
    <footer className="border-t-[2.5px] border-ink bg-paper-2 px-4 pb-10 pt-14 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <img src="/img/logo.webp" alt="Gurú Soluciones" className="h-12 w-auto" />
          <p className="mt-4 max-w-sm text-ink/75">Tu mejor opción local dentro del mundo legal: solicitudes, poderes, contratos y más con precisión digital.</p>
        </div>
        <div className="space-y-3 font-semibold">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-guru">Contacto</p>
          <a className="flex items-center gap-2 hover:underline" href={whatsappLink()} target="_blank" rel="noopener"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</a>
          <a className="flex items-center gap-2 hover:underline" href={INSTAGRAM} target="_blank" rel="noopener"><Instagram size={16} /> Instagram</a>
          <a className="flex items-center gap-2 hover:underline" href={`mailto:${EMAIL}`}><Mail size={16} /> {EMAIL}</a>
        </div>
        <div className="space-y-3">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-guru">Ubicación</p>
          <a className="flex items-start gap-2 font-semibold hover:underline" href={MAPS_URL} target="_blank" rel="noopener"><MapPin size={16} className="mt-1 shrink-0" /> {ADDRESS}</a>
          <p className="text-sm text-ink/60">Entrada por el callejón del Plaspilito.</p>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-wrap justify-between gap-4 border-t border-ink/20 pt-6 text-sm text-ink/60">
        <span>© {new Date().getFullYear()} Gurú Soluciones · Santo Domingo</span>
        <a className="hover:underline" href="https://guruweb-dashboard-prod.netlify.app">Acceso del equipo</a>
      </div>
    </footer>
  );
}
