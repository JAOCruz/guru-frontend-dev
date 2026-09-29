import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, Paperclip, Sparkles, Wand2, X } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { fieldCls, labelCls } from "../users/Modal";
import { ClientPicker } from "./UploadDialog";
import PdfPreview from "./PdfPreview";
import { generacionAPI, versionFileUrl, type Change, type Field, type HistoryClient, type PortfolioDocument, type Source } from "../../services/documentosApi";

interface Props {
  source: Source;
  title: string;
  fixedClient?: HistoryClient; // when personalizing a document already in someone's history
  onClose: () => void;
  onSaved: (doc: PortfolioDocument) => void;
}

const ATTACH_ACCEPT = "image/*,application/pdf,audio/*";
const human = (s: string) => (s === "DOCUMENTO" ? "Datos del documento" : s.charAt(0) + s.slice(1).toLowerCase());
const errorOf = (err: any, fallback: string) => err?.response?.data?.error || fallback;

// Generación: fill a model (or a history version) with a client's data — prefilled from their
// legal profile and completed by the AI from photos, PDFs, audios or text — or apply specific
// changes described in plain words. The result is always a draft in the history.
export default function PersonalizeDialog({ source, title, fixedClient, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<"fill" | "edit">("fill");
  const [client, setClient] = useState<HistoryClient | null>(fixedClient ?? null);
  const [role, setRole] = useState<string>("");
  const [fields, setFields] = useState<Field[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [exact, setExact] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [aiKeys, setAiKeys] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [docTitle, setDocTitle] = useState(title);
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState<"fields" | "ai" | "save" | null>("fields");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ document: PortfolioDocument; changes: Change[]; exact?: boolean } | null>(null);
  const [preview, setPreview] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fromHistory = "version_id" in source;

  // Fields (and what the client's legal profile already knows for their role)
  useEffect(() => {
    setBusy("fields");
    generacionAPI
      .fields(source, client?.id, role || null)
      .then(({ data }) => {
        setFields(data.fields);
        setRoles(data.roles);
        setExact(data.exact);
        setValues((v) => ({ ...data.prefill, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x)) }));
      })
      .catch((err) => setError(errorOf(err, "No se pudieron cargar los campos del documento")))
      .finally(() => setBusy(null));
  }, [client?.id, role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (client && !fromHistory && docTitle === title) setDocTitle(`${title} — ${client.name || "cliente"}`);
  }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const order = [...new Set(fields.map((f) => f.group))].sort((a, b) => (a === "DOCUMENTO" ? 1 : b === "DOCUMENTO" ? -1 : 0));
    return order.map((g) => ({ group: g, fields: fields.filter((f) => f.group === g) }));
  }, [fields]);

  const fillWithAI = async () => {
    setBusy("ai");
    setError(null);
    try {
      const { data } = await generacionAPI.extract(source, { client_id: client?.id, text, files });
      const found = Object.entries(data.values).filter(([k]) => !values[k]?.trim());
      if (!found.length) setError("La IA no encontró datos nuevos en lo que adjuntaste; completa a mano lo que falte.");
      setValues((v) => ({ ...v, ...Object.fromEntries(found) }));
      setAiKeys((s) => new Set([...s, ...found.map(([k]) => k)]));
    } catch (err) {
      setError(errorOf(err, "La IA no respondió; intenta de nuevo"));
    } finally {
      setBusy(null);
    }
  };

  const finish = (data: { document: PortfolioDocument; changes: Change[]; exact?: boolean }) => {
    setResult(data);
    onSaved(data.document);
  };

  const generate = async () => {
    if (!client) return setError("Elige el cliente");
    setBusy("save");
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v?.trim()));
      const { data } = await generacionAPI.generate({ ...source, client_id: client.id, client_role: role || null, title: docTitle, values: clean });
      finish(data);
    } catch (err) {
      setError(errorOf(err, "No se pudo generar el documento"));
    } finally {
      setBusy(null);
    }
  };

  const applyChanges = async () => {
    if (!client) return setError("Elige el cliente");
    setBusy("save");
    setError(null);
    try {
      const { data } = await generacionAPI.aiEdit({ ...source, client_id: client.id, ...(fromHistory ? {} : { title: docTitle }), instructions });
      finish(data);
    } catch (err) {
      setError(errorOf(err, "No se pudieron aplicar los cambios"));
    } finally {
      setBusy(null);
    }
  };

  const newest = result?.document.versions?.[0];

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 p-0 md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Personalizar ${title}`}
        className="flex w-full max-w-3xl flex-col overflow-hidden border-2 border-border bg-background shadow-shadow md:rounded-base"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-border bg-main px-4 py-3 text-main-foreground">
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase opacity-80">Personalizar</span>
            <span className="block truncate font-heading text-lg font-black">{title}</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-base p-1 hover:bg-black/10">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {result ? (
            <ResultView result={result} clientName={client?.name} onView={() => setPreview(true)} onClose={onClose} />
          ) : (
            <>
              {fixedClient ? (
                <p className="text-sm">
                  Cliente: <b>{fixedClient.name || "Sin nombre"}</b> · el resultado se guarda como una versión nueva de este documento.
                </p>
              ) : (
                <ClientPicker client={client} onChange={setClient} />
              )}

              <div role="tablist" className="grid grid-cols-2 gap-2">
                {([["fill", "Llenar con los datos del cliente", Sparkles], ["edit", "Cambios específicos", Wand2]] as const).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={`flex min-w-0 items-center justify-center gap-2 rounded-base border-2 border-border px-2 py-2 text-center text-sm font-bold leading-tight ${
                      tab === key ? "bg-main text-main-foreground shadow-button" : "bg-secondary-background"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" /> <span className="min-w-0">{label}</span>
                  </button>
                ))}
              </div>

              {tab === "fill" ? (
                <>
                  {roles.length > 0 && (
                    <label className={labelCls}>
                      Papel del cliente en el documento
                      <select className={fieldCls} value={role} onChange={(e) => setRole(e.target.value)}>
                        <option value="">Elegir…</option>
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {human(r)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="space-y-2 rounded-base border-2 border-dashed border-border p-3">
                    <p className="text-sm font-bold">✨ Llenar con IA</p>
                    <p className="text-xs text-foreground/60">
                      Adjunta fotos de cédulas u otros documentos, PDF o audios, o escribe lo que sepas. La IA completa los campos vacíos
                      {client ? " (y usa la ficha guardada del cliente)" : ""}; revisa antes de generar.
                    </p>
                    <label className={labelCls}>
                      Información (texto libre)
                      <textarea className={`${fieldCls} min-h-[70px]`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej. La compradora es María Gómez, soltera, cédula 001-…" />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <NeoButton type="button" size="sm" variant="neutral" onClick={() => fileInput.current?.click()}>
                        <Paperclip size={14} /> Adjuntar
                      </NeoButton>
                      <input
                        ref={fileInput}
                        type="file"
                        multiple
                        accept={ATTACH_ACCEPT}
                        aria-label="Adjuntos"
                        className="sr-only"
                        onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files || [])].slice(0, 5))}
                      />
                      {files.map((f, i) => (
                        <span key={i} className="flex max-w-[12rem] items-center gap-1 rounded-full border-2 border-border px-2 text-xs">
                          <span className="truncate">{f.name}</span>
                          <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <NeoButton type="button" size="sm" className="ml-auto" onClick={fillWithAI} disabled={busy === "ai" || (!text.trim() && !files.length)}>
                        <Sparkles size={14} /> {busy === "ai" ? "Leyendo…" : "Llenar con IA"}
                      </NeoButton>
                    </div>
                  </div>

                  <p className="text-xs text-foreground/60">
                    {exact
                      ? "Este modelo tiene etiquetas: cada dato va exactamente a su lugar."
                      : "Este modelo no tiene etiquetas: la IA colocará cada dato en el texto y te mostrará los cambios."}
                  </p>

                  {busy === "fields" && !fields.length ? (
                    <p className="text-sm text-foreground/60">Cargando los campos del documento…</p>
                  ) : (
                    groups.map(({ group, fields: gf }) => (
                      <fieldset key={group} className="rounded-base border-2 border-border p-3">
                        <legend className="px-1 text-sm font-black">
                          {human(group)}
                          {role === group && <span className="ml-2 rounded-full bg-main px-2 text-[10px] text-main-foreground">el cliente</span>}
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {gf.map((f) => (
                            <div key={f.key}>
                              <label htmlFor={`fld-${f.key}`} className={labelCls}>
                                {f.label}
                              </label>
                              <input
                                id={`fld-${f.key}`}
                                className={`${fieldCls} ${aiKeys.has(f.key) ? "border-main bg-main/5" : ""}`}
                                value={values[f.key] || ""}
                                onChange={(e) => {
                                  setValues((v) => ({ ...v, [f.key]: e.target.value }));
                                  setAiKeys((s) => {
                                    const n = new Set(s);
                                    n.delete(f.key);
                                    return n;
                                  });
                                }}
                              />
                              {aiKeys.has(f.key) && <span aria-hidden="true" className="text-[10px] font-bold text-main">✨ sugerido por la IA</span>}
                            </div>
                          ))}
                        </div>
                      </fieldset>
                    ))
                  )}

                  {!fromHistory && (
                    <label className={labelCls}>
                      Nombre del documento
                      <input className={fieldCls} value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
                    </label>
                  )}
                </>
              ) : (
                <>
                  {!fromHistory && (
                    <label className={labelCls}>
                      Nombre del documento
                      <input className={fieldCls} value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
                    </label>
                  )}
                  <label className={labelCls}>
                    ¿Qué cambios quieres?
                    <textarea
                      className={`${fieldCls} min-h-[120px]`}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Ej. En la cláusula tercera cambia el plazo a 24 meses y agrega una penalidad del 10% por atraso."
                    />
                  </label>
                  <p className="text-xs text-foreground/60">
                    La IA aplica solo esos cambios con redacción legal y el mismo estilo; se guarda como {fromHistory ? "una versión nueva" : "un documento nuevo"} (borrador) y verás qué cambió.
                  </p>
                </>
              )}

              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            </>
          )}
        </div>

        {!result && (
          <div className="flex flex-col-reverse gap-2 border-t-2 border-border bg-secondary-background px-4 py-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
            <NeoButton type="button" variant="neutral" onClick={onClose}>
              Cancelar
            </NeoButton>
            {tab === "fill" ? (
              <NeoButton type="button" onClick={generate} disabled={busy === "save" || !client}>
                {busy === "save" ? "Generando…" : "Generar documento"}
              </NeoButton>
            ) : (
              <NeoButton type="button" onClick={applyChanges} disabled={busy === "save" || !client || instructions.trim().length < 5}>
                {busy === "save" ? "Aplicando…" : "Aplicar cambios con IA"}
              </NeoButton>
            )}
          </div>
        )}
      </div>

      {preview && newest && (
        <PdfPreview title={`${result!.document.title} v${newest.version_number}`} pdfUrl={versionFileUrl(newest.id, "pdf", true)} onClose={() => setPreview(false)} />
      )}
    </div>
  );
}

function ResultView({
  result,
  clientName,
  onView,
  onClose,
}: {
  result: { document: PortfolioDocument; changes: Change[]; exact?: boolean };
  clientName?: string | null;
  onView: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-base border-2 border-border bg-green-100 p-3">
        <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
        <p className="text-sm">
          <b>Guardado como borrador</b> en el historial{clientName ? ` de ${clientName}` : ""}: «{result.document.title}».
          {result.exact ? " Se llenó exacto por etiquetas." : ""} Revísalo antes de pedir la aprobación.
        </p>
      </div>
      {result.changes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold">Qué cambió ({result.changes.length})</p>
          <ul className="space-y-2">
            {result.changes.map((c, k) => (
              <li key={k} className="rounded-base border-2 border-border p-2 text-sm">
                <span className="text-[10px] font-bold uppercase text-foreground/50">
                  {c.op === "insert_after" ? "Párrafo nuevo" : c.op === "delete" ? "Párrafo eliminado" : `Párrafo ${c.i + 1}`}
                </span>
                {c.before && <p className="text-red-700 line-through decoration-red-400">{c.before}</p>}
                {c.after && <p className="text-green-800">{c.after}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <NeoButton type="button" variant="neutral" onClick={onView}>
          <Eye size={16} /> Ver documento
        </NeoButton>
        <NeoButton type="button" onClick={onClose}>
          Listo
        </NeoButton>
      </div>
    </div>
  );
}
