import { useCallback, useEffect, useState } from "react";
import { FileText, Search, Sparkles, Tag } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { etiquetasAPI, STATUS_LABEL, type TagBatch, type TagStatus, type TagSummaryModel } from "../../services/etiquetasApi";
import { confirmDialog, notify } from "../../lib/dialogs";
import TagEditor from "./TagEditor";

// Admin: which models are tagged, reviewed and approved. Untagged models can be tagged by the AI
// (one or all in the background); pending ones are opened, fixed and approved in the editor.
const ORDER: TagStatus[] = ["untagged", "pending", "approved"];
const TONE: Record<TagStatus, string> = {
  untagged: "bg-foreground/10",
  pending: "bg-amber-200 text-amber-900",
  approved: "bg-green-200 text-green-900",
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function TagReview() {
  const [counts, setCounts] = useState<Record<TagStatus, number> | null>(null);
  const [models, setModels] = useState<TagSummaryModel[]>([]);
  const [batch, setBatch] = useState<TagBatch | null>(null);
  const [filter, setFilter] = useState<TagStatus | null>(null);
  const [q, setQ] = useState("");
  const [tagging, setTagging] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(
    () =>
      etiquetasAPI
        .summary()
        .then(({ data }) => {
          setCounts(data.counts);
          setModels(data.models);
          setBatch(data.batch);
        })
        .catch(() => notify("No se pudo cargar la revisión de etiquetas")),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  // while the batch runs, refresh every few seconds
  useEffect(() => {
    if (!batch?.running) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [batch?.running, load]);

  const untaggedReady = models.filter((m) => m.status === "untagged" && m.taggable).length;

  const startBatch = async () => {
    const ok = await confirmDialog(
      `La IA etiquetará ${untaggedReady} modelo(s), uno por uno (unos segundos cada uno). Quedarán «Pendiente de revisión» hasta que los apruebes. Puedes seguir trabajando mientras tanto.`,
      { title: "Etiquetar todos con IA", confirmLabel: "Empezar" },
    );
    if (!ok) return;
    try {
      const { data } = await etiquetasAPI.startBatch();
      setBatch(data.batch);
      load();
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudo iniciar");
    }
  };

  const aiTag = async (m: TagSummaryModel) => {
    setTagging(m.id);
    try {
      await etiquetasAPI.aiTag(m.id);
      load();
      setOpen(m.id);
    } catch (err: any) {
      notify(err?.response?.data?.error || "La IA no pudo etiquetar este modelo");
    } finally {
      setTagging(null);
    }
  };

  const list = models.filter((m) => (!filter || m.status === filter) && (!q.trim() || norm(`${m.name} ${m.category || ""}`).includes(norm(q.trim()))));

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {ORDER.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter((f) => (f === s ? null : s))}
            aria-pressed={filter === s}
            className={`rounded-base border-2 border-border px-3 py-2 text-left transition-all ${filter === s ? "shadow-shadow -translate-y-0.5" : ""} ${TONE[s]}`}
          >
            <span className="block text-xs font-bold">{STATUS_LABEL[s]}</span>
            <span className="block font-heading text-2xl font-black">{counts ? counts[s] : "…"}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-base border-2 border-border bg-secondary-background p-3 sm:flex-row sm:items-center sm:justify-between">
        {batch?.running ? (
          <p className="text-sm">
            <Sparkles size={14} className="mr-1 inline text-main" />
            Etiquetando con IA: <b>{batch.done} de {batch.total}</b>
            {batch.current && <span className="text-foreground/60"> · ahora: {batch.current}</span>}
          </p>
        ) : (
          <p className="text-sm text-foreground/70">
            {batch?.finished_at
              ? `Último etiquetado: ${batch.done} de ${batch.total}${batch.failed.length ? `, ${batch.failed.length} con error` : ""}.`
              : "La IA cambia los datos del caso anterior por etiquetas; tú revisas y apruebas cada modelo."}
          </p>
        )}
        <NeoButton type="button" onClick={startBatch} disabled={!!batch?.running || !untaggedReady}>
          <Sparkles size={15} /> Etiquetar todos con IA ({untaggedReady})
        </NeoButton>
      </div>
      {!batch?.running && batch?.failed?.length ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold">Ver los que fallaron</summary>
          <ul className="mt-1 list-disc pl-5">{batch.failed.map((f) => <li key={f.id}><b>{f.name}</b>: {f.error}</li>)}</ul>
        </details>
      ) : null}

      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar modelo"
          aria-label="Buscar modelo"
          className="w-full rounded-base border-2 border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-main"
        />
      </div>

      <ul className="divide-y-2 divide-border/15 overflow-hidden rounded-base border-2 border-border bg-background shadow-shadow">
        {list.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <FileText size={20} className="mt-0.5 shrink-0 text-main" />
              <div className="min-w-0">
                <p className="break-words text-sm font-bold">{m.name}</p>
                <p className="text-xs text-foreground/60">
                  {m.category || "Sin categoría"}
                  <span className={`ml-2 rounded-base border border-border px-1.5 py-px font-bold ${TONE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                  {m.latest_version && <span className="ml-1 font-semibold">v{m.latest_version}</span>}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {m.status === "untagged" ? (
                m.taggable ? (
                  <NeoButton size="sm" onClick={() => aiTag(m)} disabled={tagging !== null || !!batch?.running}>
                    <Sparkles size={14} /> {tagging === m.id ? "Etiquetando…" : "Etiquetar con IA"}
                  </NeoButton>
                ) : (
                  <span className="text-xs text-foreground/60" title="Solo hay un .doc antiguo o falta el archivo">Sin Word (.docx) para etiquetar</span>
                )
              ) : (
                <NeoButton size="sm" variant={m.status === "pending" ? "default" : "neutral"} onClick={() => setOpen(m.id)}>
                  <Tag size={14} /> Revisar
                </NeoButton>
              )}
            </div>
          </li>
        ))}
        {counts && !list.length && <p className="px-4 py-8 text-center text-sm text-foreground/60">No hay modelos con ese filtro.</p>}
      </ul>

      {open !== null && <TagEditor modelId={open} mode="review" onClose={() => setOpen(null)} onChanged={load} />}
    </section>
  );
}
