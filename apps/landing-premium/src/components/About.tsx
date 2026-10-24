import { lazy, Suspense } from "react";
import { motion } from "framer-motion";

const ModelStage = lazy(() => import("./ModelStage"));

export default function About() {
  return (
    <section id="nosotros" className="px-4 py-20 md:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Themis, goddess of justice, as on the current site */}
        <div className="relative mx-auto aspect-[3/4] w-full max-w-[420px]">
          <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle,#00c853_0%,transparent_65%)] opacity-40 blur-2xl" />
          <Suspense fallback={null}>
            <ModelStage url="/models/themis.glb" color="#e9edf5" emissive="#1a2140" fit={2.6} cameraZ={5.4} spin={0.3} />
          </Suspense>
        </div>
        <div>
          <p className="mb-4 font-display text-xs font-bold uppercase tracking-[0.25em] text-guru">Sobre Gurú</p>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="font-display text-[clamp(2rem,5vw,4rem)] font-black uppercase leading-[1]"
          >
            ¿Quiénes <span className="text-guru">somos?</span>
          </motion.h2>
          <div className="brut mt-8 rounded-3xl bg-paper p-7">
            <p className="font-display text-xl font-bold leading-snug">¡Somos una empresa de servicios legales automatizados!</p>
            <p className="mt-4 text-lg leading-relaxed text-ink/80">
              Con la capacidad de realizar cualquier tipo de documentación legal de manera{" "}
              <b className="text-guru">personalizada y actualizada</b>. Nuestra misión es simplificar tus procesos más
              complejos para que puedas cumplir tus sueños con total seguridad.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
