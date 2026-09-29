import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, FileDown, FileText, Search, Sparkles, UserPlus } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { documentosAPI, downloadFile, modelFileUrl, type Model } from "../../services/documentosApi";
import { notify } from "../../lib/dialogs";
import PdfPreview from "./PdfPreview";
import PersonalizeDialog from "./PersonalizeDialog";

// "Buscar por nombre": our curated selection of models. They are used as they are and are
// never saved to anyone's history; personalizing one is Generación (Fase 2).
export default function ModelSearch() {
  const [q, setQ] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiResults, setAiResults] = useState<Model[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [preview, setPreview] = useState<Model | null>(null);
  const [personalize, setPersonalize] = useState<Model | null>(null);
  const [saved, setSaved] = useState<{ client_id: number } | null>(null);
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
  }, [q]);

  const askAI = async () => {
    setAiLoading(true);
    try {
      const { data } = await documentosAPI.aiSearch(q.trim());
      setAiResults(data.models);
      if (!data.models.length) notify("La IA no encontró un modelo para eso; prueba con otras palabras", "info");
    } catch (err: any) {
      notify(err?.response?.data?.error || "La IA no respondió; intenta de nuevo");
    } finally {
      setAiLoading(false);
    }
  };

  const download = (m: Model, format: "docx" | "pdf") =>
    downloadFile(modelFileUrl(m.id, format), `${m.name}.${format}`)?.catch?.((err: Error) => notify(err.message));

  const list = aiResults ?? models;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && q.trim().length >= 3 && !models.length && askAI()}
            placeholder="Buscar modelo por nombre (ej. declaración jurada de ingresos)"
            aria-label="Buscar modelo"
            className="w-full rounded-base border-2 border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-main"
          />
        </div>
        <NeoButton onClick={askAI} disabled={q.trim().length < 3 || aiLoading} title="Describe lo que necesitas y la IA elige el modelo">
          <Sparkles size={16} /> {aiLoading ? "Buscando…" : "Buscar con IA"}
        </NeoButton>
      </div>

      <p className="text-xs text-foreground/60">
        {aiResults
          ? `La IA sugiere ${aiResults.length} modelo${aiResults.length === 1 ? "" : "s"} para "${q.trim()}".`
          : loading
            ? "Buscando…"
            : `${list.length} modelo${list.length === 1 ? "" : "s"} de nuestra selección${q.trim() ? " coinciden" : ""}. ¿No aparece? Descríbelo y usa «Buscar con IA».`}
        {aiResults && (
          <button type="button" className="ml-2 font-semibold underline" onClick={() => setAiResults(null)}>
            Ver búsqueda normal
          </button>
        )}
      </p>

      <ul className="divide-y-2 divide-border/15 overflow-hidden rounded-base border-2 border-border bg-background shadow-shadow">
        {list.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <FileText size={20} className="mt-0.5 shrink-0 text-main" />
              <div className="min-w-0">
                <p className="break-words text-sm font-bold">{m.name}</p>
                <p className="text-xs text-foreground/60">{m.category || "Sin categoría"}</p>
                {m.reason && <p className="mt-1 text-xs font-semibold text-main">✨ {m.reason}</p>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5 md:justify-end">
              <NeoButton size="sm" variant="neutral" onClick={() => setPreview(m)}>
                <Eye size={14} /> Ver
              </NeoButton>
              <NeoButton size="sm" variant="neutral" onClick={() => download(m, "docx")} aria-label={`Descargar Word de ${m.name}`}>
                <FileDown size={14} /> Word
              </NeoButton>
              <NeoButton size="sm" variant="neutral" onClick={() => download(m, "pdf")} aria-label={`Descargar PDF de ${m.name}`}>
                <FileDown size={14} /> PDF
              </NeoButton>
              <NeoButton size="sm" onClick={() => setPersonalize(m)} title="Llenarlo con los datos de un cliente o pedir cambios a la IA">
                <UserPlus size={14} /> Personalizar
              </NeoButton>
            </div>
          </li>
        ))}
        {!loading && !list.length && <li className="px-4 py-8 text-center text-sm text-foreground/60">No hay modelos con ese nombre.</li>}
      </ul>

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
