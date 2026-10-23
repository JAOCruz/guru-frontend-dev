import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { Send } from "lucide-react";
import { useSectionProgress } from "../lib/useSectionProgress";
import { whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";
import { prefersReducedMotion } from "../three/owl/webgl";
import ScrollVideo from "./ScrollVideo";

// Pre-rendered from the 3D scene (tools/delivery-video): plays with the scroll
const v = (name: string, focus: string) => ({
  av1: `/video/${name}-av1.mp4`,
  hevc: `/video/${name}-hevc.mp4`,
  h264: `/video/${name}-h264.mp4`,
  start: `/video/${name}-start.webp`,
  rev: { av1: `/video/${name}-rev-av1.mp4`, hevc: `/video/${name}-rev-hevc.mp4`, h264: `/video/${name}-rev-h264.mp4` },
  end: `/video/${name}-end.webp`,
  focus,
});
// the owl is framed right of the text panel (desktop) / below it (phones): crop toward it
const LANDSCAPE = v("delivery-desktop", "72% 50%");
const PORTRAIT = v("delivery-mobile", "50% 78%");
// resting poses (share of the flight): wings open, leaving La Feria, over the city — plus start and end
const RESTS = [0.12, 0.26, 0.52];
const DELIVERED_AT = 0.93;

const COPY = {
  eyebrow: "Mensajería Express",
  title: "Tus documentos, volando a su destino",
  text: "Depósito y entrega rápida y segura de documentos importantes.",
  cta: "Enviar un documento",
};

function Badge({ show }: { show: boolean }) {
  return (
    <motion.div
      aria-hidden={!show}
      initial={false}
      animate={show ? { opacity: 1, scale: 1, rotate: -8 } : { opacity: 0, scale: 2.4, rotate: -20 }}
      transition={{ type: "spring", stiffness: 420, damping: 22, mass: 0.8 }}
      className="brut pointer-events-none absolute inset-x-0 bottom-4 z-20 mx-auto w-max rounded-2xl bg-mint px-4 py-2 font-display text-lg font-black uppercase text-ink shadow-[var(--shadow-hard-lg)] md:inset-x-auto md:bottom-12 md:right-12 md:mx-0 md:px-7 md:py-4 md:text-3xl"
    >
      Entregado ✓
    </motion.div>
  );
}

function Panel({ progress }: { progress: MotionValue<number> }) {
  const width = useTransform(progress, (v: number) => `${Math.round(Math.min(1, Math.max(0, (v - 0.08) / 0.77)) * 100)}%`);
  return (
    <div className="brut absolute left-3 right-3 top-3 z-10 rounded-[22px] bg-paper p-4 md:left-8 md:right-auto md:top-1/2 md:w-[420px] md:-translate-y-1/2 md:rounded-[26px] md:p-8">
      <span className="brut-sm inline-block rounded-full bg-guru px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">{COPY.eyebrow}</span>
      <h2 className="mt-3 font-display text-[clamp(1.25rem,5.4vw,1.75rem)] font-black uppercase leading-[1.02] md:mt-4 md:text-[clamp(1.5rem,2.3vw,2.1rem)]">{COPY.title}</h2>
      <p className="mt-2 text-[16px] leading-snug text-ink/80 md:mt-5 md:text-lg md:leading-relaxed">{COPY.text}</p>
      {/* route progress */}
      <div className="mt-4 hidden items-center gap-3 text-xs font-bold uppercase tracking-wider text-ink/70 md:flex">
        <span>La Feria</span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
          <motion.div style={{ width }} className="absolute inset-y-0 left-0 bg-mint" />
        </div>
        <span>Tu puerta</span>
      </div>
      <a
        href={whatsappLink("Hola Gurú, necesito enviar un documento.")}
        target="_blank"
        rel="noopener"
        className="brut press mt-3 inline-flex items-center justify-center gap-3 rounded-2xl bg-mint px-4 py-2.5 font-display text-sm font-bold uppercase text-ink md:mt-6 md:px-7 md:py-4 md:text-lg"
      >
        <WhatsAppIcon className="h-5 w-5 md:h-6 md:w-6" /> {COPY.cta}
      </a>
    </div>
  );
}

export default function Delivery() {
  const section = useRef<HTMLElement>(null);
  const progress = useSectionProgress(section);
  const [reduced, setReduced] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const done = useMotionValue(1);

  useEffect(() => setReduced(prefersReducedMotion()), []);
  useMotionValueEvent(progress, "change", (v) => setDelivered(v > DELIVERED_AT));

  return (
    <section id="mensajeria" ref={section} className={`relative border-y-2 border-ink bg-[#060a2b] ${reduced ? "" : "h-[200vh]"}`}>
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden md:top-20 md:h-[calc(100svh-5rem)]">
        <ScrollVideo progress={progress} landscape={LANDSCAPE} portrait={PORTRAIT} rests={RESTS} still={reduced} label="El Búho de Gurú vuela con tu maletín de documentos desde La Feria hasta tu puerta" />
        {/* readability scrim behind the panel side */}
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[520px] bg-[linear-gradient(90deg,rgb(6_10_43/0.55),transparent)] md:block" />
        <Panel progress={reduced ? done : progress} />
        <Badge show={delivered || reduced} />
        {!reduced && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 rounded-full border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink md:flex">
            <Send className="h-3.5 w-3.5" /> Desplaza para volar
          </div>
        )}
      </div>
    </section>
  );
}
