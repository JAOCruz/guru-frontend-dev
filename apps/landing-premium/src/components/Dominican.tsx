import { motion } from "framer-motion";

export default function Dominican() {
  return (
    <section className="overflow-hidden border-y-2 border-ink bg-paper-2 px-4 py-20 md:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
        <motion.img
          src="/img/rd_3d_3.webp"
          alt="Mapa de República Dominicana"
          loading="lazy"
          initial={{ opacity: 0, rotate: -6, scale: 0.9 }}
          whileInView={{ opacity: 1, rotate: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mx-auto w-full max-w-lg drop-shadow-[6px_6px_0_#0b0b0c]"
        />
        <div>
          <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.25em] text-guru">Sede central</p>
          <h2 className="font-display text-[clamp(2rem,5vw,3.6rem)] font-black uppercase leading-none">
            Basados en <span className="text-guru">República Dominicana</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink/80">
            Orgullosamente dominicanos, ofrecemos nuestros servicios legales y documentales con la <b>calidez y profesionalismo</b>{" "}
            que nos caracteriza. Ubicados estratégicamente en Santo Domingo, atendemos clientes en toda la isla, fusionando
            tradición legal con tecnología de vanguardia.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <div className="brut rounded-2xl bg-paper px-5 py-3 text-ink">
              <p className="font-display text-2xl font-black">100%</p>
              <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Soporte local</p>
            </div>
            <div className="brut rounded-2xl bg-mint px-5 py-3 text-ink">
              <p className="font-display text-2xl font-black">RD</p>
              <p className="text-xs font-bold uppercase tracking-wider text-ink/60">Toda la isla</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
