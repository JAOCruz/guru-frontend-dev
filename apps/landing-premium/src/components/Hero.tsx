import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { Send } from "lucide-react";
import { useSectionProgress } from "../lib/useSectionProgress";
import { whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";
import { prefersReducedMotion } from "../three/owl/webgl";
import ScrollVideo from "./ScrollVideo";

// Hero: Gurú's slogan over the owl on the office roof; scrolling flies the owl with the client's
// documents to their door (pre-rendered from the 3D scene, tools/delivery-video), and the landing
// reveals the Mensajería Express card.
const v = (name: string, focus: string) => ({
  av1: `/video/${name}-av1.mp4`,
  hevc: `/video/${name}-hevc.mp4`,
  h264: `/video/${name}-h264.mp4`,
  rev: { av1: `/video/${name}-rev-av1.mp4`, hevc: `/video/${name}-rev-hevc.mp4`, h264: `/video/${name}-rev-h264.mp4` },
  start: `/video/${name}-start.webp`,
  end: `/video/${name}-end.webp`,
  focus,
});
// the owl is framed right of the text (desktop) / below it (phones): crop toward it
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

// Gurú's slogan, typed like on a typewriter
const LINES = ["Una experiencia", "legal inteligente"];
const TOTAL = LINES.join("").length;

function TypedSlogan({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(reduce ? TOTAL : 0);

  useEffect(() => {
    if (reduce) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= TOTAL) window.clearInterval(id);
    }, 70);
    return () => window.clearInterval(id);
  }, [reduce]);

  let offset = 0;
  return (
    <h1 aria-label="Una experiencia legal inteligente" className={`uppercase leading-[1.02] ${className}`}>
      {LINES.map((line, li) => {
        const start = offset;
        offset += line.length;
        // like the logo: the first line as "GURÚ", the second as "SOLUCIONES"
        return (
          <span key={line} aria-hidden="true" className={li === 0 ? "title-logo-top" : "title-logo-bottom mt-[0.08em] text-[0.92em]"}>
            {line.split("").map((ch, ci) => {
              const idx = start + ci;
              return (
                <span key={ci} className={idx < typed ? "" : "opacity-0"}>
                  {ch}
                </span>
              );
            })}
          </span>
        );
      })}
    </h1>
  );
}

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

function Panel({ progress, className }: { progress: MotionValue<number>; className: string }) {
  const width = useTransform(progress, (p: number) => `${Math.round(Math.min(1, Math.max(0, (p - 0.08) / 0.77)) * 100)}%`);
  return (
    <div className={`brut rounded-[22px] bg-paper p-4 md:rounded-[26px] md:p-8 ${className}`}>
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

const SLOGAN_SIZE = "text-[clamp(1.9rem,8vw,2.5rem)] md:text-[clamp(2.1rem,min(3.6vw,6vh),3.6rem)]";
// centered at the top, over the night sky above the owl, like a game title screen
const SLOGAN_SPOT = "inset-x-4 top-6 text-center md:top-[6%]";

export default function Hero() {
  const section = useRef<HTMLElement>(null);
  const progress = useSectionProgress(section);
  const [reduced, setReduced] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const done = useMotionValue(1);

  useEffect(() => setReduced(prefersReducedMotion()), []);
  useMotionValueEvent(progress, "change", (p) => setDelivered(p > DELIVERED_AT));

  // the slogan leaves as the owl takes off; the card arrives with the landing
  const sloganOpacity = useTransform(progress, [0, 0.05, 0.13], [1, 1, 0]);
  const sloganY = useTransform(progress, [0, 0.13], [0, -40]);
  const cardOpacity = useTransform(progress, [0.8, 0.88], [0, 1]);
  const cardY = useTransform(progress, [0.8, 0.88], [28, 0]);
  const cardEvents = useTransform(progress, (p) => (p > 0.84 ? "auto" : "none"));
  const hintOpacity = useTransform(progress, [0, 0.06], [1, 0]);

  const label = "El Búho de Gurú vuela con tu maletín de documentos desde La Feria hasta tu puerta";

  if (reduced) {
    // no motion: the starting picture with the slogan, the delivery card right below it
    return (
      <section id="top" className="border-b-2 border-ink bg-[#060a2b]">
        <div className="relative h-[calc(100svh-4rem)] overflow-hidden md:h-[calc(100svh-5rem)]">
          <ScrollVideo progress={progress} landscape={LANDSCAPE} portrait={PORTRAIT} still stillFrame="start" label={label} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(6_10_43/0.65),transparent_40%)]" />
          <div className={`absolute z-10 ${SLOGAN_SPOT}`}>
            <TypedSlogan className={SLOGAN_SIZE} />
          </div>
        </div>
        <div className="px-4 py-10 md:px-8">
          <Panel progress={done} className="mx-auto max-w-xl" />
        </div>
      </section>
    );
  }

  return (
    <section id="top" ref={section} className="relative h-[200vh] border-b-2 border-ink bg-[#060a2b]">
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden md:top-20 md:h-[calc(100svh-5rem)]">
        <ScrollVideo progress={progress} landscape={LANDSCAPE} portrait={PORTRAIT} rests={RESTS} preloadMargin="0px" label={label} />
        {/* readability scrim behind the title (top) */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(6_10_43/0.65),transparent_40%)]" />

        <div className={`pointer-events-none absolute z-10 ${SLOGAN_SPOT}`}>
          <motion.div style={{ opacity: sloganOpacity, y: sloganY }}>
            <TypedSlogan className={SLOGAN_SIZE} />
          </motion.div>
        </div>

        <div className="absolute inset-x-3 top-3 z-10 md:inset-x-auto md:left-8 md:top-1/2 md:w-[420px] md:-translate-y-1/2">
          <motion.div style={{ opacity: cardOpacity, y: cardY, pointerEvents: cardEvents }}>
            <Panel progress={progress} className="" />
          </motion.div>
        </div>
        <Badge show={delivered} />

        <motion.div style={{ opacity: hintOpacity }} className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink">
          <Send className="h-3.5 w-3.5" /> Desplaza para volar
        </motion.div>
      </div>
    </section>
  );
}
