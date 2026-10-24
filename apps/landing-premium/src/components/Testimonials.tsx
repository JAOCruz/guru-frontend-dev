import { motion } from "framer-motion";
import { Star } from "lucide-react";

const QUOTES = [
  { author: "Cliente satisfecho", text: "Son muy profesionales. Una vez me estaban por cerrar procuraduría y me ayudaron muy amablemente a crear el documento sin errores y bastante rápido. ¡Excelente atención!" },
  { author: "Usuario de redacción", text: "Estaba haciendo una maestría en Italia y me ayudaron a traducir y apostillar los documentos por ahí mismo. No tuve que hablar mucho. ¡Excelente manejo!" },
  { author: "Profesional legal", text: "Estaba cerca de la Feria, me dijeron que vaya donde un tal Gurú que me ayuda con la corrección de documentos con máquina de escribir... ¡qué mayimbe, mano!" },
  { author: "Familia unida", text: "Soy abogado de muchos años en el oficio. Es bastante cómodo pedir una certificación de estatus jurídico o la redacción de expedientes con ellos; no tengo que moverme de mi casa. ¡Bendiciones para su negocio!" },
];
const TILTS = ["-rotate-1", "rotate-1", "rotate-[0.6deg]", "-rotate-[0.8deg]"];

export default function Testimonials() {
  return (
    <section className="border-y-[2.5px] border-ink bg-mint px-4 py-20 md:px-8">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-12 font-display text-[clamp(2rem,5vw,3.8rem)] font-black uppercase leading-[1.15]">
          Lo que dicen <span className="bg-ink px-2 text-mint [box-decoration-break:clone]">nuestros clientes</span>
        </h2>
        <div className="grid gap-7 md:grid-cols-2">
          {QUOTES.map((q, i) => (
            <motion.figure
              key={q.author}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.1 }}
              className={`brut rounded-3xl bg-paper p-7 ${TILTS[i]}`}
            >
              <div className="mb-4 flex gap-1 text-guru" aria-label="5 estrellas">
                {Array.from({ length: 5 }).map((_, k) => <Star key={k} size={18} fill="currentColor" />)}
              </div>
              <blockquote className="text-lg leading-relaxed">“{q.text}”</blockquote>
              <figcaption className="mt-5 font-display text-xs font-bold uppercase tracking-widest text-ink/60">— {q.author}</figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
