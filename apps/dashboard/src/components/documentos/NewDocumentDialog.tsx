import { useState } from "react";
import { CheckCircle2, Eye, FileText, FileUp, Sparkles, Upload, Wand2, X } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 p-0 md:items-center md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label={heading}
        className="flex w-full max-w-2xl flex-col overflow-hidden border-2 border-border bg-background shadow-shadow md:max-h-[90vh] md:rounded-base"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-border bg-main px-4 py-3 text-main-foreground">
          <span className="min-w-0">
            <span className="block text-xs font-bold uppercase opacity-80">Nuevo documento</span>
            <span className="block truncate font-heading text-lg font-black">{heading}</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-base p-1 hover:bg-black/10">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {result && newest ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-base border-2 border-border bg-green-100 p-3">
                <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
                <p className="text-sm">
                  <b>Guardado como borrador</b> en Mis documentos{client ? ` (${client.name || "cliente"})` : " (Sin cliente)"}: «{result.document.title}».
                  {kind === "ai" ? " Revísalo antes de aprobarlo: la IA no inventa datos, los deja como etiquetas." : ""}
                </p>
              </div>
              {result.placeholders.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-bold">Faltan {result.placeholders.length} datos</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {(allTags ? result.placeholders : result.placeholders.slice(0, 12)).map((p) => (
                      <li key={p} className="rounded-full border-2 border-border bg-amber-50 px-2 py-0.5 font-mono text-xs font-bold">
                        {`{{${p}}}`}
                      </li>
                    ))}
                    {!allTags && result.placeholders.length > 12 && (
                      <li>
                        <button type="button" onClick={() => setAllTags(true)} className="rounded-full border-2 border-dashed border-border px-2 py-0.5 text-xs font-bold underline">
                          y {result.placeholders.length - 12} más
                        </button>
                      </li>
                    )}
                  </ul>
                  <p className="mt-2 text-xs text-foreground/60">Complétalos con «Personalizar» en Mis documentos: con los datos del cliente o pidiendo cambios a la IA.</p>
                </div>
              )}
              {result.staff_placeholders?.length > 0 && (
                <p className="text-xs text-foreground/60" title={result.staff_placeholders.map((p) => `{{${p}}}`).join(", ")}>
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
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["ai", Sparkles, "Desde cero con IA", "Cuéntale qué necesitas y redacta el documento completo. Sin modelo."],
                  ["blank", FileText, "Documento en blanco", "Un Word vacío con el título, para escribirlo tú."],
                  ["model", FileUp, "Desde un modelo", "Elige uno de la biblioteca y llénalo con los datos del cliente."],
                  ["upload", Upload, "Subir archivo", "Un Word o PDF que ya tienes, a Mis documentos."],
                ] as const
              ).map(([k, Icon, label, hint]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => choose(k)}
                  className={`flex items-start gap-3 rounded-base border-2 border-border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-shadow ${
                    k === "ai" ? "bg-main text-main-foreground sm:col-span-2" : "bg-secondary-background"
                  }`}
                >
                  <Icon size={22} className="mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-heading text-lg font-black leading-tight">{label}</span>
                    <span className={`block text-xs ${k === "ai" ? "opacity-80" : "text-foreground/60"}`}>{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <ClientPicker client={client} onChange={setClient} optional />
              <label className={labelCls}>
                {kind === "blank" ? "Nombre del documento" : "Nombre del documento (opcional)"}
                <input
                  className={fieldCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={kind === "blank" ? "Ej. Carta de autorización" : "Si lo dejas vacío, lo pone la IA"}
                />
              </label>
              {kind === "ai" && (
                <label className={labelCls}>
                  ¿Qué necesitas?
                  <textarea
                    className={`${fieldCls} min-h-32`}
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    placeholder={EXAMPLE}
                  />
                  <span className="mt-1 block text-xs font-normal text-foreground/60">
                    Pon el tipo de documento, las partes, el objeto, montos y plazos. Lo que no digas queda como etiqueta {"{{ASÍ}}"} para llenarlo después; la IA no inventa nombres ni cédulas.
                  </span>
                </label>
              )}
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                {!initialKind && (
                  <NeoButton type="button" variant="neutral" onClick={() => setKind(null)} disabled={busy}>
                    Volver
                  </NeoButton>
                )}
                <NeoButton type="button" onClick={create} disabled={busy}>
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
