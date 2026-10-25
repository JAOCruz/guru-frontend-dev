import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { useSectionProgress } from "../lib/useSectionProgress";
import { SERVICES, whatsappLink, type Service } from "../data";
import { STORY, cardLayout, slotPx, type StageLayout } from "../three/briefcase/story";

const BriefcaseScene = lazy(() => import("../three/briefcase/BriefcaseScene"));

const SHEET_DATA = SERVICES.map((s) => ({ name: s.name, description: s.description, image: s.image }));

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** If the WebGL scene throws (lost context, shader error), fall back to the static grid */
class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useLayout(stage: React.RefObject<HTMLDivElement | null>): StageLayout {
  const [size, setSize] = useState({ w: 1200, h: 700 });
  useEffect(() => {
    if (!stage.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, [stage]);
  return useMemo(() => cardLayout(size.w, size.h), [size]);
}

/** The service's image (it carries the name in big letters), then the name and a line of copy when there is room */
function CardBody({ s, compact }: { s: Service; compact: boolean }) {
  return (
    <>
      <img
        src={s.image}
        alt=""
        width={720}
        height={405}
        loading="lazy"
        decoding="async"
        draggable={false}
        className={`block aspect-[16/9] w-full shrink-0 object-cover ${compact ? "" : "border-b-2 border-ink"}`}
      />
      {compact ? (
        <h3 className="sr-only">{s.name}</h3>
      ) : (
        <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
          <h3 className="line-clamp-2 font-display text-[12px] font-bold uppercase leading-[15px]">{s.name}</h3>
          <p className="line-clamp-2 text-[12.5px] leading-4 text-ink/70">{s.description}</p>
        </div>
      )}
    </>
  );
}

/** The real, clickable cards. Placed exactly where the 3D sheets land; faded in at the end. */
function CardGrid({ layout, smooth, interactive, gridRef }: { layout: StageLayout; smooth: MotionValue<number>; interactive: boolean; gridRef: React.RefObject<HTMLDivElement | null> }) {
  const opacity = useTransform(smooth, [STORY.fade[0], STORY.fade[1]], [0, 1]);
  return (
    <motion.div ref={gridRef} style={{ opacity }} className={`absolute inset-0 z-20 ${interactive ? "" : "pointer-events-none"}`} aria-hidden={!interactive}>
      {SERVICES.map((s, i) => {
        const slot = slotPx(layout, i);
        return (
          <a
            key={s.slug}
            data-slug={s.slug}
            href={whatsappLink(`Hola Gurú, quiero cotizar: ${s.name}.`)}
            target="_blank"
            rel="noopener"
            tabIndex={interactive ? 0 : -1}
            style={{ width: layout.cardW, height: layout.cardH, left: `calc(50% + ${slot.x - layout.cardW / 2}px)`, top: `calc(50% + ${slot.y - layout.cardH / 2}px)` }}
            className="press absolute flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[4px_4px_0_0_#0b0b0c] hover:shadow-[7px_7px_0_0_#1f3dff]"
          >
            <CardBody s={s} compact={layout.compact} />
          </a>
        );
      })}
    </motion.div>
  );
}

function StaticGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {SERVICES.map((s) => (
        <a key={s.slug} href={whatsappLink(`Hola Gurú, quiero cotizar: ${s.name}.`)} target="_blank" rel="noopener" className="brut press flex flex-col overflow-hidden rounded-2xl bg-white">
          <CardBody s={s} compact={false} />
        </a>
      ))}
    </div>
  );
}

function Heading() {
  return (
    <h2 className="mt-2 font-display text-[clamp(1.8rem,4.5vw,3.4rem)] font-black uppercase leading-none">
      Nuestros <span className="text-guru">servicios</span>
    </h2>
  );
}

function StaticSection() {
  return (
    <section id="servicios" className="border-y-2 border-ink bg-paper-2 px-4 py-20 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-guru">Especialidades</p>
        <div className="mb-10">
          <Heading />
        </div>
        <StaticGrid />
      </div>
    </section>
  );
}

export default function BriefcaseServices() {
  const reduce = useReducedMotion();
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);
  if (reduce || gl === false) return <StaticSection />;
  return <PinnedSection onFail={() => setGl(false)} />;
}

function PinnedSection({ onFail }: { onFail: () => void }) {
  const section = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const layout = useLayout(stage);
  const progress = useSectionProgress(section);
  const smooth = useMotionValue(0);
  const [interactive, setInteractive] = useState(false);
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);
  useMotionValueEvent(progress, "change", (v) => setInteractive(v >= STORY.interactive));
  const hint = useTransform(progress, [0, 0.1], [1, 0]);

  // mount the scene shortly before the section scrolls in; render only while it is on screen
  useEffect(() => {
    if (!section.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setActive(e.isIntersecting);
        if (e.isIntersecting) setNear(true);
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(section.current);
    return () => io.disconnect();
  }, []);

  return (
    <section id="servicios" ref={section} className="relative h-[250vh] border-y-2 border-ink bg-paper-2">
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col overflow-hidden md:top-20 md:h-[calc(100svh-5rem)]">
        <div className="relative z-30 bg-paper-2 px-4 pt-6 text-center md:pt-8">
          <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-guru">Especialidades</p>
          <Heading />
          <motion.p style={{ opacity: hint }} className="mt-3 text-sm font-semibold text-ink/60">
            Desliza para abrir el maletín ↓
          </motion.p>
        </div>
        <div ref={stage} className="relative flex-1 bg-[radial-gradient(ellipse_at_50%_65%,#f8f5ee_0%,#ede8dc_45%,#e3ddce_100%)]">
          {near && (
            <SceneBoundary onError={onFail}>
              <Suspense fallback={null}>
                <BriefcaseScene progress={progress} smooth={smooth} layout={layout} data={SHEET_DATA} active={active} />
              </Suspense>
            </SceneBoundary>
          )}
          <CardGrid layout={layout} smooth={smooth} interactive={interactive} gridRef={gridRef} />
        </div>
      </div>
    </section>
  );
}
