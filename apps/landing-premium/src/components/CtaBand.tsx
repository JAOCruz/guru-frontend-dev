import { motion } from "framer-motion";
import { whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";
import PaperStorm from "./PaperStorm";

export default function CtaBand() {
  return (
    <section className="px-4 py-20 md:px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="brut relative mx-auto grid max-w-7xl items-center gap-8 overflow-hidden rounded-[32px] bg-guru p-8 text-white shadow-[var(--shadow-hard-lg)] md:min-h-[360px] md:grid-cols-[1fr_auto] md:p-14"
      >
        <PaperStorm />
        {/* the text sits on a deep-blue veil so the paperwork never gets in the way of reading */}
        <div className="pointer-events-none absolute inset-0 bg-[rgb(13_27_140/0.84)] md:bg-transparent md:bg-[linear-gradient(90deg,rgb(13_27_140/0.92)_0%,rgb(13_27_140/0.78)_45%,rgb(31_61_255/0.35)_100%)]" />
        <div className="relative">
          <h2 className="font-display text-[clamp(2rem,5vw,3.6rem)] font-black uppercase leading-[0.95] [text-shadow:0_2px_24px_rgb(13_27_140/0.9)]">
            Déjanos el trabajo pesado
          </h2>
          <p className="mt-4 max-w-xl text-lg text-white/85">Escríbenos ahora y un Gurú te atiende de inmediato.</p>
        </div>
        <a
          href={whatsappLink()}
          target="_blank"
          rel="noopener"
          className="brut press relative inline-flex items-center justify-center gap-3 rounded-2xl bg-mint px-7 py-5 font-display text-lg font-bold uppercase text-ink"
        >
          <WhatsAppIcon className="h-6 w-6" /> Hablar con un Gurú
        </a>
      </motion.div>
    </section>
  );
}
