import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";

const LINKS = [
  { href: "#servicios", label: "Servicios" },
  { href: "#historia", label: "Historia" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#ubicacion", label: "Ubicación" },
];
// Team login to the dashboard, same link as the previous site's menu
const TEAM_URL = "https://guruweb-dashboard-prod.netlify.app/login";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 border-b-[2.5px] border-ink transition-colors ${scrolled ? "bg-paper/95 backdrop-blur" : "bg-paper"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-20 md:px-8">
        <a href="#top" aria-label="Gurú Soluciones, inicio">
          <img src="/img/logo.webp" alt="Gurú Soluciones" className="h-9 w-auto md:h-11" />
        </a>
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[15px] font-semibold hover:bg-ink hover:text-paper">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={TEAM_URL}
            className="brut-sm press hidden items-center rounded-full bg-paper px-4 py-2 text-sm font-bold md:inline-flex"
          >
            ¿Trabajas con nosotros?
          </a>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener"
            className="brut-sm press hidden items-center gap-2 rounded-full bg-mint px-4 py-2 text-sm font-bold sm:inline-flex"
          >
            <WhatsAppIcon className="h-4 w-4" /> Escríbenos
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="brut-sm grid h-10 w-10 place-items-center rounded-full bg-guru text-white lg:hidden"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t-[2.5px] border-ink bg-paper px-4 pb-5 pt-2 lg:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block border-b border-ink/15 py-4 font-display text-lg font-bold">
              {l.label}
            </a>
          ))}
          <a href={TEAM_URL} className="block border-b border-ink/15 py-4 font-display text-lg font-bold text-guru">
            ¿Trabajas con nosotros?
          </a>
          <a href={whatsappLink()} target="_blank" rel="noopener" className="brut press mt-4 flex items-center justify-center gap-2 rounded-2xl bg-mint py-4 font-bold">
            <WhatsAppIcon /> Escríbenos por WhatsApp
          </a>
        </nav>
      )}
    </header>
  );
}
