import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, FileDown, FileUp, MessageSquareWarning, PenLine, Search, Send, Sparkles, Tags, Trash2, UserPlus } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { documentosAPI, downloadFile, modelFileUrl, type Model } from "../../services/documentosApi";
import { confirmDialog, notify } from "../../lib/dialogs";
import PdfPreview from "./PdfPreview";
import PersonalizeDialog from "./PersonalizeDialog";
import TagEditor from "./TagEditor";
import { useAuth } from "../../context/AuthContext";
import { etiquetasAPI, STATUS_LABEL } from "../../services/etiquetasApi";
import UploadModelDialog from "./UploadModelDialog";
import ModelCard, { type ModelAction } from "./ModelCard";

// "Buscar por nombre": our curated selection of models. They are used as they are and are
// never saved to anyone's history; personalizing one is Generación (Fase 2).
export default function ModelSearch({ aiQuery = null }: { aiQuery?: string | null } = {}) {
  const [q, setQ] = useState(aiQuery || "");
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiResults, setAiResults] = useState<Model[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState<Model | null>(null);
  const [personalize, setPersonalize] = useState<Model | null>(null);
  const [saved, setSaved] = useState<{ client_id: number } | null>(null);
  const [fill, setFill] = useState<Model | null>(null);
  const [correct, setCorrect] = useState<Model | null>(null);
  const { isAdmin } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [review, setReview] = useState<number | null>(null); // a private model open in the tag editor
  const [busyId, setBusyId] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const refresh = () => setReload((n) => n + 1);
  // approved models are filled tag by tag; the admin can also try pending ones, and the owner their private ones
  const canFill = (m: Model) => m.tag_status === "approved" || ((isAdmin || (m.is_private && m.can_manage)) && m.tag_status === "pending");
  const managesPrivate = (m: Model) => Boolean(m.is_private && m.can_manage);
  const [, setParams] = useSearchParams();

  useEffect(() => {
    setAiResults(null);
    const t = setTimeout(() => {
      setLoading(true);
      documentosAPI
        .models(q.trim())
        .then(({ data }) => setModels(data.models))
        .catch(() => notify("No se pudieron cargar los modelos"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, reload]);

  const askAI = async (text = q) => {
    setAiLoading(true);
    try {
      const { data } = await documentosAPI.aiSearch(text.trim());
      setAiResults(data.models);
      if (!data.models.length) notify("La IA no encontró un modelo para eso; prueba con otras palabras", "info");
    } catch (err: any) {
      notify(err?.response?.data?.error || "La IA no respondió; intenta de nuevo");
    } finally {
      setAiLoading(false);
    }
  };

  // asked from the ⌘K search: same words, straight to the AI
  useEffect(() => {
    if (!aiQuery) return;
    setQ(aiQuery);
    askAI(aiQuery);
  }, [aiQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const download = (m: Model, format: "docx" | "pdf") =>
    downloadFile(modelFileUrl(m.id, format), `${m.name}.${format}`)?.catch?.((err: Error) => notify(err.message));

  const act = async (m: Model, action: () => Promise<unknown>, done: string, failed: string) => {
    setBusyId(m.id);
    try {
      await action();
      notify(done, "success");
      setAiResults(null);
      refresh();
    } catch (err: any) {
      notify(err?.response?.data?.error || failed);
    } finally {
      setBusyId(null);
    }
  };
  const tagWithAI = (m: Model) => act(m, () => etiquetasAPI.aiTag(m.id), `«${m.name}» ya tiene etiquetas`, "La IA no pudo etiquetarlo; intenta de nuevo");
  const requestPublish = (m: Model) =>
    act(m, () => etiquetasAPI.requestPublish(m.id), "Se pidió publicarlo: el admin lo revisará", "No se pudo pedir la publicación");
  const removeModel = async (m: Model) => {
    if (!(await confirmDialog(`¿Eliminar tu modelo «${m.name}»? Los documentos ya hechos con él no cambian.`, { title: "Eliminar modelo", confirmLabel: "Eliminar" }))) return;
    await act(m, () => etiquetasAPI.remove(m.id), "Modelo eliminado", "No se pudo eliminar");
  };

  const list = aiResults ?? models;
  const asCards = !aiResults && !q.trim(); // searching by name reads better as a list

  // every action a model offers here, in order; a card keeps the main one in view and the rest under «Más»
  const actionsFor = (m: Model): ModelAction[] => {
    const manages = managesPrivate(m);
    const busy = busyId === m.id;
    const all: (ModelAction | false)[] = [
      { key: "ver", label: "Ver", icon: <Eye size={14} />, onClick: () => setPreview(m) },
      { key: "word", label: "Word", icon: <FileDown size={14} />, onClick: () => download(m, "docx"), ariaLabel: `Descargar Word de ${m.name}` },
      { key: "pdf", label: "PDF", icon: <FileDown size={14} />, onClick: () => download(m, "pdf"), ariaLabel: `Descargar PDF de ${m.name}` },
      canFill(m) && { key: "llenar", label: "Llenar", icon: <PenLine size={14} />, onClick: () => setFill(m), highlight: true, title: "Llenar etiqueta por etiqueta, viendo el documento" },
      { key: "personalizar", label: "Personalizar", icon: <UserPlus size={14} />, onClick: () => setPersonalize(m), highlight: !canFill(m), title: "Llenarlo con los datos de un cliente o pedir cambios a la IA" },
      manages && m.tag_status === "untagged" && { key: "etiquetar", label: busy ? "Etiquetando…" : "Etiquetar con IA", icon: <Sparkles size={14} />, onClick: () => tagWithAI(m), highlight: true, disabled: busy },
      manages && m.tag_status !== "untagged" && { key: "etiquetas", label: "Editar etiquetas", icon: <Tags size={14} />, onClick: () => setReview(m.id) },
      manages && m.tag_status !== "untagged" && !m.publish_requested_at && { key: "publicar", label: "Pedir que se publique", icon: <Send size={14} />, onClick: () => requestPublish(m), disabled: busy, title: "Un admin lo revisa y, al publicarlo, lo usan todos" },
      manages && { key: "eliminar", label: "Eliminar", icon: <Trash2 size={14} />, onClick: () => removeModel(m), iconOnly: true, disabled: busy, ariaLabel: `Eliminar ${m.name}`, title: "Eliminar" },
      canFill(m) && !m.is_private && { key: "corregir", label: "Corregir", icon: <MessageSquareWarning size={14} />, onClick: () => setCorrect(m), title: "Señalar una parte que está mal o se puede mejorar" },
    ];
    return all.filter(Boolean) as ModelAction[];
  };

  const privateText = (m: Model) => `🔒 ${isAdmin && m.owner_name ? `Privado de ${m.owner_name}` : "Privado"}`;
  const badgeFor = (m: Model) =>
    m.is_private
      ? ({ text: privateText(m), tone: "private" } as const)
      : isAdmin && m.tag_status === "pending"
        ? ({ text: STATUS_LABEL.pending, tone: "pending" } as const)
        : m.most_used
          ? ({ text: "Más usado", tone: "used" } as const)
          : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && q.trim().length >= 3 && !models.length && askAI()}
            placeholder="Buscar modelo por nombre (ej. declaración jurada de ingresos)"
            aria-label="Buscar modelo"
            className="gos-input py-2.5 pl-10 pr-3"
          />
        </div>
        <NeoButton onClick={() => askAI()} disabled={q.trim().length < 3 || aiLoading} title="Describe lo que necesitas y la IA elige el modelo" className="font-heading font-black uppercase tracking-wide">
          <Sparkles size={16} /> {aiLoading ? "Buscando…" : "Buscar con IA"}
        </NeoButton>
        <NeoButton variant="neutral" onClick={() => setUploading(true)} title="Sube tu propio Word: solo tú y los admins lo verán" className="font-heading font-black uppercase tracking-wide">
          <FileUp size={16} /> Subir mi modelo
        </NeoButton>
      </div>

      <p className="gos-muted text-xs">
        {aiResults
          ? `La IA sugiere ${aiResults.length} modelo${aiResults.length === 1 ? "" : "s"} para "${q.trim()}".`
          : loading
            ? "Buscando…"
            : `${list.length} modelo${list.length === 1 ? "" : "s"}${q.trim() ? (list.length === 1 ? " coincide" : " coinciden") : ""}. ¿No aparece? Descríbelo y usa «Buscar con IA».`}
        {aiResults && (
          <button type="button" className="ml-2 font-semibold text-blue-400 underline" onClick={() => setAiResults(null)}>
            Ver búsqueda normal
          </button>
        )}
      </p>

      {asCards ? (
        <>
          <ul aria-label="Modelos" className="gos-model-grid">
            {list.map((m) => (
              <ModelCard
                key={m.id}
                model={m}
                badge={badgeFor(m)}
                actions={actionsFor(m)}
                onPreview={() => setPreview(m)}
                status={
                  <>
                    {m.is_private && m.publish_requested_at && <p className="gos-model-note text-amber-300">Publicación pedida</p>}
                    {m.is_private && m.tag_status === "untagged" && <p className="gos-model-note text-orange-300">{STATUS_LABEL.untagged}</p>}
                  </>
                }
              />
            ))}
          </ul>
          {!loading && !list.length && <p className="gos-panel gos-muted px-4 py-8 text-center text-sm">Todavía no hay modelos.</p>}
        </>
      ) : (
        <ul className="gos-panel gos-list overflow-hidden">
          {list.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 px-4 py-3 gos-md:flex-row gos-md:items-center gos-md:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3 gos-md:min-w-[16rem]">
                <span aria-hidden="true" className="gos-badge mt-0.5 shrink-0 text-xl">
                  📄
                </span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-white">{m.name}</p>
                  <p className="gos-muted text-[11px] font-bold uppercase tracking-wider">{m.category || "Sin categoría"}</p>
                  {m.is_private && (
                    <p className="mt-0.5 text-xs font-semibold text-amber-300">
                      {privateText(m)}
                      {m.publish_requested_at ? " · Publicación pedida" : ""}
                    </p>
                  )}
                  {(m.tag_status === "approved" || (m.is_private && m.tag_status === "pending")) && <p className="mt-0.5 text-xs font-semibold text-emerald-400">✓ Listo para llenar</p>}
                  {m.is_private && m.tag_status === "untagged" && <p className="mt-0.5 text-xs font-semibold text-orange-300">{STATUS_LABEL.untagged}</p>}
                  {isAdmin && !m.is_private && m.tag_status === "pending" && <p className="mt-0.5 text-xs font-semibold text-orange-300">{STATUS_LABEL.pending}</p>}
                  {m.reason && <p className="mt-1 text-xs font-semibold text-blue-300">✨ {m.reason}</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 gos-md:max-w-[62%] gos-md:justify-end">
                {actionsFor(m).map((a) => (
                  <NeoButton key={a.key} size="sm" variant={a.highlight ? "default" : "neutral"} onClick={a.onClick} disabled={a.disabled} title={a.title} aria-label={a.ariaLabel}>
                    {a.icon}
                    {!a.iconOnly && ` ${a.label}`}
                  </NeoButton>
                ))}
              </div>
            </li>
          ))}
          {!loading && !list.length && <li className="gos-muted px-4 py-8 text-center text-sm">No hay modelos con ese nombre.</li>}
        </ul>
      )}

      {uploading && (
        <UploadModelDialog
          onClose={() => setUploading(false)}
          onSaved={refresh}
          onDone={(model) => {
            setUploading(false);
            refresh();
            setReview(model.id); // the AI's tags are checked right away
          }}
        />
      )}

      {review !== null && <TagEditor modelId={review} mode="review" onClose={() => { setReview(null); refresh(); }} onChanged={refresh} />}

      {personalize && (
        <PersonalizeDialog
          source={{ model_id: personalize.id }}
          title={personalize.name}
          onSaved={(doc) => setSaved({ client_id: doc.client_id })}
          onClose={() => {
            setPersonalize(null);
            // after saving, go to that client's history
            if (saved) setParams({ tab: "historial", client: String(saved.client_id) });
          }}
        />
      )}

      {fill && (
        <TagEditor
          modelId={fill.id}
          mode="fill"
          onSaved={(doc) => setSaved({ client_id: doc.client_id })}
          onClose={() => {
            setFill(null);
            if (saved) setParams({ tab: "historial", client: String(saved.client_id) });
          }}
        />
      )}

      {correct && <TagEditor modelId={correct.id} mode="correct" onClose={() => setCorrect(null)} />}

      {preview && (
        <PdfPreview
          title={preview.name}
          pdfUrl={modelFileUrl(preview.id, "pdf", true)}
          onClose={() => setPreview(null)}
          onDownloadWord={() => download(preview, "docx")}
        />
      )}
    </section>
  );
}
