import { lazy, Suspense, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, MapPin, Clock, Scale } from "lucide-react";
import { whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";

const ModelStage = lazy(() => import("./ModelStage"));

// Gurú's slogan, typed like on a typewriter
const LINES = ["Una experiencia", "legal inteligente"];
const TOTAL = LINES.join("").length;

function TypedSlogan() {
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
    <h1
      aria-label="Una experiencia legal inteligente"
      className="metal-3d text-[clamp(2.5rem,8.2vw,6.4rem)] uppercase leading-[0.95]"
    >
      {LINES.map((line) => {
        const start = offset;
        offset += line.length;
        return (
          <span key={line} aria-hidden="true" className="block">
            {line.split("").map((ch, ci) => {
              const idx = start + ci;
              // "legal" goes in Gurú blue, everything else black
              const blue = line.startsWith("legal") && ci < 5;
              return (
                <span key={ci} className="relative">
                  <span className={`${idx < typed ? "opacity-100" : "opacity-0"} ${blue ? "text-guru" : ""}`}>{ch}</span>
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

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.5 },
});

export default function Hero() {
  return (
    <section id="top" className="paper-bg grain relative overflow-hidden border-b-2 border-ink">
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-8 text-center md:px-8 md:pb-20">
        <motion.div
          {...fadeUp(0)}
          className="brut-sm inline-flex items-center gap-2 rounded-full bg-guru px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white"
        >
          Tus documentos en manos de expertos
        </motion.div>

        {/* 3D scales of justice above the slogan, as on the current site */}
        <div className="relative -mb-2 h-[190px] w-[240px] md:h-[250px] md:w-[320px]">
          <Suspense fallback={null}>
            <ModelStage url="/models/scales.glb" color="#00c853" emissive="#00331a" fit={2.9} cameraZ={5} spin={0.35} shadow={false} />
          </Suspense>
        </div>

        <TypedSlogan />

        <motion.p {...fadeUp(0.8)} className="mt-7 max-w-2xl text-lg leading-relaxed text-ink/80 md:text-xl">
          Contratos, notarización, certificaciones, traducciones y trámites. Escríbenos por WhatsApp y un Gurú te atiende
          al momento.
        </motion.p>

        <motion.div {...fadeUp(1)} className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener"
            className="brut press inline-flex items-center gap-3 rounded-2xl bg-guru px-6 py-4 font-display text-base font-bold uppercase tracking-wide text-white md:text-lg"
          >
            <WhatsAppIcon className="h-6 w-6" /> Hablar con un Gurú
          </a>
          <a href="#servicios" className="group inline-flex items-center gap-2 font-bold underline decoration-2 underline-offset-4">
            Ver servicios <ArrowDown className="transition-transform group-hover:translate-y-1" size={20} />
          </a>
        </motion.div>

        <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm font-semibold">
          <span className="brut-sm inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5">
            <MapPin size={15} /> La Feria, frente a la OGM
          </span>
          <span className="brut-sm inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5">
            <Clock size={15} /> Respuesta al momento
          </span>
          <span className="brut-sm inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5">
            <Scale size={15} /> Desde los 90
          </span>
        </div>
      </div>
    </section>
  );
}
