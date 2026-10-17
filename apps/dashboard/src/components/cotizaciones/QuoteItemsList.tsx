import React, { useEffect, useState } from "react";
import { AlertTriangle, BadgeDollarSign, Save } from "lucide-react";
import { NeoCard, NeoButton } from "@guru/ui";

// A quote line. Lines the bot could not price come with precio null and por_confirmar: true,
// plus the range and/or the catalog's suggested price and a note for whoever sets the price.
export interface QuoteLine {
  desc?: string;
  name?: string;
  cantidad?: number;
  quantity?: number;
  precio?: number | null;
  unitPrice?: number;
  itbis?: boolean;
  por_confirmar?: boolean;
  rango?: { min: number; max: number } | null;
  precio_sugerido?: number | null;
  nota?: string | null;
}

export const pendingCount = (items?: QuoteLine[]) => (items || []).filter((i) => i && i.por_confirmar).length;

const rd = (n: number) => `RD$ ${Number(n).toLocaleString("es-DO")}`;
const qtyOf = (i: QuoteLine) => i.cantidad || i.quantity || 1;
const priceOf = (i: QuoteLine) => (i.precio ?? i.unitPrice ?? null);

interface QuoteItemsListProps {
  items: QuoteLine[];
  editable?: boolean; // the client's assigned digitador or the admin, while the quote is not approved
  saving?: boolean;
  onSave?: (items: QuoteLine[]) => void;
}

const QuoteItemsList: React.FC<QuoteItemsListProps> = ({ items, editable = false, saving = false, onSave }) => {
  const [drafts, setDrafts] = useState<string[]>([]);
  useEffect(() => {
    setDrafts(items.map((i) => (priceOf(i) ? String(priceOf(i)) : "")));
  }, [items]);

  const pending = pendingCount(items);
  const dirty = drafts.some((d, idx) => d !== (priceOf(items[idx]) ? String(priceOf(items[idx])) : ""));
  const setDraft = (idx: number, v: string) => setDrafts((prev) => prev.map((d, i) => (i === idx ? v : d)));

  const save = () => {
    onSave?.(items.map((line, idx) => {
      const n = Number(drafts[idx]);
      return { ...line, precio: drafts[idx] !== "" && Number.isFinite(n) && n > 0 ? n : null };
    }));
  };

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-black uppercase tracking-widest text-foreground/60">Artículos ({items.length})</p>
        {pending > 0 && (
          <span className="inline-flex items-center gap-1 rounded-base border-2 border-amber-500 bg-amber-100 px-2 py-0.5 text-sm font-black text-amber-800">
            <BadgeDollarSign size={14} />
            {pending === 1 ? "1 precio por confirmar" : `${pending} precios por confirmar`}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {items.map((item, i) => {
          const draft = drafts[i] ?? "";
          const value = draft === "" ? null : Number(draft);
          const out = item.rango && value !== null && (value < item.rango.min || value > item.rango.max);
          const price = priceOf(item);
          return (
            <NeoCard key={i} className={`p-3 ${item.por_confirmar ? "border-amber-500 bg-amber-50" : ""}`}>
              <p className="text-base font-medium">{item.desc || item.name || `Artículo ${i + 1}`}</p>
              {item.por_confirmar && (
                <div className="mt-1 space-y-0.5 text-sm text-amber-900">
                  <p className="font-black uppercase tracking-wider">
                    Por confirmar{item.rango ? ` · ${rd(item.rango.min)} – ${rd(item.rango.max)}` : ""}
                  </p>
                  {item.nota && <p>{item.nota}</p>}
                </div>
              )}
              {editable ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-base">
                  <span className="text-foreground/70">{qtyOf(item)} x RD$</span>
                  <input
                    type="number"
                    min={0}
                    aria-label={`Precio de ${item.desc || item.name || `artículo ${i + 1}`}`}
                    value={draft}
                    onChange={(e) => setDraft(i, e.target.value)}
                    className="w-28 rounded-base border-2 border-border bg-background px-2 py-1 font-mono"
                  />
                  {item.precio_sugerido ? (
                    <button
                      type="button"
                      onClick={() => setDraft(i, String(item.precio_sugerido))}
                      className="rounded-base border-2 border-border bg-secondary-background px-2 py-1 text-sm font-bold shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                    >
                      Confirmar {rd(item.precio_sugerido)}
                    </button>
                  ) : null}
                  {out && (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-red-600">
                      <AlertTriangle size={14} /> Fuera del rango
                    </span>
                  )}
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between text-base text-foreground/70">
                  <span>{price === null ? "Sin precio" : `${qtyOf(item)} x ${rd(price)}`}</span>
                  <span className="font-semibold text-foreground">{price === null ? "—" : rd(qtyOf(item) * price)}</span>
                </div>
              )}
            </NeoCard>
          );
        })}
      </div>
      {editable && (
        <NeoButton onClick={save} disabled={!dirty || saving} className="mt-3 w-full">
          <Save size={16} />
          {saving ? "Guardando…" : "Guardar precios"}
        </NeoButton>
      )}
    </div>
  );
};

export default QuoteItemsList;
