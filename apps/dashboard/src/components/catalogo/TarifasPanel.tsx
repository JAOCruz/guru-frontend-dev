import { useEffect, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { NeoButton, NeoCard } from "@guru/ui";
import { useAuth } from "../../context/AuthContext";
import { serviceCatalogAPI } from "../../services/api";
import { notify } from "../../lib/dialogs";
import { FOJA_RATES } from "../../lib/fojaRates";
import { fmtRD, traduccionTotal, useTarifas, type Rates, type TipoTraduccion } from "../../lib/tarifas";

// Tarifas editables: por foja y de traducción (precio por página que baja por tramos). Todos las ven; solo el
// admin las cambia. Al guardar, el bot y los precios de los modelos las usan enseguida.
const FOJAS_VISTA = [1, 2, 3, 4];
const PAGINAS_VISTA = [1, 2, 3, 5, 9, 10, 15];

const clone = (r: Rates): Rates => JSON.parse(JSON.stringify(r));
const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

function tramoTexto(t: TipoTraduccion, i: number) {
  const sorted = t.tramos;
  const next = sorted[i + 1];
  return next ? `${sorted[i].desde}–${next.desde - 1} pág.` : `${sorted[i].desde}+ pág.`;
}

export default function TarifasPanel({ onSaved }: { onSaved?: () => void } = {}) {
  const { isAdmin } = useAuth();
  const { rates, loaded, replace } = useTarifas();
  const [draft, setDraft] = useState<Rates>(() => clone(rates));
  const [saving, setSaving] = useState(false);
  // what someone is typing is never replaced by the rates arriving from the server
  const dirty = useRef(false);

  useEffect(() => { if (!dirty.current) setDraft(clone(rates)); }, [rates]);

  const edit = (fn: (d: Rates) => Rates) => { dirty.current = true; setDraft(fn); };
  const setFoja = (k: string, v: string) => edit((d) => ({ ...d, foja: { ...d.foja, [k]: num(v) } }));
  const setTipo = (i: number, fn: (t: TipoTraduccion) => TipoTraduccion) =>
    edit((d) => ({ ...d, traduccion: { tipos: d.traduccion.tipos.map((t, j) => (j === i ? fn(t) : t)) } }));
  const setTramo = (i: number, j: number, field: "desde" | "precio", v: string) =>
    setTipo(i, (t) => ({ ...t, tramos: t.tramos.map((x, k) => (k === j ? { ...x, [field]: num(v) } : x)) }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await serviceCatalogAPI.saveRates(draft);
      dirty.current = false;
      replace(res.data.rates);
      onSaved?.();
      notify("Tarifas guardadas. El bot y los modelos ya usan los precios nuevos.", "success");
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudieron guardar las tarifas", "error");
    } finally {
      setSaving(false);
    }
  };

  const money = (v: number) => (Number.isFinite(v) && v > 0 ? fmtRD(v) : "—");
  const cell = "border-b-2 border-border px-2 py-2 text-sm";
  const input = "w-24 rounded-base border-2 border-border bg-white px-2 py-1 text-right font-bold text-black";

  return (
    <NeoCard className="flex flex-col gap-6 p-4 sm:p-6" aria-busy={!loaded}>
      <div>
        <h2 className="font-heading text-2xl font-black uppercase">Tarifas</h2>
        <p className="text-sm font-bold opacity-70">
          {isAdmin ? "Cambie una tarifa y guarde: el bot y los precios de los modelos la usan enseguida." : "Las tarifas vigentes. Solo el administrador las cambia."}
        </p>
      </div>

      <section className="overflow-x-auto">
        <h3 className="mb-2 text-lg font-black">Por foja</h3>
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase opacity-70">
              <th className={cell}>Tipo</th>
              <th className={cell}>Por foja</th>
              {FOJAS_VISTA.map((n) => <th key={n} className={`${cell} text-right`}>{n} {n === 1 ? "foja" : "fojas"}</th>)}
            </tr>
          </thead>
          <tbody>
            {Object.keys(FOJA_RATES).map((k) => {
              const label = FOJA_RATES[k].label;
              const rate = draft.foja[k];
              return (
                <tr key={k}>
                  <th scope="row" className={`${cell} text-left font-black`}>{label}</th>
                  <td className={cell}>
                    {isAdmin ? (
                      <input aria-label={`Tarifa por foja ${label}`} className={input} type="number" min={1} inputMode="numeric"
                        value={Number.isFinite(rate) ? rate : ""} onChange={(e) => setFoja(k, e.target.value)} />
                    ) : money(rate)}
                  </td>
                  {FOJAS_VISTA.map((n) => <td key={n} className={`${cell} text-right font-bold`}>{money(rate * n)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-1 text-xs font-bold opacity-60">Modificación de 3 fojas o más: el digitador confirma el precio dentro del rango.</p>
      </section>

      <section className="overflow-x-auto">
        <h3 className="mb-2 text-lg font-black">Traducciones (precio por página)</h3>
        <p className="mb-2 text-xs font-bold opacity-60">
          El precio por página baja con la cantidad: al llegar a un tramo, todas las páginas pasan a ese precio. Total = precio del tramo × páginas.
        </p>
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="text-left text-xs uppercase opacity-70">
              <th className={cell}>Tipo</th>
              <th className={cell}>Tramos</th>
              {PAGINAS_VISTA.map((n) => <th key={n} className={`${cell} text-right`}>{n} pág.</th>)}
            </tr>
          </thead>
          <tbody>
            {draft.traduccion.tipos.map((t, i) => (
              <tr key={t.key}>
                <th scope="row" className={`${cell} text-left align-top font-black`}>
                  {isAdmin ? (
                    <input aria-label={`Nombre del tipo ${i + 1}`} className="w-48 rounded-base border-2 border-border bg-white px-2 py-1 font-bold text-black"
                      value={t.label} onChange={(e) => setTipo(i, (x) => ({ ...x, label: e.target.value }))} />
                  ) : t.label}
                  {isAdmin && draft.traduccion.tipos.length > 1 && (
                    <button type="button" className="ml-2 align-middle opacity-70 hover:opacity-100" aria-label={`Quitar el tipo ${t.label}`}
                      onClick={() => edit((d) => ({ ...d, traduccion: { tipos: d.traduccion.tipos.filter((_, j) => j !== i) } }))}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </th>
                <td className={`${cell} align-top`}>
                  <div className="flex flex-col gap-1">
                    {t.tramos.map((x, j) => (
                      <div key={j} className="flex items-center gap-1 whitespace-nowrap">
                        {isAdmin ? (
                          <>
                            <span className="text-xs font-bold">desde</span>
                            <input aria-label={`${t.label}: tramo ${j + 1} desde (páginas)`} className="w-14 rounded-base border-2 border-border bg-white px-1 py-0.5 text-right font-bold text-black"
                              type="number" min={1} disabled={j === 0} value={Number.isFinite(x.desde) ? x.desde : ""} onChange={(e) => setTramo(i, j, "desde", e.target.value)} />
                            <span className="text-xs font-bold">pág.</span>
                            <input aria-label={`${t.label}: precio por página desde ${x.desde} ${x.desde === 1 ? "página" : "páginas"}`} className={input}
                              type="number" min={1} value={Number.isFinite(x.precio) ? x.precio : ""} onChange={(e) => setTramo(i, j, "precio", e.target.value)} />
                            {j > 0 && (
                              <button type="button" aria-label={`Quitar el tramo ${j + 1} de ${t.label}`} className="opacity-70 hover:opacity-100"
                                onClick={() => setTipo(i, (y) => ({ ...y, tramos: y.tramos.filter((_, k) => k !== j) }))}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-bold">{tramoTexto(t, j)}: {money(x.precio)}</span>
                        )}
                      </div>
                    ))}
                    {isAdmin && (
                      <button type="button" className="self-start text-xs font-black underline"
                        onClick={() => setTipo(i, (y) => {
                          const last = y.tramos[y.tramos.length - 1];
                          return { ...y, tramos: [...y.tramos, { desde: (last?.desde || 1) + 5, precio: last?.precio || 0 }] };
                        })}>
                        + tramo
                      </button>
                    )}
                  </div>
                </td>
                {PAGINAS_VISTA.map((n) => (
                  <td key={n} className={`${cell} text-right align-top font-bold`}>{money(traduccionTotal(t, n).total)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {isAdmin && (
          <NeoButton variant="neutral" size="sm" className="mt-2"
            onClick={() => edit((d) => {
              const label = "Tipo nuevo";
              // a key never used before: a removed type's catalog service is never reused by a new one
              const key = `${slug(label)}_${Date.now().toString(36)}`;
              return { ...d, traduccion: { tipos: [...d.traduccion.tipos, { key, label, tramos: [{ desde: 1, precio: 0 }] }] } };
            })}>
            <Plus size={14} /> Agregar tipo de traducción
          </NeoButton>
        )}
      </section>

      {isAdmin && (
        <div className="flex justify-end">
          <NeoButton onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? "Guardando…" : "Guardar tarifas"}
          </NeoButton>
        </div>
      )}
    </NeoCard>
  );
}
