import { motion } from "framer-motion";
import { Baby, Car, CalendarClock, FileSearch, HeartHandshake, Home, KeyRound, ScrollText, UserCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";

// The "ventanilla": everyday models from the office catalog, bought (and filled with the client's data)
// through WhatsApp, plus scheduling a custom drafting. Leandro can swap the models here.
const MODELS: { name: string; group: string; icon: LucideIcon }[] = [
  { name: "Acto de venta de vehículo", group: "Bienes traslativos", icon: Car },
  { name: "Acto de venta de inmueble", group: "Bienes traslativos", icon: Home },
  { name: "Contrato de alquiler de vivienda", group: "Rentas o alquileres", icon: KeyRound },
  { name: "Poder de autorización para viaje de menor", group: "Poderes", icon: Baby },
  { name: "Declaración de soltería", group: "Estado civil", icon: UserCheck },
  { name: "Divorcio por mutuo consentimiento", group: "Estado civil", icon: HeartHandshake },
  { name: "Pagaré notarial", group: "Financieros", icon: ScrollText },
  { name: "Declaración jurada de pérdida de documentos", group: "Declaraciones juradas", icon: FileSearch },
];

export default function Templates() {
  return (
    <section id="modelos" className="border-y-2 border-ink bg-paper-2 px-4 py-20 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.25em] text-guru">Ventanilla Gurú</p>
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
              Tenemos más de 300 modelos legales. Elige el tuyo, pídelo por WhatsApp y te lo entregamos con tus datos.
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

        <ul className="mt-10 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {MODELS.map(({ name, group, icon: Icon }) => (
            <li key={name} className="brut flex flex-col rounded-2xl bg-paper p-3.5 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-ink bg-guru text-white md:h-11 md:w-11">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="hidden text-right text-[11px] font-bold uppercase tracking-wider text-ink/60 md:block">{group}</span>
              </div>
              <h3 className="mt-3 flex-1 font-display text-[13px] font-bold uppercase leading-tight md:mt-4 md:text-base">{name}</h3>
              <a
                href={whatsappLink(`Hola Gurú, quiero comprar el modelo: ${name}.`)}
                target="_blank"
                rel="noopener"
                className="brut-sm press mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-mint px-3 py-2 font-display text-xs font-bold uppercase text-ink md:mt-5 md:px-4 md:py-2.5 md:text-sm"
              >
                <WhatsAppIcon className="h-4 w-4" /> Comprar
              </a>
            </li>
          ))}
        </ul>

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
