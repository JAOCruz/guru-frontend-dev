import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";

const CARDS = [
  {
    img: "/img/mascot_2.webp",
    tag: "Saber interno",
    title: "El Búho de la Sabiduría Legal",
    text: "Nuestro “Búho” representa al sabio interno que todo abogado tiene en su interior. Es quien te atenderá en cada interacción, con la capacidad de manejar procedimientos civiles locales, leyes y contratos legales en general.",
  },
  {
    img: "/img/mascot_1.webp",
    tag: "Excelencia tech",
    title: "Compromiso con la precisión",
    text: "Nuestro equipo aprende día y noche de cada experiencia para ofrecer un servicio de calidad. Revisamos meticulosamente cada dato con tecnología de la más alta calidad. ¡Tu aliado tech-legal para navegar el sistema con flow y precisión!",
  },
];

// The Gurú owl with depth: the portrait tilts toward the cursor and its frame
// separates from the card like a layered 3D print
function DepthPortrait({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 150, damping: 15 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 150, damping: 15 });
  const shift = useSpring(useTransform(mx, [-0.5, 0.5], [-10, 10]), { stiffness: 150, damping: 15 });

  return (
    <div
      ref={ref}
      className="relative [perspective:900px]"
      onPointerMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div style={{ rotateX: rx, rotateY: ry }} className="relative [transform-style:preserve-3d]">
        <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-[28px] bg-mint [transform:translateZ(-40px)]" />
        <motion.img
          src={src}
          alt="El Búho de Gurú Soluciones"
          loading="lazy"
          style={{ x: shift }}
          animate={reduce ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="relative block aspect-square w-full rounded-[28px] border-2 border-ink object-cover [transform:translateZ(40px)]"
        />
      </motion.div>
    </div>
  );
}

export default function GuruOwl() {
  return (
    <section className="px-4 py-20 md:px-8">
      <div className="mx-auto max-w-7xl space-y-16">
        {CARDS.map((c, i) => (
          <div key={c.title} className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
            <div className="mx-auto w-full max-w-[420px]">
              <DepthPortrait src={c.img} />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              <span className="brut-sm inline-block rounded-full bg-guru px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">{c.tag}</span>
              <h2 className="mt-4 font-display text-[clamp(1.8rem,4vw,3rem)] font-black uppercase leading-[1]">{c.title}</h2>
              <p className="mt-5 text-lg leading-relaxed text-ink/80">{c.text}</p>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}
