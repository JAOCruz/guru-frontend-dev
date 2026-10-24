import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Baby, Briefcase, Building2, CalendarClock, Car, FileSearch, FileText, Gavel, HeartHandshake, Home, KeyRound, Landmark,
  Map, ScrollText, Search, UserCheck, Users, type LucideIcon,
} from "lucide-react";
import { whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";

// "Ventanilla Gurú": the models an admin approved in Revisión de etiquetas (dashboard → Documentos),
// read from the backend's public list, bought (and filled with the client's data) through WhatsApp.
// Until there are approved models, or if the list can't be loaded, it shows a few everyday ones.
const API = (import.meta.env.VITE_API_URL as string | undefined) || "https://guruweb-backend-production.up.railway.app/api";

interface Model { name: string; category: string | null }

const FEATURED: Model[] = [
  { name: "Acto de venta de vehículo", category: "Bienes traslativos" },
  { name: "Acto de venta de inmueble", category: "Bienes traslativos" },
  { name: "Contrato de alquiler de vivienda", category: "Rentas o alquileres" },
  { name: "Poder de autorización para viaje de menor", category: "Poderes" },
  { name: "Declaración de soltería", category: "Estado civil" },
  { name: "Divorcio por mutuo consentimiento", category: "Estado civil" },
  { name: "Pagaré notarial", category: "Financieros" },
  { name: "Declaración jurada de pérdida de documentos", category: "Inmobiliaria" },
];

// an icon from the category's (or the model's) words
const ICONS: [RegExp, LucideIcon][] = [
  [/veh[ií]cul/i, Car],
  [/menor|natalidad|nacid/i, Baby],
  [/divorcio|matrimonio|familia|herencia/i, HeartHandshake],
  [/alquiler|renta|arrend/i, KeyRound],
  [/inmueble|vivienda|inmobiliari|condominio/i, Home],
  [/poder/i, UserCheck],
  [/soltero|soltería|estado civil/i, Users],
  [/pagar[eé]|financier|moneda/i, ScrollText],
  [/comercial|sociedad|empresa|asamblea/i, Building2],
  [/demanda|recurso|alguacil|notificaci|sentencia|audiencia/i, Gavel],
  [/agrimensura|terreno|colindante/i, Map],
  [/laboral|trabajo/i, Briefcase],
  [/instancia|escrito|solicitud|certificaci/i, Landmark],
  [/p[eé]rdida|declaraci[oó]n/i, FileSearch],
];
const iconFor = (m: Model) => ICONS.find(([re]) => re.test(`${m.category || ""} ${m.name}`))?.[1] || FileText;

// "ACTO DE VENTA DE VEHICULO" → "Acto de venta de vehiculo" (the catalog is in capitals)
const tidy = (s: string) => {
  const t = s.trim();
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
};

const PAGE = 12;

// open now? Monday to Friday 9:00–18:00, Dominican Republic time (the hours the WhatsApp bot uses)
function openState(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Santo_Domingo", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  const weekday = day >= 1 && day <= 5;
  if (weekday && mins >= 9 * 60 && mins < 18 * 60) return { open: true, label: "Abierto ahora · hasta las 6:00 p.m." };
  const opensToday = weekday && mins < 9 * 60;
  const opensMonday = day === 5 || day === 6 || day === 0;
  return { open: false, label: `Cerrado · abrimos ${opensToday ? "hoy" : opensMonday ? "el lunes" : "mañana"} a las 9:00 a.m.` };
}

export default function Templates() {
  const [approved, setApproved] = useState<Model[] | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [hours] = useState(openState);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 6000);
    fetch(`${API}/public/models`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { models?: Model[] }) => setApproved((d.models || []).map((m) => ({ name: tidy(m.name), category: m.category ? tidy(m.category) : null }))))
      .catch(() => setApproved([]))
      .finally(() => window.clearTimeout(timer));
    return () => ctrl.abort();
  }, []);

  const live = Boolean(approved && approved.length);
  const models = live ? approved! : FEATURED;
  const groups = useMemo(() => [...new Set(models.map((m) => m.category).filter(Boolean))] as string[], [models]);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visible = models.filter((m) => (!group || m.category === group) && (!query || norm(`${m.name} ${m.category || ""}`).includes(norm(query))));

  return (
    <section id="modelos" className="border-y-2 border-ink bg-paper-2 px-4 py-20 md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* the window's sign */}
        <div className="brut overflow-hidden rounded-3xl bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-guru px-5 py-3 text-white md:px-8">
            <span className="font-display text-sm font-black uppercase tracking-[0.25em]">Ventanilla Gurú</span>
            <span className={`inline-flex items-center gap-2 rounded-full border-2 border-ink px-3 py-1 text-xs font-bold uppercase text-ink ${hours.open ? "bg-mint" : "bg-paper"}`}>
              <span className={`h-2 w-2 rounded-full ${hours.open ? "animate-pulse bg-ink" : "bg-ink/40"}`} /> {hours.label}
            </span>
          </div>

          <div className="flex flex-col gap-6 p-5 md:flex-row md:items-end md:justify-between md:p-8">
            <div className="max-w-2xl">
              <motion.h2
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="font-display text-[clamp(2rem,5vw,3.6rem)] font-black uppercase leading-none"
              >
                Modelos listos <span className="text-guru">para tu trámite</span>
              </motion.h2>
              <p className="mt-5 text-lg leading-relaxed text-ink/80">
                Elige tu modelo, pídelo por WhatsApp y te lo entregamos con tus datos. ¿Necesitas algo a la medida? Agenda una redacción.
              </p>
            </div>
            <a
              href={whatsappLink("Hola Gurú, quiero agendar una redacción.")}
              target="_blank"
              rel="noopener"
              className="brut press inline-flex shrink-0 items-center justify-center gap-3 self-start rounded-2xl bg-guru px-6 py-4 font-display text-base font-bold uppercase text-white md:self-auto md:text-lg"
            >
              <CalendarClock className="h-6 w-6" /> Agendar una redacción
            </a>
          </div>

          {live && (
            <div className="flex flex-col gap-3 border-t-2 border-ink px-5 py-4 md:px-8">
              <label className="relative w-full md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShown(PAGE);
                  }}
                  placeholder="Buscar modelo (ej. poder, alquiler)"
                  aria-label="Buscar modelo"
                  className="w-full rounded-xl border-2 border-ink bg-white py-2.5 pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-guru"
                />
              </label>
              {groups.length > 1 && (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
                  {[null, ...groups].map((g) => (
                    <button
                      key={g || "all"}
                      type="button"
                      onClick={() => {
                        setGroup(g);
                        setShown(PAGE);
                      }}
                      className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-xs font-bold uppercase ${group === g ? "bg-ink text-paper" : "bg-paper"}`}
                    >
                      {g || "Todos"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <ul className="mt-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {visible.slice(0, shown).map((m) => {
            const Icon = iconFor(m);
            return (
              <li key={m.name} className="brut flex flex-col rounded-2xl bg-paper p-3.5 md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-ink bg-guru text-white md:h-11 md:w-11">
                    <Icon className="h-5 w-5" />
                  </span>
                  {m.category && <span className="hidden text-right text-[11px] font-bold uppercase tracking-wider text-ink/60 md:block">{m.category}</span>}
                </div>
                <h3 className="mt-3 flex-1 font-display text-[13px] font-bold uppercase leading-tight md:mt-4 md:text-base">{m.name}</h3>
                <a
                  href={whatsappLink(`Hola Gurú, quiero comprar el modelo: ${m.name}.`)}
                  target="_blank"
                  rel="noopener"
                  className="brut-sm press mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-mint px-3 py-2 font-display text-xs font-bold uppercase text-ink md:mt-5 md:px-4 md:py-2.5 md:text-sm"
                >
                  <WhatsAppIcon className="h-4 w-4" /> Comprar
                </a>
              </li>
            );
          })}
        </ul>
        {live && visible.length === 0 && <p className="mt-6 text-center text-ink/70">No encontramos ese modelo. Escríbenos y te lo preparamos.</p>}
        {visible.length > shown && (
          <div className="mt-6 text-center">
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="brut-sm press rounded-full bg-paper px-5 py-2 font-bold">
              Ver más modelos ({visible.length - shown})
            </button>
          </div>
        )}

        <p className="mt-8 text-center text-base text-ink/70">
          ¿No está el que buscas?{" "}
          <a href={whatsappLink("Hola Gurú, busco un modelo que no vi en la página.")} target="_blank" rel="noopener" className="font-bold text-guru underline decoration-2 underline-offset-4">
            Pregúntanos por WhatsApp
          </a>
        </p>
      </div>
    </section>
  );
}
