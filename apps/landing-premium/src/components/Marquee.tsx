import { SERVICES } from "../data";

function Row({ reverse = false, className = "" }: { reverse?: boolean; className?: string }) {
  const items = [...SERVICES, ...SERVICES];
  return (
    <div className={`flex overflow-hidden whitespace-nowrap ${className}`}>
      <div className={`marquee flex shrink-0 items-center ${reverse ? "reverse" : ""}`}>
        {[...items, ...items].map((s, i) => (
          <span key={i} className="flex items-center gap-6 px-6 font-display text-lg font-bold uppercase md:text-2xl">
            {s.name} <span aria-hidden="true">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Marquee() {
  return (
    <div className="relative -rotate-1 border-y-[2.5px] border-ink bg-guru py-3 text-white" aria-hidden="true">
      <Row />
      <div className="absolute inset-x-0 -bottom-[46px] rotate-2 border-y-[2.5px] border-ink bg-mint py-2 text-ink">
        <Row reverse />
      </div>
    </div>
  );
}
