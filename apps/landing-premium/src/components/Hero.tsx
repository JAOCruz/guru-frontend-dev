import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useTransform } from "framer-motion";
import { Send } from "lucide-react";
import { useSectionProgress } from "../lib/useSectionProgress";
import { prefersReducedMotion } from "../three/owl/webgl";
import ScrollVideo from "./ScrollVideo";

// Hero: Gurú's slogan over the owl on the office roof; scrolling flies the owl with the client's
// documents to their door (pre-rendered from the 3D scene, tools/delivery-video). The slogan stays
// on screen the whole flight.
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
    <h1 aria-label="Una experiencia legal inteligente" className={`metal-3d uppercase leading-[0.95] ${className}`}>
      {LINES.map((line) => {
        const start = offset;
        offset += line.length;
        return (
          <span key={line} aria-hidden="true" className="block">
            {line.split("").map((ch, ci) => {
              const idx = start + ci;
              // "legal" goes in Gurú green, everything else black
              const green = line.startsWith("legal") && ci < 5;
              return (
                <span key={ci} className="relative">
                  <span className={`${idx < typed ? "opacity-100" : "opacity-0"} ${green ? "text-mint" : ""}`}>{ch}</span>
                  {idx === typed - 1 && typed < TOTAL && (
                    <span className="absolute -right-[0.1em] top-[0.1em] h-[0.78em] w-[0.07em] animate-pulse bg-guru" />
                  )}
                </span>
              );
            })}
          </span>
        );
      })}
    </h1>
  );
}

// the scales of justice (the 3D model of the earlier cover, rendered once in Gurú green), small and centered above the slogan
function Scales() {
  return (
    <img
      src="/img/balanza-verde.webp"
      alt=""
      width={499}
      height={520}
      className="scales-sway mx-auto mb-2 block h-auto w-[54px] drop-shadow-[3px_3px_0_#f4f6f9] md:mb-3 md:w-[clamp(81px,6.3vw,117px)]"
    />
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


const SLOGAN_SIZE = "text-[clamp(2.5rem,11.5vw,3.6rem)] md:text-[clamp(3rem,min(6.5vw,13.5vh),8.4rem)]";
// big, in the top-left corner (Leandro's sketch: about 60% of the width, the top third); the owl stays on the right
const SLOGAN_SPOT = "inset-x-5 top-6 text-left md:inset-x-auto md:left-6 md:top-[4vh] lg:left-8";

export default function Hero() {
  const section = useRef<HTMLElement>(null);
  const progress = useSectionProgress(section);
  const [reduced, setReduced] = useState(false);
  const [delivered, setDelivered] = useState(false);

  useEffect(() => setReduced(prefersReducedMotion()), []);
  useMotionValueEvent(progress, "change", (p) => setDelivered(p > DELIVERED_AT));

  const hintOpacity = useTransform(progress, [0, 0.06], [1, 0]);

  const label = "El Búho de Gurú vuela con tu maletín de documentos desde La Feria hasta tu puerta";

  if (reduced) {
    // no motion: the starting picture with the slogan
    return (
      <section id="top" className="border-b-2 border-ink bg-[#060a2b]">
        <div className="relative h-[calc(100svh-4rem)] overflow-hidden md:h-[calc(100svh-5rem)]">
          <ScrollVideo progress={progress} landscape={LANDSCAPE} portrait={PORTRAIT} still stillFrame="start" label={label} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(6_10_43/0.65),transparent_40%)] md:bg-[linear-gradient(90deg,rgb(6_10_43/0.6),transparent_55%)]" />
          <div className={`absolute z-10 ${SLOGAN_SPOT}`}>
            {/* fit to the title so the scales sit centered above it */}
            <div className="w-fit">
              <Scales />
              <TypedSlogan className={SLOGAN_SIZE} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="top" ref={section} className="relative h-[200vh] border-b-2 border-ink bg-[#060a2b]">
      <div className="sticky top-16 h-[calc(100svh-4rem)] overflow-hidden md:top-20 md:h-[calc(100svh-5rem)]">
        <ScrollVideo progress={progress} landscape={LANDSCAPE} portrait={PORTRAIT} rests={RESTS} preloadMargin="0px" label={label} />
        {/* readability scrim behind the title (top on phones, left on desktop) */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(6_10_43/0.65),transparent_40%)]" />

        <div className={`pointer-events-none absolute z-10 ${SLOGAN_SPOT}`}>
          {/* fit to the title so the scales sit centered above it */}
          <div className="w-fit">
            <Scales />
            <TypedSlogan className={SLOGAN_SIZE} />
          </div>
        </div>

        <Badge show={delivered} />

        <motion.div style={{ opacity: hintOpacity }} className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border-2 border-ink bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink">
          <Send className="h-3.5 w-3.5" /> Desplaza para volar
        </motion.div>
      </div>
    </section>
  );
}
