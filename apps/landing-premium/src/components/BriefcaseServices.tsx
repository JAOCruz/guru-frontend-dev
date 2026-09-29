import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { useSectionProgress } from "../lib/useSectionProgress";
import { Camera, FileText, Landmark, Languages, Printer, Send, ShieldCheck, ShoppingBag, UserCheck, type LucideIcon } from "lucide-react";
import { SERVICES, whatsappLink, type Service } from "../data";

const ICONS: Record<string, LucideIcon> = {
  contratos: FileText,
  notario: UserCheck,
  certificaciones: ShieldCheck,
  traduccion: Languages,
  fotos: Camera,
  impresion: Printer,
  impuestos: Landmark,
  tienda: ShoppingBag,
  mensajeria: Send,
};

// Scroll phases (0 → 1 across the pinned section)
const LID_OPEN = [0.05, 0.3];
const RISE = [0.25, 0.52];
const SPREAD = [0.55, 0.88];

interface Layout {
  caseW: number;
  caseY: number; // center of the briefcase, relative to the stage center
  cardW: number;
  cardH: number;
  gap: number;
  compact: boolean;
  gridTop: number; // y of the grid's first row center
}

function useLayout(stage: React.RefObject<HTMLDivElement | null>): Layout {
  const [size, setSize] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    if (!stage.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, [stage]);
  const compact = size.w < 700;
  const gap = compact ? 10 : 18;
  const cardW = compact ? Math.floor((size.w - 32 - 2 * gap) / 3) : Math.min(300, Math.floor((size.w - 64 - 2 * gap) / 3));
  const cardH = compact ? 118 : 150;
  const gridH = 3 * cardH + 2 * gap;
  return {
    caseW: Math.min(440, size.w * 0.78),
    caseY: size.h * 0.12,
    cardW,
    cardH,
    gap,
    compact,
    gridTop: -gridH / 2 + cardH / 2 + size.h * 0.06,
  };
}

function DocCard({ s, i, progress, layout, interactive }: { s: Service; i: number; progress: MotionValue<number>; layout: Layout; interactive: boolean }) {
  const Icon = ICONS[s.slug] ?? FileText;
  const col = i % 3;
  const row = Math.floor(i / 3);
  const slotX = (col - 1) * (layout.cardW + layout.gap);
  const slotY = layout.gridTop + row * (layout.cardH + layout.gap);
  const caseTop = layout.caseY - layout.caseW * 0.62 * 0.5 + layout.caseW * 0.62 * 0.45; // the seam between lid and base
  const fanX = (i - 4) * (layout.compact ? 16 : 30);
  const fanY = caseTop - (layout.compact ? 150 : 200) + Math.abs(i - 4) * 10;

  const x = useTransform(progress, [RISE[0], RISE[1], SPREAD[0], SPREAD[1]], [0, fanX, fanX, slotX]);
  const y = useTransform(progress, [RISE[0], RISE[1], SPREAD[0], SPREAD[1]], [caseTop + 30, fanY, fanY, slotY]);
  const rotate = useTransform(progress, [RISE[0], RISE[1], SPREAD[0], SPREAD[1]], [0, (i - 4) * 7, (i - 4) * 7, 0]);
  const scale = useTransform(progress, [RISE[0], RISE[1], SPREAD[1]], [0.45, 0.62, 1]);
  const opacity = useTransform(progress, [RISE[0], RISE[0] + 0.06], [0, 1]);

  return (
    <motion.a
      href={whatsappLink(`Hola Gurú, quiero cotizar: ${s.name}.`)}
      target="_blank"
      rel="noopener"
      tabIndex={interactive ? 0 : -1}
      aria-hidden={!interactive}
      style={{ x, y, rotate, scale, opacity, width: layout.cardW, height: layout.cardH, zIndex: 20 + i, marginLeft: -layout.cardW / 2, marginTop: -layout.cardH / 2 }}
      className={`group absolute left-1/2 top-1/2 flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_0_#0b0b0c] transition-shadow hover:shadow-[7px_7px_0_0_#1f3dff] ${interactive ? "" : "pointer-events-none"}`}
    >
      <div className="flex h-7 shrink-0 items-center justify-between bg-guru px-3 text-[11px] font-bold text-white">
        <span className="font-display">{String(i + 1).padStart(2, "0")}</span>
        <span className="opacity-80">GURÚ</span>
      </div>
      <div className={`flex flex-1 ${layout.compact ? "flex-col items-center justify-center gap-1.5 px-1.5 text-center" : "flex-col gap-2 p-4"}`}>
        <Icon className={`${layout.compact ? "h-6 w-6" : "h-7 w-7"} shrink-0 text-guru`} strokeWidth={2.2} />
        <h3 className={`font-display font-bold uppercase leading-tight ${layout.compact ? "text-[10px]" : "text-[15px]"}`}>{s.name}</h3>
        {!layout.compact && <p className="line-clamp-2 text-[13px] leading-snug text-ink/70">{s.description}</p>}
      </div>
    </motion.a>
  );
}

function Briefcase({ progress, layout }: { progress: MotionValue<number>; layout: Layout }) {
  const w = layout.caseW;
  const h = w * 0.62;
  const lidH = h * 0.45;
  const baseH = h - lidH;
  const lid = useTransform(progress, LID_OPEN, [0, 118]);
  const y = useTransform(progress, [SPREAD[0], SPREAD[1]], [layout.caseY, layout.caseY + 260]);
  const opacity = useTransform(progress, [SPREAD[0], SPREAD[1] - 0.05], [1, 0]);
  const glow = useTransform(progress, [LID_OPEN[0] + 0.1, RISE[1]], [0, 1]);

  return (
    <motion.div
      style={{ y, opacity, width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2 }}
      className="absolute left-1/2 top-1/2 z-10 [perspective:1400px]"
    >
      <div className="relative h-full w-full [transform:rotateX(14deg)] [transform-style:preserve-3d]">
        {/* Base (front face) */}
        <div
          className="absolute inset-x-0 bottom-0 rounded-b-[26px] rounded-t-md border-2 border-ink bg-[linear-gradient(180deg,#8a5634_0%,#6b3f22_60%,#55311a_100%)] shadow-[8px_8px_0_0_#0b0b0c]"
          style={{ height: baseH }}
        >
          <div className="absolute inset-3 rounded-b-[20px] rounded-t border border-dashed border-[#d9b48f]/60" />
          {[0.22, 0.78].map((p) => (
            <div key={p} className="absolute -top-2 h-7 w-12 -translate-x-1/2 rounded-md border-2 border-ink bg-[linear-gradient(180deg,#f3e1a0,#c9a24a)]" style={{ left: `${p * 100}%` }} />
          ))}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border-2 border-ink bg-mint px-3 py-0.5 font-display text-[10px] font-bold uppercase">
            Gurú Soluciones
          </div>
        </div>
        {/* Inside glow when open */}
        <motion.div
          style={{ opacity: glow, bottom: baseH - 6, height: 26 }}
          className="absolute inset-x-6 rounded-full bg-[radial-gradient(ellipse,#00c853_0%,transparent_70%)] blur-md"
        />
        {/* Lid: folds back on the seam, lining visible when open */}
        <motion.div
          style={{ rotateX: lid, height: lidH, bottom: baseH }}
          className="absolute inset-x-0 origin-bottom [transform-style:preserve-3d]"
        >
          <div className="absolute inset-0 rounded-t-[26px] rounded-b-md border-2 border-ink bg-[linear-gradient(180deg,#9a6440_0%,#7a4a2a_100%)] [backface-visibility:hidden]">
            <div className="absolute inset-3 rounded-t-[20px] rounded-b border border-dashed border-[#d9b48f]/60" />
            {/* handle */}
            <div className="absolute -top-7 left-1/2 h-8 w-28 -translate-x-1/2 rounded-t-2xl border-2 border-b-0 border-ink bg-transparent [box-shadow:inset_0_0_0_6px_#5a341c]" />
          </div>
          <div className="absolute inset-0 rounded-t-[26px] rounded-b-md border-2 border-ink bg-[repeating-linear-gradient(45deg,#15206b_0_10px,#1a2a8a_10px_20px)] [backface-visibility:hidden] [transform:rotateX(180deg)]" />
        </motion.div>
      </div>
    </motion.div>
  );
}

function StaticGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {SERVICES.map((s, i) => {
        const Icon = ICONS[s.slug] ?? FileText;
        return (
          <a key={s.slug} href={whatsappLink(`Hola Gurú, quiero cotizar: ${s.name}.`)} target="_blank" rel="noopener" className="brut press flex flex-col gap-2 rounded-2xl bg-white p-4">
            <span className="font-display text-xs font-bold text-ink/50">{String(i + 1).padStart(2, "0")}</span>
            <Icon className="h-7 w-7 text-guru" />
            <h3 className="font-display text-sm font-bold uppercase">{s.name}</h3>
            <p className="text-sm text-ink/70">{s.description}</p>
          </a>
        );
      })}
    </div>
  );
}

export default function BriefcaseServices() {
  const reduce = useReducedMotion();
  const section = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const layout = useLayout(stage);
  const scrollYProgress = useSectionProgress(section);
  const [interactive, setInteractive] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => setInteractive(v > SPREAD[1] - 0.02));
  const hint = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  if (reduce) {
    return (
      <section id="servicios" className="px-4 py-20 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-10 font-display text-[clamp(2rem,5vw,3.8rem)] font-black uppercase leading-none">
            Nuestros <span className="text-guru">servicios</span>
          </h2>
          <StaticGrid />
        </div>
      </section>
    );
  }

  return (
    <section id="servicios" ref={section} className="relative h-[340vh] border-y-2 border-ink bg-paper-2">
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col overflow-hidden md:top-20 md:h-[calc(100svh-5rem)]">
        <div className="relative z-30 px-4 pt-6 text-center md:pt-8">
          <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-guru">Especialidades</p>
          <h2 className="mt-2 font-display text-[clamp(1.8rem,4.5vw,3.4rem)] font-black uppercase leading-none">
            Nuestros <span className="text-guru">servicios</span>
          </h2>
          <motion.p style={{ opacity: hint }} className="mt-3 text-sm font-semibold text-ink/60">
            Desliza para abrir el maletín ↓
          </motion.p>
        </div>
        <div ref={stage} className="relative flex-1">
          <Briefcase progress={scrollYProgress} layout={layout} />
          {SERVICES.map((s, i) => (
            <DocCard key={s.slug} s={s} i={i} progress={scrollYProgress} layout={layout} interactive={interactive} />
          ))}
        </div>
      </div>
    </section>
  );
}
