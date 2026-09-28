import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import type { PaletteColor } from "../../lib/userColors";

type StatsVariant =
  | "default"
  | "main"
  | "success"
  | "warning"
  | "danger"
  | "purple"
  | "orange"
  | "pink"
  | "teal"
  | "cyan";

interface StatsCardProps {
  label: string;
  value: string;
  subValue?: string;
  variant?: StatsVariant;
  delay?: number;
  sensitive?: boolean;
  visible?: boolean;
  accent?: PaletteColor;
  icon?: string | null;
}

const variantStyles: Record<StatsVariant, string> = {
  default: "bg-background text-foreground",
  main: "bg-main text-main-foreground",
  success: "bg-green-500 text-white",
  warning: "bg-yellow-400 text-black",
  danger: "bg-red-500 text-white",
  purple: "bg-purple-600 text-white",
  orange: "bg-orange-500 text-white",
  pink: "bg-pink-500 text-white",
  teal: "bg-teal-500 text-white",
  cyan: "bg-cyan-500 text-white",
};

const variantSubtle: Record<StatsVariant, string> = {
  default: "text-foreground/60",
  main: "text-white/80",
  success: "text-white/80",
  warning: "text-black/70",
  danger: "text-white/80",
  purple: "text-white/80",
  orange: "text-white/80",
  pink: "text-white/80",
  teal: "text-white/80",
  cyan: "text-white/80",
};

const variantButton: Record<StatsVariant, string> = {
  default:
    "border-border bg-secondary-background text-foreground hover:bg-main hover:text-main-foreground",
  main: "border-white/30 bg-white/10 text-white hover:bg-white hover:text-main",
  success:
    "border-white/30 bg-white/10 text-white hover:bg-white hover:text-green-600",
  warning:
    "border-black/20 bg-black/10 text-black hover:bg-black hover:text-yellow-400",
  danger: "border-white/30 bg-white/10 text-white hover:bg-white hover:text-red-600",
  purple:
    "border-white/30 bg-white/10 text-white hover:bg-white hover:text-purple-600",
  orange:
    "border-white/30 bg-white/10 text-white hover:bg-white hover:text-orange-600",
  pink: "border-white/30 bg-white/10 text-white hover:bg-white hover:text-pink-600",
  teal: "border-white/30 bg-white/10 text-white hover:bg-white hover:text-teal-600",
  cyan: "border-white/30 bg-white/10 text-white hover:bg-white hover:text-cyan-600",
};

const variantBadge: Record<StatsVariant, string> = {
  default: "border-border bg-secondary-background text-foreground/70",
  main: "border-white/30 bg-white/10 text-white/90",
  success: "border-white/30 bg-white/10 text-white/90",
  warning: "border-black/20 bg-black/10 text-black/80",
  danger: "border-white/30 bg-white/10 text-white/90",
  purple: "border-white/30 bg-white/10 text-white/90",
  orange: "border-white/30 bg-white/10 text-white/90",
  pink: "border-white/30 bg-white/10 text-white/90",
  teal: "border-white/30 bg-white/10 text-white/90",
  cyan: "border-white/30 bg-white/10 text-white/90",
};

const variantWatermark: Record<StatsVariant, string> = {
  default: "text-foreground/5",
  main: "text-white/10",
  success: "text-white/10",
  warning: "text-black/10",
  danger: "text-white/10",
  purple: "text-white/10",
  orange: "text-white/10",
  pink: "text-white/10",
  teal: "text-white/10",
  cyan: "text-white/10",
};

const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  subValue,
  variant = "default",
  delay = 0,
  sensitive = false,
  visible = true,
  accent,
  icon,
}) => {
  const hiddenValue = "••••••";
  const [revealed, setRevealed] = useState(visible);

  useEffect(() => {
    setRevealed(visible);
  }, [visible]);

  const isVisible = revealed;

  const cls = accent
    ? {
        card: "",
        subtle: "opacity-80",
        button: "border-current/30 bg-black/10 hover:bg-black/20",
        badge: "border-current/30 bg-black/10",
        watermark: "opacity-10",
      }
    : {
        card: variantStyles[variant],
        subtle: variantSubtle[variant],
        button: variantButton[variant],
        badge: variantBadge[variant],
        watermark: variantWatermark[variant],
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={accent ? { backgroundColor: accent.bg, color: accent.text } : undefined}
      className={`group relative overflow-hidden rounded-base border-2 border-border p-4 shadow-shadow transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none sm:p-5 ${cls.card}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <p
          lang="es"
          className={`min-w-0 break-words text-base font-black uppercase leading-tight tracking-tight [hyphens:auto] sm:text-3xl ${cls.subtle}`}
        >
          {icon && <span className="mr-2 not-italic">{icon}</span>}
          {label}
        </p>
        {sensitive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRevealed((v) => !v);
            }}
            className={`rounded-base border-2 p-1 transition-all ${cls.button}`}
            title={isVisible ? "Ocultar monto" : "Mostrar monto"}
          >
            {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        )}
      </div>

      <h3
        className={`break-words font-heading text-xl font-black tracking-tight sm:text-3xl ${
          !isVisible && sensitive ? "tracking-widest" : ""
        }`}
      >
        {isVisible || !sensitive ? value : hiddenValue}
      </h3>

      {subValue && (
        <div className="mt-2">
          <span
            className={`inline-block rounded-base border-2 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${cls.badge}`}
          >
            {subValue}
          </span>
        </div>
      )}

      <div
        className={`pointer-events-none absolute -right-2 -bottom-4 text-6xl font-black select-none ${cls.watermark}`}
      >
        {icon ?? label.charAt(0)}
      </div>
    </motion.div>
  );
};

export default StatsCard;
