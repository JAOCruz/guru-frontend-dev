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
  const [changed, setChanged] = useState(false);
  useEffect(() => { setChanged(dirty.current); }, [draft]);
  const field = "rounded-base border-2 border-border bg-white px-2 py-1 font-bold text-black focus:outline-none focus:ring-2 focus:ring-main";
  const inputCls = `${field} text-right`;
  const chip = "flex flex-col items-center rounded-base border-2 border-border bg-secondary-background px-0.5 py-1 leading-tight";
  const chipNum = "whitespace-nowrap text-[13px] font-black";

  return (
    <NeoCard className="flex min-w-0 flex-col gap-6 p-3 sm:p-6" aria-busy={!loaded}>
      <div>
        <h2 className="font-heading text-2xl font-black uppercase">Tarifas</h2>
        <p className="text-sm font-bold opacity-70">
          {isAdmin ? "Cambie una tarifa y guarde: el bot y los precios de los modelos la usan enseguida." : "Las tarifas vigentes. Solo el administrador las cambia."}
        </p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="tarifas-foja">
        <h3 id="tarifas-foja" className="text-lg font-black">Por foja</h3>
        <ul className="flex flex-col gap-3">
          {Object.keys(FOJA_RATES).map((k) => {
            const label = FOJA_RATES[k].label;
            const rate = draft.foja[k];
            return (
              <li key={k} role="group" aria-label={label}
                className="flex flex-col gap-2 rounded-base border-2 border-border p-3 md:flex-row md:items-center md:gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 md:w-72 md:shrink-0 md:flex-nowrap">
                  <span className="font-black">{label}</span>
                  {isAdmin ? (
                    <label className="flex items-center gap-1 whitespace-nowrap text-xs font-bold">
                      RD$
                      <input aria-label={`Tarifa por foja ${label}`} className={`${inputCls} w-20`} type="number" min={1} inputMode="numeric"
                        value={Number.isFinite(rate) ? rate : ""} onChange={(e) => setFoja(k, e.target.value)} />
                      / foja
                    </label>
                  ) : (
                    <span className="whitespace-nowrap font-bold">{money(rate)} / foja</span>
                  )}
                </div>
                <div className="grid flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {FOJAS_VISTA.map((n) => (
                    <span key={n} className={chip}>
                      <span className="whitespace-nowrap text-[10px] font-bold uppercase opacity-70">{n} {n === 1 ? "foja" : "fojas"}</span>
                      <span className={chipNum}>{money(rate * n)}</span>
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs font-bold opacity-60">Modificación de 3 fojas o más: el digitador confirma el precio dentro del rango.</p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="tarifas-trad">
        <div>
          <h3 id="tarifas-trad" className="text-lg font-black">Traducciones (precio por página)</h3>
          <p className="text-xs font-bold opacity-60">
            El precio por página baja con la cantidad: al llegar a un tramo, todas las páginas pasan a ese precio. Total = precio del tramo × páginas.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {draft.traduccion.tipos.map((t, i) => (
            <article key={t.key} role="group" aria-label={t.label || `Tipo ${i + 1}`} className="flex min-w-0 flex-col gap-3 rounded-base border-2 border-border p-3">
              <header className="flex items-center gap-2 md:max-w-md">
                {isAdmin ? (
                  <input aria-label={`Nombre del tipo ${i + 1}`} className={`${field} min-w-0 flex-1`}
                    value={t.label} onChange={(e) => setTipo(i, (x) => ({ ...x, label: e.target.value }))} />
                ) : (
                  <span className="flex-1 font-black">{t.label}</span>
                )}
                {isAdmin && draft.traduccion.tipos.length > 1 && (
                  <button type="button" className="rounded-base border-2 border-border p-1.5 hover:bg-red-100" aria-label={`Quitar el tipo ${t.label}`} title="Quitar este tipo"
                    onClick={() => edit((d) => ({ ...d, traduccion: { tipos: d.traduccion.tipos.filter((_, j) => j !== i) } }))}>
                    <Trash2 size={14} />
                  </button>
                )}
              </header>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)] lg:gap-6">
              <ul className="flex flex-col gap-1.5">
                {t.tramos.map((x, j) => (
                  <li key={j} className="flex items-center gap-x-2 gap-y-1 text-sm font-bold">
                    {isAdmin ? (
                      <>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            Desde
                            <input aria-label={`${t.label}: tramo ${j + 1} desde (páginas)`} className={`${inputCls} w-12 px-1 disabled:opacity-60`}
                              type="number" min={1} disabled={j === 0} value={Number.isFinite(x.desde) ? x.desde : ""} onChange={(e) => setTramo(i, j, "desde", e.target.value)} />
                            {x.desde === 1 ? "pág." : "págs."}
                          </span>
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            RD$
                            <input aria-label={`${t.label}: precio por página desde ${x.desde} ${x.desde === 1 ? "página" : "páginas"}`} className={`${inputCls} w-20`}
                              type="number" min={1} value={Number.isFinite(x.precio) ? x.precio : ""} onChange={(e) => setTramo(i, j, "precio", e.target.value)} />
                            <span className="opacity-70">c/u</span>
                          </span>
                        </span>
                        {j > 0 && (
                          <button type="button" aria-label={`Quitar el tramo ${j + 1} de ${t.label}`} title="Quitar este tramo" className="ml-auto shrink-0 rounded-base p-1 hover:bg-red-100"
                            onClick={() => setTipo(i, (y) => ({ ...y, tramos: y.tramos.filter((_, k) => k !== j) }))}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </>
                    ) : (
                      <span>{tramoTexto(t, j)}: {money(x.precio)} c/u</span>
                    )}
                  </li>
                ))}
                {isAdmin && (
                  <li>
                    <button type="button" className="text-xs font-black underline"
                      onClick={() => setTipo(i, (y) => {
                        const last = y.tramos[y.tramos.length - 1];
                        return { ...y, tramos: [...y.tramos, { desde: (last?.desde || 1) + 5, precio: last?.precio || 0 }] };
                      })}>
                      + Agregar tramo
                    </button>
                  </li>
                )}
              </ul>

              <div>
                <p className="mb-1 text-[11px] font-black uppercase opacity-70">Total según las páginas</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {PAGINAS_VISTA.map((n) => {
                    const r = traduccionTotal(t, n);
                    return (
                      <span key={n} className={chip} title={`${n} × ${money(r.porPagina)}`}>
                        <span className="whitespace-nowrap text-[10px] font-bold uppercase opacity-70">{n} pág.</span>
                        <span className={chipNum}>{money(r.total)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              </div>
            </article>
          ))}
        </div>
        {isAdmin && (
          <NeoButton variant="neutral" size="sm" className="self-start"
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
        <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-end gap-3 rounded-base border-2 border-border bg-secondary-background p-3 shadow-shadow sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          {changed && <span className="text-sm font-black text-amber-700">Tiene cambios sin guardar</span>}
          <NeoButton onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? "Guardando…" : "Guardar tarifas"}
          </NeoButton>
        </div>
      )}
    </NeoCard>
  );
}
