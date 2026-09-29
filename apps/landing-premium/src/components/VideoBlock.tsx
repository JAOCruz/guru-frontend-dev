import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";

// Browsers only autoplay muted video: it loops silently while on screen, with a button to turn sound on
export default function VideoBlock() {
  const reduce = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const el = video.current;
    if (!el || reduce) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  const toggleSound = () => {
    const el = video.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
    if (el.paused) el.play().catch(() => {});
  };

  return (
    <section className="px-4 py-20 md:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="brut overflow-hidden rounded-3xl bg-ink shadow-[var(--shadow-hard-lg)]"
        >
          <div className="flex items-center gap-2 border-b-[2.5px] border-ink bg-paper px-4 py-2">
            <span className="h-3 w-3 rounded-full border-2 border-ink bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full border-2 border-ink bg-mint" />
            <span className="h-3 w-3 rounded-full border-2 border-ink bg-guru" />
            <span className="ml-2 font-display text-xs font-bold uppercase tracking-wider">guru.mp4</span>
          </div>
          <div className="relative">
            <video
              ref={video}
              className="aspect-video w-full bg-ink object-cover"
              src="/guru.mp4"
              poster="/img/mascot_2.webp"
              muted
              loop
              playsInline
              preload="metadata"
              controls={!!reduce}
            />
            {!reduce && (
              <button
                type="button"
                onClick={toggleSound}
                aria-label={muted ? "Activar sonido" : "Silenciar"}
                className="press absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase shadow-[3px_3px_0_0_#0b0b0c]"
              >
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                {muted ? "Activar sonido" : "Silenciar"}
              </button>
            )}
          </div>
        </motion.div>
        <div>
          <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.25em] text-guru">G.U.R.U.</p>
          <h2 className="font-display text-[clamp(1.8rem,4vw,3.2rem)] font-black uppercase leading-[1]">
            El Grupo Unificado de Redacción Universal
          </h2>
          <p className="mt-5 text-lg text-ink/80">Será tu aliado estratégico al garantizar resultados impecables.</p>
          <a href={whatsappLink()} target="_blank" rel="noopener" className="brut press mt-8 inline-flex items-center gap-3 rounded-2xl bg-guru px-6 py-4 font-bold text-white">
            <WhatsAppIcon /> Déjale el trabajo sucio al Gurú
          </a>
        </div>
      </div>
    </section>
  );
}
