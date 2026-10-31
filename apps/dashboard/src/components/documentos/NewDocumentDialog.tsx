import { useState } from "react";
import { Eye, FileText, Sparkles, Wand2, X } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { fieldCls, labelCls } from "../users/Modal";
import { ClientPicker } from "./UploadDialog";
import PdfPreview from "./PdfPreview";
import { documentosAPI, versionFileUrl, type HistoryClient, type PortfolioDocument } from "../../services/documentosApi";

export type NewDocKind = "ai" | "blank" | "model" | "upload";

interface Props {
  initialKind?: NewDocKind; // skip the first step
  initialClient?: HistoryClient | null;
  onClose: () => void;
  // "Desde un modelo" and "Subir archivo" are done elsewhere: the page takes over
  onPick: (kind: "model" | "upload") => void;
  onCreated: (doc: PortfolioDocument) => void;
  onOpen: (doc: PortfolioDocument) => void; // go to the draft in Mis documentos
  onEdit: (doc: PortfolioDocument) => void; // open Cambios específicos on the draft
}

const EXAMPLE = "Ej. Contrato de alquiler de un local comercial en Piantini por 2 años, RD$45,000 mensuales, con depósito de dos meses";
const errorOf = (err: any, fallback: string) => err?.response?.data?.error || fallback;

// Nuevo documento: the one entry point to create. "Desde cero" is a document that comes from no model —
// the AI drafts the whole Word from what the digitador asks for (missing data stays as {{ETIQUETAS}}, never
// invented); "En blanco" is an empty Word with the title. Both land as drafts in Mis documentos.
// The form is laid out as numbered steps: 1 Cliente · 2 Nombre · 3 ¿Qué necesitas? (AI only).
export default function NewDocumentDialog({ initialKind, initialClient, onClose, onPick, onCreated, onOpen, onEdit }: Props) {
  const [kind, setKind] = useState<NewDocKind | null>(initialKind ?? null);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState<HistoryClient | null>(initialClient ?? null);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ document: PortfolioDocument; placeholders: string[]; staff_placeholders: string[] } | null>(null);
  const [preview, setPreview] = useState(false);
  const [allTags, setAllTags] = useState(false);

  const choose = (k: NewDocKind) => {
    if (k === "model" || k === "upload") return onPick(k);
    setKind(k);
  };

  const create = async () => {
    const blank = kind === "blank";
    if (blank && !title.trim()) return setError("Ponle un nombre al documento");
    if (!blank && request.trim().length < 15) return setError("Cuenta qué documento necesitas, con un poco más de detalle");
    setBusy(true);
    setError(null);
    try {
      const { data } = await documentosAPI.createNew({
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(client ? { client_id: client.id } : {}),
        ...(blank ? { blank: true } : { request: request.trim() }),
      });
      setResult(data);
      onCreated(data.document);
    } catch (err) {
      setError(errorOf(err, blank ? "No se pudo crear el documento" : "La IA no respondió; intenta de nuevo"));
    } finally {
      setBusy(false);
    }
  };

  const newest = result?.document.versions?.[0];
  const heading = result ? "Borrador listo" : kind === "ai" ? "Crear desde cero" : kind === "blank" ? "Documento en blanco" : "Nuevo documento";
  const emoji = result ? "🎉" : kind === "ai" ? "🪄" : kind === "blank" ? "📄" : "✨";

  return (
    <div className="guru-os fixed inset-0 z-[80] flex items-stretch justify-center bg-black/70 p-0 md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label={heading}
        className="gos-dialog flex w-full max-w-2xl flex-col overflow-hidden md:max-h-[90vh] md:rounded-[2rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="gos-dialog-head">
          <span className="flex min-w-0 items-center gap-3">
            <span className="gos-badge text-2xl" aria-hidden="true">
              {emoji}
            </span>
            <span className="min-w-0">
              <span className="gos-subtitle block">Nuevo documento</span>
              <span className="gos-title block truncate font-heading text-base md:text-lg">{heading}</span>
            </span>
          </span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-xl border border-slate-700 bg-black p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          {result && newest ? (
            <div className="space-y-4">
              <div className="gos-callout-emerald flex items-start gap-3">
                <span aria-hidden="true" className="text-2xl leading-none">
                  ✅
                </span>
                <p className="text-sm">
                  <b className="text-emerald-300">Guardado como borrador</b> en Mis documentos{client ? ` (${client.name || "cliente"})` : " (Sin cliente)"}: «{result.document.title}».
                  {kind === "ai" ? " Revísalo antes de aprobarlo: la IA no inventa datos, los deja como etiquetas." : ""}
                </p>
              </div>
              {result.placeholders.length > 0 && (
                <div className="gos-callout-orange space-y-2">
                  <p className="gos-label-orange">
                    <span aria-hidden="true">⚠️</span> Faltan {result.placeholders.length} datos
                  </p>
                  <ul className="flex flex-wrap gap-1.5">
                    {(allTags ? result.placeholders : result.placeholders.slice(0, 12)).map((p) => (
                      <li key={p} className="gos-tag">
                        {`{{${p}}}`}
                      </li>
                    ))}
                    {!allTags && result.placeholders.length > 12 && (
                      <li>
                        <button type="button" onClick={() => setAllTags(true)} className="rounded-lg border-2 border-dashed border-orange-400/60 px-2 py-0.5 text-xs font-bold text-orange-200 underline">
                          y {result.placeholders.length - 12} más
                        </button>
                      </li>
                    )}
                  </ul>
                  <p className="text-xs text-orange-100/80">Complétalos con «Personalizar» en Mis documentos: con los datos del cliente o pidiendo cambios a la IA.</p>
                </div>
              )}
              {result.staff_placeholders?.length > 0 && (
                <p className="gos-muted text-xs" title={result.staff_placeholders.map((p) => `{{${p}}}`).join(", ")}>
                  Los llena el equipo: {result.staff_placeholders.length} (notario, fecha y ciudad de firma).
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <NeoButton type="button" variant="neutral" onClick={() => setPreview(true)}>
                  <Eye size={16} /> Ver documento
                </NeoButton>
                <NeoButton type="button" variant="neutral" onClick={() => onEdit(result.document)}>
                  <Wand2 size={16} /> Cambios específicos
                </NeoButton>
                <NeoButton type="button" onClick={() => onOpen(result.document)}>
                  Abrir en Mis documentos
                </NeoButton>
              </div>
            </div>
          ) : !kind ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["ai", "🪄", "Desde cero con IA", "Cuéntale qué necesitas y redacta el documento completo. Sin modelo."],
                  ["blank", "📄", "Documento en blanco", "Un Word vacío con el título, para escribirlo tú."],
                  ["model", "📚", "Desde un modelo", "Elige uno de la biblioteca y llénalo con los datos del cliente."],
                  ["upload", "📤", "Subir archivo", "Un Word o PDF que ya tienes, a Mis documentos."],
                ] as const
              ).map(([k, em, label, hint]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => choose(k)}
                  className={`gos-tile ${k === "ai" ? "gos-tile-hero sm:col-span-3 sm:flex-row sm:items-center" : ""}`}
                >
                  <span className="gos-emoji" aria-hidden="true">
                    {em}
                  </span>
                  <span className="min-w-0">
                    <span className={`gos-tile-label block ${k === "ai" ? "text-lg text-white" : ""}`}>{label}</span>
                    <span className={`gos-tile-hint block ${k === "ai" ? "text-sm text-blue-100/90" : ""}`}>{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <Step n={1} title="Cliente" hint="A quién pertenece el documento (opcional)">
                <ClientPicker client={client} onChange={setClient} optional />
              </Step>
              <Step n={2} title="Nombre" hint={kind === "blank" ? "Cómo se llamará el documento" : "Si lo dejas vacío, lo pone la IA"}>
                <label className={labelCls}>
                  {kind === "blank" ? "Nombre del documento" : "Nombre del documento (opcional)"}
                  <input
                    className={fieldCls}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={kind === "blank" ? "Ej. Carta de autorización" : "Si lo dejas vacío, lo pone la IA"}
                  />
                </label>
              </Step>
              {kind === "ai" && (
                <Step n={3} title="¿Qué necesitas?" hint="Tipo de documento, partes, objeto, montos y plazos">
                  <label className={labelCls}>
                    ¿Qué necesitas?
                    <textarea
                      className={`${fieldCls} min-h-32`}
                      value={request}
                      onChange={(e) => setRequest(e.target.value)}
                      placeholder={EXAMPLE}
                    />
                    <span className="gos-muted mt-1 block text-xs font-normal">
                      Pon el tipo de documento, las partes, el objeto, montos y plazos. Lo que no digas queda como etiqueta {"{{ASÍ}}"} para llenarlo después; la IA no inventa nombres ni cédulas.
                    </span>
                  </label>
                </Step>
              )}
              {error && (
                <p className="gos-callout-orange text-sm font-semibold">
                  <span aria-hidden="true">⚠️</span> {error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {!initialKind && (
                  <NeoButton type="button" variant="neutral" onClick={() => setKind(null)} disabled={busy}>
                    Volver
                  </NeoButton>
                )}
                <NeoButton type="button" onClick={create} disabled={busy} className="font-heading font-black uppercase tracking-wide">
                  {kind === "ai" ? <Sparkles size={16} /> : <FileText size={16} />}
                  {busy ? (kind === "ai" ? "Redactando…" : "Creando…") : kind === "ai" ? "Redactar con IA" : "Crear"}
                </NeoButton>
              </div>
            </>
          )}
        </div>
      </div>
      {preview && newest && result && (
        <PdfPreview title={`${result.document.title} v${newest.version_number}`} pdfUrl={versionFileUrl(newest.id, "pdf", true)} onClose={() => setPreview(false)} />
      )}
    </div>
  );
}

// One numbered step: blue square number with a hard shadow, title, and the field(s) under it
function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="gos-step gos-card p-3 md:p-4">
      <span className="gos-step-num" aria-hidden="true">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="gos-h font-heading text-sm">{title}</p>
          <p className="gos-muted text-xs">{hint}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
