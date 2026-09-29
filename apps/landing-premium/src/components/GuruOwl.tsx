import { lazy, Suspense, useRef } from "react";
import { motion } from "framer-motion";
import { useSectionProgress } from "../lib/useSectionProgress";

const OwlStage = lazy(() => import("../three/owl/OwlStage"));

const CARDS = [
  {
    tag: "Saber interno",
    title: "El Búho de la Sabiduría Legal",
    text: "Nuestro “Búho” representa al sabio interno que todo abogado tiene en su interior. Es quien te atenderá en cada interacción, con la capacidad de manejar procedimientos civiles locales, leyes y contratos legales en general.",
  },
  {
    tag: "Excelencia tech",
    title: "Compromiso con la precisión",
    text: "Nuestro equipo aprende día y noche de cada experiencia para ofrecer un servicio de calidad. Revisamos meticulosamente cada dato con tecnología de la más alta calidad. ¡Tu aliado tech-legal para navegar el sistema con flow y precisión!",
  },
];

// The live 3D owl stays on stage (sticky on desktop) while the two texts scroll by;
// scrolling makes it lift the document to read it.
export default function GuruOwl() {
  const section = useRef<HTMLElement>(null);
  const progress = useSectionProgress(section);

  return (
    <section ref={section} className="px-4 py-20 md:px-8">
      <div className="mx-auto max-w-7xl md:grid md:grid-cols-2 md:gap-12 lg:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="relative mx-auto w-full max-w-[460px] md:max-w-none">
            <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[28px] bg-mint" aria-hidden="true" />
            <div className="brut relative overflow-hidden rounded-[28px] bg-[#0d1b8c]">
              <div className="paper-bg absolute inset-0 opacity-[0.12] mix-blend-screen" aria-hidden="true" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgb(31_61_255/0.55),rgb(6_10_43/0.95)_70%)]" aria-hidden="true" />
              <div className="relative aspect-[4/5] max-h-[78vh] w-full">
                <Suspense fallback={null}>
                  <OwlStage progress={progress} fallbackSrc="/img/mascot_1.webp" />
                </Suspense>
              </div>
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
                <span className="brut-sm rounded-full bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink">El Búho</span>
                <span className="brut-sm rounded-full bg-mint px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink">En vivo</span>
              </div>
              <p className="pointer-events-none absolute bottom-4 right-4 hidden text-xs font-semibold uppercase tracking-wider text-white/70 md:block">
                Mueve el cursor · te sigue con la mirada
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 space-y-20 md:mt-0 md:py-10 md:[&>*:first-child]:min-h-[60vh] md:[&>*:first-child]:flex md:[&>*:first-child]:flex-col md:[&>*:first-child]:justify-center">
          {CARDS.map((c) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              <span className="brut-sm inline-block rounded-full bg-guru px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">{c.tag}</span>
              <h2 className="mt-4 font-display text-[clamp(1.8rem,4vw,3rem)] font-black uppercase leading-[1]">{c.title}</h2>
              <p className="mt-5 text-lg leading-relaxed text-ink/80">{c.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
