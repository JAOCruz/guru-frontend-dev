import { lazy, Suspense, useState } from "react";
import HistoryStories from "./HistoryStories";

const ModelStage = lazy(() => import("./ModelStage"));

// The typewriter types our history, story by story
export default function TypewriterBlock() {
  const [typing, setTyping] = useState(false);

  return (
    <section id="historia" className="relative overflow-hidden border-b-2 border-ink px-4 py-20 md:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.25em] text-guru">Del oficio a la precisión digital</p>
          <h2 className="font-display text-[clamp(1.9rem,4.5vw,3.4rem)] font-black uppercase leading-[1]">
            La máquina de escribir <span className="text-guru">nunca se fue</span>
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/80">
            Nuestra historia, tecla por tecla: de la cinta entintada a la inteligencia artificial. Tócala para avanzar,
            mantén presionado para pausar.
          </p>
          <div className={`relative mx-auto mt-6 aspect-[4/3] w-full max-w-[560px] ${typing ? "animate-[type-jitter_0.18s_steps(2)_infinite]" : ""}`}>
            <Suspense fallback={null}>
              <ModelStage url="/models/typewriter.glb" keepMaterials fit={3.1} cameraZ={5.2} spin={0.18} />
            </Suspense>
          </div>
        </div>

        <HistoryStories onTyping={setTyping} />
      </div>
    </section>
  );
}
