import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Instagram, Pause, Play } from "lucide-react";
import { INSTAGRAM, whatsappLink } from "../data";
import WhatsAppIcon from "./WhatsAppIcon";

const STORIES = [
  { year: "1990s", title: "El oficio original", text: "Antes la mecanografía no era solo un oficio... era el pilar fundamental que dio forma a los ‘paralegales callejeros’ de la República Dominicana. Aquella mano de obra independiente —digitadores, escribientes, visionarios de la palabra— nació del pulso diario en los tribunales y destacamentos. Fue, en esencia, un séptimo arte forjado entre la necesidad y la técnica." },
  { year: "Herencia", title: "El puente entre eras", text: "Nosotros somos el puente entre esas dos eras. Somos la herencia de quienes aprendieron a trabajar codo a codo con la justicia, sobrellevando el hambre y la incertidumbre para convertir la adaptación en nuestra mayor ventaja competitiva." },
  { year: "CEO", title: "Leandro Solís Gerónimo", text: "Hoy, ese legado vive en mí. Mi nombre es Leandro Solís Gerónimo, el CEO de nuestra historia, la cual no comenzó en una oficina, sino en el bullicio de los centros de internet desde que tenía 8 años de edad. Crecí viendo cómo cada cambio de ley se transformaba en una oportunidad, pasando de la cinta entintada de una máquina de escribir a la precisión infinita que tiene hoy la Inteligencia Artificial." },
  { year: "Hoy", title: "Equipo humano de alto nivel", text: "Nos caracteriza la garantía de ser un equipo humano de alto nivel y una red de trabajo. No solo digitamos documentos; redactamos el futuro de un sector laboral que aprendió a reinventarse." },
  { year: "Futuro", title: "Gurú Soluciones", text: "Aquel hombre que llegó a la capital en los 90, sin más equipaje que su cansancio y su actitud, hoy mira hacia atrás y ve una realidad distinta. Su hijo no solo heredó su tenacidad; ha transformado aquel pequeño esfuerzo en lo que hoy es Gurú Soluciones." },
];
const COUNT = STORIES.length + 1; // + closing "follow us" card

// Enough time to read: a base plus ~45 ms per character
const durationOf = (i: number) => (i < STORIES.length ? 5000 + STORIES[i].text.length * 45 : 9000);

/** Our history as Instagram-style stories: it plays on its own, tap to move, hold to pause. */
export default function HistoryStories({ onTyping }: { onTyping?: (typing: boolean) => void }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const [held, setHeld] = useState(false);
  const [userPaused, setUserPaused] = useState(!!reduce);
  const [typed, setTyped] = useState(0);
  const paused = held || userPaused || !inView;
  const story = STORIES[index];

  useEffect(() => {
    if (!box.current) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(COUNT - 1, next))), []);

  // The typewriter "types" each story; it stops while paused
  useEffect(() => setTyped(reduce ? Number.MAX_SAFE_INTEGER : 0), [index, reduce]);
  useEffect(() => {
    if (!story || paused || typed >= story.text.length) return;
    const id = window.setTimeout(() => setTyped((n) => n + 3), 22);
    return () => window.clearTimeout(id);
  }, [story, paused, typed]);
  const typing = !!story && !paused && typed < story.text.length;
  useEffect(() => onTyping?.(typing), [typing, onTyping]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(index + 1);
    if (e.key === "ArrowLeft") go(index - 1);
    if (e.key === " ") {
      e.preventDefault();
      setUserPaused((p) => !p);
    }
  };

  return (
    <div className="flex flex-col gap-4">
    <div
      ref={box}
      tabIndex={0}
      onKeyDown={onKey}
      role="region"
      aria-roledescription="historias"
      aria-label={`Nuestra historia, ${index + 1} de ${COUNT}`}
      className="relative mx-auto flex h-[600px] w-full max-w-[400px] select-none flex-col overflow-hidden rounded-[28px] border-2 border-ink bg-ink text-white shadow-[var(--shadow-hard-lg)] outline-none focus-visible:ring-4 focus-visible:ring-mint md:h-[620px]"
    >
      {/* Progress bars; the running one advances the story when it fills */}
      <div className="relative z-20 flex gap-1.5 px-4 pt-4">
        {Array.from({ length: COUNT }, (_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            {i < index && <div className="h-full bg-mint" />}
            {i === index && (
              <div
                key={`${index}-${reduce}`}
                className="h-full origin-left bg-mint"
                style={
                  reduce
                    ? { transform: "scaleX(1)" }
                    : { animation: `story-fill ${durationOf(i)}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }
                }
                onAnimationEnd={() => index < COUNT - 1 && go(index + 1)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="relative z-20 flex items-center gap-3 px-4 pt-3">
        <img src="/img/logo.webp" alt="" className="h-9 w-9 rounded-full border-2 border-white bg-white object-contain p-0.5" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-bold">gurusolucionesrd</p>
          <p className="text-xs text-white/60">Nuestra historia</p>
        </div>
        <button
          type="button"
          onClick={() => setUserPaused((p) => !p)}
          aria-label={userPaused ? "Reproducir" : "Pausar"}
          className="rounded-full p-2 hover:bg-white/10"
        >
          {userPaused ? <Play size={18} /> : <Pause size={18} />}
        </button>
      </div>

      {/* Tap zones: left third goes back, the rest goes forward; holding pauses */}
      <div
        className="absolute inset-0 z-10 flex"
        onPointerDown={() => setHeld(true)}
        onPointerUp={() => setHeld(false)}
        onPointerLeave={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
      >
        <button type="button" tabIndex={-1} aria-hidden="true" className="h-full w-1/3 cursor-w-resize" onClick={() => go(index - 1)} />
        <button type="button" tabIndex={-1} aria-hidden="true" className="h-full w-2/3 cursor-e-resize" onClick={() => go(index + 1)} />
      </div>

      {story ? (
        <div className="pointer-events-none relative flex flex-1 flex-col px-4 pb-5 pt-5">
          <span className="brut-sm w-fit rounded-full bg-mint px-3 py-1 font-display text-xs font-bold uppercase text-ink">{story.year}</span>
          <h3 className="mt-3 font-display text-2xl font-bold uppercase leading-tight">{story.title}</h3>
          <div className="relative mt-4 flex-1 rounded-2xl border-2 border-ink bg-paper p-4 font-mono text-[13.5px] leading-[1.65] text-ink shadow-[4px_4px_0_0_#00c853] md:text-[14px]">
            <div className="absolute inset-x-0 top-0 h-2 rounded-t-[14px] bg-guru" />
            <p className="mt-1" aria-live="off">
              {story.text.slice(0, typed)}
              {typed < story.text.length && <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-guru" />}
            </p>
            {/* full text for screen readers, independent of the typing */}
            <span className="sr-only">{story.text}</span>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_30%,#1f3dff_0%,#0b0b0c_70%)] px-6 text-center">
          <img src="/img/mascot_1.webp" alt="" className="pointer-events-none h-36 w-36 object-contain drop-shadow-[0_8px_0_rgba(0,0,0,.35)]" />
          <h3 className="pointer-events-none font-display text-2xl font-black uppercase leading-tight">
            La historia sigue <span className="text-mint">en nuestras redes</span>
          </h3>
          <p className="pointer-events-none text-sm text-white/75">Síguenos para ver el día a día del Gurú, consejos legales y novedades.</p>
          <div className="relative z-20 flex w-full flex-col gap-3">
            <a
              href={INSTAGRAM}
              target="_blank"
              rel="noopener"
              className="press inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-[linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)] px-5 py-3.5 font-display text-sm font-bold uppercase shadow-[4px_4px_0_0_#00c853]"
            >
              <Instagram size={20} /> @gurusolucionesrd
            </a>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener"
              className="press inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-mint px-5 py-3.5 font-display text-sm font-bold uppercase text-ink shadow-[4px_4px_0_0_#ffffff]"
            >
              <WhatsAppIcon className="h-5 w-5" /> Escríbenos
            </a>
          </div>
        </div>
      )}
      </div>

      {/* Controls under the card for mouse/keyboard users */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Historia anterior"
          className="press rounded-full border-2 border-ink bg-white p-2 shadow-[3px_3px_0_0_#0b0b0c] disabled:opacity-30"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="min-w-14 text-center font-display text-sm font-bold">{index + 1} / {COUNT}</span>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === COUNT - 1}
          aria-label="Siguiente historia"
          className="press rounded-full border-2 border-ink bg-white p-2 shadow-[3px_3px_0_0_#0b0b0c] disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
