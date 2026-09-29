import { useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { NeoCard } from "@guru/ui";
import { X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { resolveAvatar } from "../lib/userColors";
import { CATEGORIES, WELCOME_TIP, createTipPicker, eligibleTips, type Tip, type TipCategory } from "../lib/advisorTips";

type Topic = TipCategory | "all";
const TOPIC_KEY = "guru-advisor-topic";
const readTopic = (): Topic => {
  try {
    const v = localStorage.getItem(TOPIC_KEY);
    return v && (v === "all" || CATEGORIES.some((c) => c.key === v)) ? (v as Topic) : "all";
  } catch {
    return "all";
  }
};

interface GuruAdvisorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GuruAdvisor({ isOpen, onOpenChange }: GuruAdvisorProps) {
  const { pathname } = useLocation();
  const { isAdmin, user } = useAuth();
  // Each person's own animal gives the tips; without one, the Gurú owl
  const advisorEmoji = resolveAvatar(user?.avatar) ?? "🦉";
  const [topic, setTopic] = useState<Topic>(readTopic);
  const [tip, setTip] = useState<Tip | null>(null); // null = welcome message
  const picker = useRef(createTipPicker());
  const [animando, setAnimando] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    didDrag.current = false;
    dragStart.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    didDrag.current = true;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  // Random tip of the chosen topic, including help for the page you're on
  const showTip = (nextTopic: Topic) => {
    let pool = eligibleTips({ category: nextTopic, path: pathname, isAdmin });
    if (!pool.length) pool = eligibleTips({ category: "all", path: pathname, isAdmin });
    setAnimando(true);
    setTip(picker.current(pool));
    onOpenChange(true);
    setTimeout(() => setAnimando(false), 300);
  };

  const openWithNewTip = () => {
    if (didDrag.current) return;
    showTip(topic);
  };

  const chooseTopic = (next: Topic) => {
    setTopic(next);
    try {
      localStorage.setItem(TOPIC_KEY, next);
    } catch {
      /* private mode: topic just isn't remembered */
    }
    showTip(next);
  };

  const category = tip ? CATEGORIES.find((c) => c.key === tip.category) : null;

  const closeTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenChange(false);
  };

  return (
    <div
      className="group fixed bottom-4 right-4 z-[45] flex flex-col items-end gap-2 md:bottom-10 md:right-10 md:flex-row md:gap-4"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        touchAction: "none",
      }}
    >
      {isOpen && (
        <NeoCard
          className={`relative w-[min(300px,calc(100vw-2rem))] overflow-hidden border-2 border-border bg-background px-4 py-3 pr-10 shadow-shadow md:w-auto md:max-w-[280px] md:px-5 md:py-4 transition-all ${
            animando ? "scale-95 opacity-60" : "scale-100 opacity-100"
          }`}
        >
          <button
            type="button"
            onClick={closeTip}
            aria-label="Cerrar consejo"
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-base border-2 border-border bg-main text-main-foreground shadow-button transition-transform hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:scale-95"
          >
            <X size={14} strokeWidth={3} />
          </button>
          <div className="absolute top-0 left-0 h-1 w-full bg-main" />
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-main">
            <span aria-hidden="true">{category?.emoji ?? advisorEmoji}</span>
            {category?.label ?? "Gurú // Asesoría"}
          </div>
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {tip?.text ?? WELCOME_TIP}
          </p>
          <div role="group" aria-label="Tema de los consejos" className="mt-3 flex flex-wrap gap-1">
            {[{ key: "all" as Topic, label: "Todos los temas", emoji: "🎲" }, ...CATEGORIES].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => chooseTopic(c.key)}
                title={c.label}
                aria-label={c.label}
                aria-pressed={topic === c.key}
                className={`flex h-7 w-7 items-center justify-center rounded-base border-2 text-sm ${
                  topic === c.key ? "border-border bg-main shadow-button" : "border-transparent hover:border-border"
                }`}
              >
                {c.emoji}
              </button>
            ))}
          </div>
          <p className="mt-2 text-right text-[9px] font-black uppercase tracking-widest text-foreground/50">
            Tócame para otro consejo
          </p>
        </NeoCard>
      )}

      <div
        className="relative cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={openWithNewTip}
      >
        <div className="absolute inset-0 rounded-full bg-main/20 opacity-60 blur-[16px] transition-opacity group-hover:opacity-100" />
        <div className="relative z-10 select-none text-5xl drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] md:text-6xl transition-transform hover:scale-105 active:scale-95">
          {advisorEmoji}
        </div>
      </div>
    </div>
  );
}