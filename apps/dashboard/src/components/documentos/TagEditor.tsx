import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, FileDown, Paperclip, RotateCcw, Save, Sparkles, Tag, Trash2, X } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { fieldCls, labelCls } from "../users/Modal";
import { ClientPicker } from "./UploadDialog";
import DocxView, { type DocSelection, type DocxViewHandle } from "./DocxView";
import { downloadFile, versionFileUrl, type HistoryClient, type PortfolioDocument } from "../../services/documentosApi";
import {
  etiquetasAPI, groupLabel, prefillFromProfile, STATUS_LABEL, tagVersionFileUrl,
  type TagEditOp, type TagMeta, type TagModel, type TagVersion,
} from "../../services/etiquetasApi";
import { confirmDialog, notify } from "../../lib/dialogs";
import { letrasPara } from "../../lib/enLetras";

// Documentos · Etiquetas editor. The Word on the left, its tags on the right.
//  · fill: each tag has a field; typing fills the document live; Generar saves it to the client's history
//  · review (admin): tag a selection, rename/relabel/remove tags, save as a new version, approve, restore
interface Props {
  modelId: number;
  mode: "fill" | "review";
  onClose: () => void;
  onSaved?: (doc: PortfolioDocument) => void;
  onChanged?: () => void; // review: the model's status changed
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" }) : "");
const SOURCE_LABEL: Record<TagVersion["source"], string> = { ai: "IA", edit: "Edición", restore: "Restaurada" };
const toKey = (s: string) => s.toUpperCase().replace(/[^\p{L}\p{N}_ ]+/gu, "").replace(/\s+/g, " ").trim().slice(0, 80);

function groupsOf(tags: TagMeta[]) {
  const map = new Map<string, TagMeta[]>();
  for (const t of tags) map.set(t.group, [...(map.get(t.group) || []), t]);
  // people first, general data last
  return [...map.entries()].sort(([a], [b]) => Number(a === "DOCUMENTO") - Number(b === "DOCUMENTO"));
}

// The tag list as it will be after the queued edits
function applyLocal(tags: TagMeta[], ops: TagEditOp[]): TagMeta[] {
  let out = tags.map((t) => ({ ...t }));
  for (const op of ops) {
    if (op.op === "tag" && !out.some((t) => t.key === op.key)) out.push({ key: op.key, label: op.label || op.key, group: op.group || "DOCUMENTO", example: null });
    if (op.op === "meta") out = out.map((t) => (t.key === op.key ? { ...t, ...(op.label !== undefined ? { label: op.label } : {}), ...(op.group ? { group: op.group } : {}) } : t));
    if (op.op === "untag") out = out.filter((t) => t.key !== op.key);
  }
  return out;
}

export default function TagEditor({ modelId, mode, onClose, onSaved, onChanged }: Props) {
  const [model, setModel] = useState<TagModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewId, setViewId] = useState<number | null>(null); // review: version shown
  const docRef = useRef<DocxViewHandle>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const visits = useRef<Record<string, number>>({});
  const [active, setActive] = useState<string | null>(null);

  // fill
  const [values, setValues] = useState<Record<string, string>>({});
  const [client, setClient] = useState<HistoryClient | null>(null);
  const [role, setRole] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<PortfolioDocument | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiFiles, setAiFiles] = useState<File[]>([]);

  // review
  const [ops, setOps] = useState<TagEditOp[]>([]);
  const [selection, setSelection] = useState<DocSelection | null>(null);
  const [newTag, setNewTag] = useState({ key: "", label: "", group: "DOCUMENTO" });
  const [notes, setNotes] = useState("");

  const load = (next?: TagModel) => {
    const apply = (m: TagModel) => {
      setModel(m);
      setViewId(m.current?.id ?? null);
      setTitle((t) => t || m.name);
      setOps([]);
      setSelection(null);
    };
    if (next) return apply(next);
    etiquetasAPI
      .model(modelId)
      .then(({ data }) => apply(data.model))
      .catch((err) => setError(err?.response?.data?.error || "No se pudo abrir el modelo"));
  };
  useEffect(load, [modelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = model?.versions?.find((v) => v.id === viewId) || model?.current || null;
  const isLatest = !!shown && shown.id === model?.current?.id;
  const tags = useMemo(() => (shown ? (mode === "review" && isLatest ? applyLocal(shown.tags, ops) : shown.tags) : []), [shown, ops, mode, isLatest]);
  const labels = useMemo(() => Object.fromEntries(tags.map((t) => [t.key, t.label])), [tags]);
  const roles = useMemo(() => [...new Set(tags.map((t) => t.group).filter((g) => g !== "DOCUMENTO"))], [tags]);
  const filled = tags.filter((t) => values[t.key]?.trim()).length;

  // client + role → that role's tags from the client's legal profile. What a previous client/role
  // filled is removed first (what was typed by hand stays); a late answer for another client is ignored.
  const prefilled = useRef<Record<string, string>>({});
  useEffect(() => {
    const previous = prefilled.current;
    prefilled.current = {};
    setValues((v) => {
      const next = { ...v };
      for (const [k, val] of Object.entries(previous)) if (next[k] === val) delete next[k];
      return next;
    });
    if (mode !== "fill" || !client || !role || !shown) return;
    let alive = true;
    etiquetasAPI
      .profile(client.id)
      .then(({ data }) => {
        if (!alive) return;
        const fill = prefillFromProfile(shown.tags, data.profile, role);
        prefilled.current = fill;
        setValues((v) => ({ ...v, ...fill }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [client, role, shown, mode]);

  const goTo = (key: string) => {
    setActive(key);
    const n = visits.current[key] ?? 0;
    const count = docRef.current?.scrollTo(key, n) ?? 0;
    visits.current[key] = count ? (n + 1) % count : 0;
  };

  const onChip = (key: string) => {
    setActive(key);
    const input = inputs.current[key];
    input?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    input?.focus();
  };

  const setValue = (key: string, v: string) => setValues((s) => {
    const next = { ...s, [key]: v };
    if (!v) delete next[key];
    return next;
  });

  const fillWithAI = async () => {
    setBusy(true);
    try {
      const { data } = await etiquetasAPI.extract(modelId, { version_id: shown!.id, client_id: client?.id, text: aiText, files: aiFiles });
      const n = Object.keys(data.values).length;
      setValues((v) => ({ ...v, ...data.values }));
      notify(n ? `La IA llenó ${n} etiqueta${n === 1 ? "" : "s"}; revísalas` : "La IA no encontró datos para llenar", n ? "success" : "info");
    } catch (err: any) {
      notify(err?.response?.data?.error || "La IA no respondió; intenta de nuevo");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!client) return notify("Elige el cliente");
    const empty = tags.length - filled;
    if (empty && !(await confirmDialog(`Hay ${empty} etiquetas sin llenar; quedarán como «________» para completarlas a mano. ¿Generar así?`, { title: "Etiquetas vacías", confirmLabel: "Generar así" }))) return;
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(values).filter(([k, v]) => labels[k] && v.trim()));
      // the version on screen (the server only honors another version than the approved one for admins)
      const { data } = await etiquetasAPI.fill(modelId, { values: clean, client_id: client.id, client_role: role || null, title: title.trim() || model!.name, version_id: shown!.id });
      setSaved(data.document);
      onSaved?.(data.document);
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudo generar el documento");
    } finally {
      setBusy(false);
    }
  };

  const queue = (op: TagEditOp) => setOps((o) => [...o.filter((x) => !(x.op === "meta" && op.op === "meta" && x.key === op.key)), op]);

  const addTag = () => {
    const key = toKey(newTag.key);
    if (!selection || !key) return notify("Ponle un nombre a la etiqueta");
    const known = tags.find((t) => t.key === key);
    queue({ op: "tag", text: selection.text, offset: selection.offset, length: selection.length, occurrence: selection.occurrence, key, label: newTag.label.trim() || undefined, group: known?.group || newTag.group });
    setSelection(null);
    setNewTag({ key: "", label: "", group: "DOCUMENTO" });
  };

  const saveEdits = async () => {
    setBusy(true);
    try {
      const { data } = await etiquetasAPI.edit(modelId, { base_version_id: model!.current!.id, ops, notes });
      setNotes("");
      load(data.model);
      onChanged?.();
      notify(`Guardado como v${data.model.current?.version_number}; queda pendiente de aprobación`, "success");
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudieron guardar los cambios");
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!(await confirmDialog(`¿Aprobar la v${model!.current!.version_number} de «${model!.name}»? Desde ahora los digitadores la usarán para llenar.`, { title: "Aprobar etiquetas", confirmLabel: "Aprobar" }))) return;
    setBusy(true);
    try {
      const { data } = await etiquetasAPI.approve(model!.current!.id);
      load(data.model);
      onChanged?.();
      notify("Aprobado", "success");
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudo aprobar");
    } finally {
      setBusy(false);
    }
  };

  const restore = async (v: TagVersion) => {
    setBusy(true);
    try {
      const { data } = await etiquetasAPI.restore(modelId, v.id);
      load(data.model);
      onChanged?.();
      notify(`La v${v.version_number} se copió como nueva versión pendiente`, "success");
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudo restaurar");
    } finally {
      setBusy(false);
    }
  };

  const download = (format: "docx" | "pdf") =>
    saved && downloadFile(versionFileUrl(saved.versions![0].id, format), `${saved.title}.${format}`).catch((e: Error) => notify(e.message));

  const status = model?.status;
  const statusTone = status === "approved" ? "bg-green-200 text-green-900" : status === "pending" ? "bg-amber-200 text-amber-900" : "bg-foreground/10";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={model?.name || "Documento"}>
      <header className="flex items-center justify-between gap-3 border-b-2 border-border bg-secondary-background px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Tag size={18} className="shrink-0 text-main" />
          <span className="truncate text-sm font-bold">{mode === "fill" ? "Llenar documento" : "Revisión de etiquetas"}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-base border-2 border-border bg-background p-1.5 hover:bg-main/10">
          <X size={18} />
        </button>
      </header>

      {error ? (
        <p className="p-8 text-center text-sm text-foreground/70">{error}</p>
      ) : !model || !shown ? (
        <p className="p-8 text-center text-sm text-foreground/60">Cargando…</p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,45fr)_minmax(0,55fr)] lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[minmax(0,1fr)]">
          <div className="min-h-0 p-2 lg:p-3">
            <DocxView
              ref={docRef}
              url={tagVersionFileUrl(shown.id)}
              values={mode === "fill" ? values : {}}
              labels={labels}
              activeKey={active}
              onTagClick={onChip}
              onSelect={mode === "review" && isLatest ? setSelection : undefined}
            />
          </div>

          <aside className="flex min-h-0 min-w-0 flex-col border-t-2 border-border bg-secondary-background lg:border-l-2 lg:border-t-0">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {/* document info */}
              <section className="space-y-1">
                <h2 className="break-words font-heading text-lg font-black leading-tight lg:text-xl">{model.name}</h2>
                <p className="text-xs text-foreground/60">{model.category || "Sin categoría"}</p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className={`rounded-base border-2 border-border px-2 py-0.5 font-bold ${statusTone}`}>{STATUS_LABEL[model.status]}</span>
                  <span className="font-semibold">v{shown.version_number}</span>
                  {model.approved && (
                    <span className="text-foreground/60">
                      · v{model.approved.version_number} aprobado por {model.approved.approved_by_name || "admin"} el {fmtDate(model.approved.approved_at)}
                    </span>
                  )}
                </div>
              </section>

              {mode === "fill" && !saved && (
                <section className="space-y-3 rounded-base border-2 border-border bg-background p-3">
                  <ClientPicker client={client} onChange={(c) => { setClient(c); setRole(""); }} />
                  <label className={labelCls}>
                    Nombre del documento
                    <input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} />
                  </label>
                  {roles.length > 0 && (
                    <label className={labelCls}>
                      El cliente es…
                      <select className={fieldCls} value={role} onChange={(e) => setRole(e.target.value)} disabled={!client}>
                        <option value="">Ninguno (solo redacto el documento)</option>
                        {roles.map((r) => <option key={r} value={r}>{groupLabel(r)}</option>)}
                      </select>
                    </label>
                  )}
                  <button type="button" onClick={() => setAiOpen((o) => !o)} className="flex items-center gap-1 text-sm font-semibold underline">
                    <Sparkles size={14} /> Llenar con IA (fotos, PDF, audio o texto)
                  </button>
                  {aiOpen && (
                    <div className="space-y-2">
                      <label className={labelCls}>
                        Información del caso
                        <textarea className={fieldCls} rows={3} value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Ej. La compradora es María Gómez, cédula 001-…" />
                      </label>
                      <label className="flex cursor-pointer items-center gap-1 text-xs font-semibold">
                        <Paperclip size={14} /> {aiFiles.length ? `${aiFiles.length} adjunto(s)` : "Adjuntar cédulas, documentos o audios"}
                        <input type="file" multiple className="sr-only" accept="image/*,application/pdf,audio/*" onChange={(e) => setAiFiles(Array.from(e.target.files || []).slice(0, 5))} />
                      </label>
                      <NeoButton size="sm" type="button" onClick={fillWithAI} disabled={busy || (!aiText.trim() && !aiFiles.length && !client)}>
                        <Sparkles size={14} /> {busy ? "Leyendo…" : "Llenar con IA"}
                      </NeoButton>
                    </div>
                  )}
                </section>
              )}

              {mode === "review" && (
                <ReviewHeader
                  model={model}
                  shown={shown}
                  isLatest={isLatest}
                  busy={busy}
                  onView={setViewId}
                  onRestore={restore}
                />
              )}

              {mode === "review" && isLatest && selection && (
                <section className="space-y-2 rounded-base border-2 border-main bg-background p-3">
                  <p className="text-sm font-bold">Etiquetar «{selection.selected}»</p>
                  <label className={labelCls}>
                    Nombre de la etiqueta
                    <input
                      className={fieldCls}
                      list="tag-keys"
                      value={newTag.key}
                      placeholder="Ej. NOMBRE_VENDEDOR"
                      onChange={(e) => {
                        const key = toKey(e.target.value);
                        // a key ending in an existing role belongs to that role
                        const role = roles.find((r) => key.endsWith(`_${r}`));
                        setNewTag({ ...newTag, key: e.target.value, ...(role ? { group: role } : {}) });
                      }}
                    />
                  </label>
                  <datalist id="tag-keys">{tags.map((t) => <option key={t.key} value={t.key} />)}</datalist>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={labelCls}>
                      Descripción
                      <input className={fieldCls} value={newTag.label} onChange={(e) => setNewTag({ ...newTag, label: e.target.value })} placeholder="Nombre del vendedor" />
                    </label>
                    <label className={labelCls}>
                      Parte
                      <input className={fieldCls} list="tag-groups" value={newTag.group} onChange={(e) => setNewTag({ ...newTag, group: toKey(e.target.value).replace(/ /g, "_") })} />
                      <datalist id="tag-groups">{["DOCUMENTO", ...roles].map((g) => <option key={g} value={g}>{groupLabel(g)}</option>)}</datalist>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <NeoButton size="sm" variant="neutral" type="button" onClick={() => setSelection(null)}>Cancelar</NeoButton>
                    <NeoButton size="sm" type="button" onClick={addTag}>Agregar etiqueta</NeoButton>
                  </div>
                </section>
              )}

              {mode === "review" && isLatest && !selection && (
                <p className="text-xs text-foreground/60">Para etiquetar un dato, selecciónalo con el mouse en el documento.</p>
              )}

              {/* tags by role */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black">Etiquetas</h3>
                {mode === "fill" && <span className="text-xs font-semibold text-foreground/70">{filled} de {tags.length} llenas</span>}
              </div>
              {!tags.length && <p className="text-sm text-foreground/60">Este modelo no tiene etiquetas.</p>}
              {groupsOf(tags).map(([group, list]) => (
                <section key={group} className="space-y-2">
                  <h3 className="border-b-2 border-border/20 pb-1 text-xs font-black uppercase tracking-wide text-foreground/70">{groupLabel(group)}</h3>
                  {list.map((t) => {
                    const v = values[t.key] || "";
                    const words = mode === "fill" ? letrasPara(t.key, values) : null;
                    return (
                      <div key={t.key} className={`rounded-base border-2 p-2 ${active === t.key ? "border-main" : "border-border/30"} bg-background`}>
                        <button type="button" onClick={() => goTo(t.key)} aria-label={`Ir a ${t.label}`} className="flex w-full items-center gap-1.5 text-left">
                          {mode === "fill" && (v.trim() ? <CheckCircle2 size={15} className="shrink-0 text-green-600" /> : <Circle size={15} className="shrink-0 text-amber-500" />)}
                          <span className="min-w-0 flex-1 truncate text-xs font-bold">{t.label}</span>
                          <span className="shrink-0 font-mono text-[10px] text-foreground/50">{t.key}</span>
                        </button>
                        {mode === "fill" ? (
                          <div className="mt-1 flex gap-1">
                            <input
                              ref={(el) => { inputs.current[t.key] = el; }}
                              aria-label={t.label}
                              className={`${fieldCls} mt-0`}
                              value={v}
                              placeholder={t.example ? `Ej. ${t.example}` : "Vacío"}
                              onFocus={() => setActive(t.key)}
                              onChange={(e) => setValue(t.key, e.target.value)}
                            />
                            {words && words !== v && (
                              <button type="button" onClick={() => setValue(t.key, words)} className="shrink-0 rounded-base border-2 border-border px-2 text-[11px] font-bold hover:bg-main/10">
                                En letras
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 space-y-1">
                            <div className="flex gap-1">
                              <input
                                aria-label={`Etiqueta ${t.key}`}
                                className={`${fieldCls} mt-0`}
                                value={t.label}
                                disabled={!isLatest}
                                onChange={(e) => queue({ op: "meta", key: t.key, label: e.target.value })}
                              />
                              {isLatest && (
                                <button type="button" aria-label={`Quitar ${t.key}`} title="Quitar etiqueta (vuelve el texto original)" onClick={() => queue({ op: "untag", key: t.key })} className="shrink-0 rounded-base border-2 border-border px-2 hover:bg-red-100">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            {t.example && <p className="truncate text-[11px] text-foreground/60">Reemplazó: «{t.example}»</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>

            {/* footer actions */}
            <div className="space-y-2 border-t-2 border-border bg-background p-3">
              {mode === "fill" && !saved && (
                <>
                  <NeoButton className="w-full" type="button" onClick={generate} disabled={busy}>
                    <Save size={16} className="shrink-0" /> {busy ? "Generando…" : `Generar y guardar para ${client?.name || "el cliente"}`}
                  </NeoButton>
                </>
              )}
              {mode === "fill" && saved && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-green-700">✓ Guardado en el historial de {client?.name || "el cliente"}.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <NeoButton type="button" variant="neutral" onClick={() => download("docx")}><FileDown size={15} /> Descargar Word</NeoButton>
                    <NeoButton type="button" variant="neutral" onClick={() => download("pdf")}><FileDown size={15} /> Descargar PDF</NeoButton>
                  </div>
                  <NeoButton className="w-full" type="button" onClick={onClose}>Listo</NeoButton>
                </div>
              )}
              {mode === "review" && isLatest && (
                <>
                  {ops.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-amber-700">
                        {ops.length} cambios al modelo sin guardar · se guardan como v{model.current!.version_number + 1} (no afecta documentos de clientes)
                      </p>
                      <input className={fieldCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Nota (opcional): qué cambiaste" aria-label="Nota de la versión" />
                    </>
                  )}
                  <div className="flex flex-col gap-2">
                    <NeoButton className="w-full" size="sm" type="button" variant="neutral" onClick={saveEdits} disabled={busy || !ops.length}>
                      <Save size={15} className="shrink-0" /> Guardar como v{model.current!.version_number + 1} del modelo
                    </NeoButton>
                    {model.status !== "approved" && (
                      <NeoButton className="w-full" size="sm" type="button" onClick={approve} disabled={busy || ops.length > 0} title={ops.length ? "Guarda los cambios antes de aprobar" : undefined}>
                        <CheckCircle2 size={15} className="shrink-0" /> Aprobar v{model.current!.version_number}
                      </NeoButton>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function ReviewHeader({ model, shown, isLatest, busy, onView, onRestore }: {
  model: TagModel; shown: TagVersion; isLatest: boolean; busy: boolean;
  onView: (id: number) => void; onRestore: (v: TagVersion) => void;
}) {
  return (
    <section className="space-y-3">
      {isLatest && shown.skipped.length > 0 && (
        <div className="rounded-base border-2 border-amber-500 bg-amber-50 p-2 text-xs text-amber-950">
          <p className="font-bold">La IA no pudo etiquetar {shown.skipped.length} párrafo(s) sin cambiar su texto. Revísalos y etiquétalos a mano si tienen datos:</p>
          <ul className="mt-1 max-h-32 list-disc space-y-1 overflow-y-auto pl-4">
            {shown.skipped.map((s) => <li key={s.i}>{s.text}</li>)}
          </ul>
        </div>
      )}
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-foreground/70">Versiones</p>
        <ul aria-label="Versiones" className="mt-1 space-y-1">
          {model.versions!.map((v) => {
            const inUse = v.id === model.approved?.id;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onView(v.id)}
                  className={`w-full rounded-base border-2 px-2 py-1 text-left text-xs ${v.id === shown.id ? "border-main bg-main/10" : "border-border/30 bg-background hover:bg-main/5"}`}
                >
                  <b>v{v.version_number}{inUse ? " · en uso" : ""}</b> · {SOURCE_LABEL[v.source]} · {v.created_by_name || "—"} · {fmtDate(v.created_at)}
                  {v.notes && <span className="block truncate text-foreground/60">{v.notes}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {!isLatest && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-base border-2 border-border bg-background p-2 text-xs">
            <span>Estás viendo una versión anterior (solo lectura).</span>
            <NeoButton size="sm" type="button" variant="neutral" disabled={busy} onClick={() => onRestore(shown)}>
              <RotateCcw size={13} /> Restaurar v{shown.version_number}
            </NeoButton>
          </div>
        )}
      </div>
    </section>
  );
}
