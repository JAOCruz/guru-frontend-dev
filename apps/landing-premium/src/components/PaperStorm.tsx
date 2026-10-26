import { useReducedMotion } from "framer-motion";

// Behind "Déjanos el trabajo pesado": a storm of paperwork (forms, URGENTE / PENDIENTE stamps,
// sticky notes, clips) falling and spinning, the stress the client hands over to Gurú.
// Plain CSS transforms (no WebGL); with reduced motion the sheets rest in a still pile.
type Sheet = { left: number; w: number; delay: number; dur: number; spin: number; tilt: number; kind: "form" | "stamp" | "note" | "clip"; label?: string };

const STAMPS = ["URGENTE", "PENDIENTE", "VENCIDO", "FALTA FIRMA", "REVISAR"];
const KINDS: Sheet["kind"][] = ["form", "stamp", "form", "note", "clip", "form", "stamp"];

// deterministic layout (same on every visit, no hydration surprises)
const SHEETS: Sheet[] = Array.from({ length: 22 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const kind = KINDS[i % KINDS.length];
  return {
    left: Math.round(r(1) * 96) - 4,
    w: kind === "note" ? 64 + Math.round(r(2) * 24) : 88 + Math.round(r(2) * 56),
    delay: -r(3) * 14,
    dur: 9 + r(4) * 7,
    spin: (r(5) > 0.5 ? 1 : -1) * (180 + Math.round(r(6) * 360)),
    tilt: Math.round(r(7) * 50) - 25,
    kind,
    label: kind === "stamp" ? STAMPS[i % STAMPS.length] : undefined,
  };
});

function Paper({ s }: { s: Sheet }) {
  const note = s.kind === "note";
  return (
    <div
      className={`relative rounded-[3px] border-2 border-ink p-2 shadow-[3px_3px_0_rgb(11_11_12/0.6)] ${note ? "bg-[#ffe55c]" : "bg-[#f7f5ef]"}`}
      style={{ width: s.w, height: note ? s.w : s.w * 1.3 }}
    >
      {/* text lines */}
      <div className="space-y-[5px]">
        {Array.from({ length: note ? 3 : 7 }, (_, k) => (
          <div key={k} className="h-[3px] rounded-full bg-ink/25" style={{ width: `${55 + ((k * 37 + s.w) % 40)}%` }} />
        ))}
      </div>
      {s.kind === "form" && <div className="absolute bottom-2 right-2 h-[3px] w-1/3 bg-ink/50" />}
      {s.kind === "stamp" && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 whitespace-nowrap rounded-[3px] border-2 border-[#e0262f] px-1 text-[10px] font-black tracking-wider text-[#e0262f]">
          {s.label}
        </div>
      )}
      {s.kind === "clip" && <div className="absolute -top-2 left-3 h-6 w-3 rounded-full border-2 border-[#8b94a1]" />}
    </div>
  );
}

export default function PaperStorm() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className="paper-storm pointer-events-none absolute inset-0 overflow-hidden">
      {SHEETS.map((s, i) =>
        reduce ? (
          // still pile along the bottom
          <div key={i} className="absolute" style={{ left: `${s.left}%`, bottom: `${-20 + (i % 4) * 8}%`, transform: `rotate(${s.tilt}deg)` }}>
            <Paper s={s} />
          </div>
        ) : (
          <div
            key={i}
            className="paper-fall absolute top-0"
            style={{ left: `${s.left}%`, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s`, ["--spin" as string]: `${s.spin}deg`, ["--tilt" as string]: `${s.tilt}deg` }}
          >
            <div className="paper-sway" style={{ animationDuration: `${2.2 + (i % 5) * 0.4}s`, animationDelay: `${s.delay / 3}s` }}>
              <Paper s={s} />
            </div>
          </div>
        ),
      )}
    </div>
  );
}
