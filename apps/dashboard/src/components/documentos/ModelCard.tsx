import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { NeoButton } from "@guru/ui";
import type { Model } from "../../services/documentosApi";
import ModelThumb from "./ModelThumb";

export interface ModelAction {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  highlight?: boolean; // the model's main action
  iconOnly?: boolean; // in the list, only its icon
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

interface Props {
  model: Model;
  badge: { text: string; tone: "used" | "private" | "pending" } | null;
  status: ReactNode;
  actions: ModelAction[];
  onPreview: () => void;
}

// A model in the library's grid: its first page, a mark in the corner, a big name and one main action.
export default function ModelCard({ model, badge, status, actions, onPreview }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const main = actions.find((a) => a.highlight) ?? actions[0];
  const others = actions.filter((a) => a !== main);
  // the library's import filled this with «Plantilla: <file>», which only repeats the name
  const description = model.description && !/^plantilla:/i.test(model.description) ? model.description : null;

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <li className="gos-model-card">
      <div className="gos-model-top" ref={wrap}>
        <button type="button" className="gos-model-preview" onClick={onPreview} aria-label={`Ver ${model.name}`}>
          <ModelThumb id={model.id} name={model.name} />
          {badge && <span className={`gos-model-badge gos-model-badge-${badge.tone}`}>{badge.text}</span>}
        </button>
        {others.length > 0 && (
          <button type="button" className="gos-model-more" onClick={() => setOpen((v) => !v)} aria-label={`Más acciones de ${model.name}`} aria-haspopup="menu" aria-expanded={open}>
            <MoreHorizontal size={18} />
          </button>
        )}
        {open && (
          <div role="menu" className="gos-model-menu">
            {others.map((a) => (
              <button
                key={a.key}
                type="button"
                role="menuitem"
                disabled={a.disabled}
                title={a.title}
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <h3 className="gos-model-name" title={model.name}>{model.name}</h3>
      <p className="gos-model-category">{model.category || "Sin categoría"}</p>
      {description && <p className="gos-model-description">{description}</p>}
      {status}
      <NeoButton size="sm" className="gos-model-main" onClick={main.onClick} disabled={main.disabled} title={main.title}>
        {main.icon} {main.label}
      </NeoButton>
    </li>
  );
}
