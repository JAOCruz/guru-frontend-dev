import { Bot, CheckCircle2, FileText, FolderOpen, Send, Sparkles, Upload, User } from "lucide-react";
import { NeoButton } from "@guru/ui";
import type { HistoryClient, PortfolioDocument } from "../../services/documentosApi";
import type { NewDocKind } from "./NewDocumentDialog";
import ModelSearch from "./ModelSearch";

const fmt = (d: string) => new Date(d).toLocaleDateString("es-DO", { day: "numeric", month: "short" });

interface Props {
  documents: PortfolioDocument[]; // everything in my scope, newest first
  clients: HistoryClient[]; // clients with documents, by last activity
  loading: boolean;
  onNew: (kind: NewDocKind) => void;
  onOpenDocument: (d: PortfolioDocument) => void;
  onOpenClient: (c: HistoryClient) => void;
  onPipeline: () => void; // go to Mis documentos
  aiQuery?: string | null; // "Buscar con IA" asked from the ⌘K search
}

type Stage = "borrador" | "aprobado" | "enviado";
const stageOf = (d: PortfolioDocument): Stage => (d.sent_at ? "enviado" : d.approved_version ? "aprobado" : "borrador");
const STAGES: { key: Stage; label: string; Icon: typeof FileText; cls: string }[] = [
  { key: "borrador", label: "Borradores", Icon: FileText, cls: "bg-background" },
  { key: "aprobado", label: "Aprobados", Icon: CheckCircle2, cls: "bg-green-100" },
  { key: "enviado", label: "Enviados", Icon: Send, cls: "bg-main/15" },
];

// Inicio of Documentos: what the digitador does most, on one screen — create (from zero, blank, from a
// model, upload), see the work in progress (pipeline + recent drafts + clients) and the model library.
export default function Workspace({ documents, clients, loading, onNew, onOpenDocument, onOpenClient, onPipeline, aiQuery }: Props) {
  const counts = documents.reduce((acc, d) => ({ ...acc, [stageOf(d)]: (acc[stageOf(d)] || 0) + 1 }), {} as Record<Stage, number>);
  const bot = documents.filter((d) => d.prepared_by_bot && !d.approved_version).length;
  const recent = documents.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Create */}
      <section className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <button
          type="button"
          onClick={() => onNew("ai")}
          className="group flex flex-col justify-between gap-3 rounded-base border-2 border-border bg-main p-4 text-left text-main-foreground shadow-shadow transition-transform hover:-translate-y-0.5"
        >
          <span>
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide opacity-80">
              <Sparkles size={14} /> Sin modelo
            </span>
            <span className="mt-1 block font-heading text-2xl font-black leading-tight">Crear documento desde cero</span>
            <span className="mt-1.5 block max-w-lg text-sm opacity-90">
              Cuéntale a la IA qué necesitas (tipo de documento, partes, montos, plazos) y redacta el Word completo. Lo que falte queda como etiqueta; no inventa datos.
            </span>
          </span>
          <span className="inline-flex w-fit items-center gap-2 rounded-base border-2 border-border bg-background px-4 py-1.5 font-heading text-base font-black text-foreground shadow-shadow group-hover:translate-x-0.5">
            <Sparkles size={16} /> Redactar con IA
          </span>
        </button>
        <div className="grid gap-2">
          {(
            [
              ["blank", FileText, "Documento en blanco", "Solo el título, para escribirlo tú"],
              ["model", FolderOpen, "Desde un modelo", "Busca en la biblioteca y llénalo"],
              ["upload", Upload, "Subir archivo", "Word o PDF a Mis documentos"],
            ] as const
          ).map(([k, Icon, label, hint]) => (
            <button
              key={k}
              type="button"
              onClick={() => onNew(k)}
              className="flex items-center gap-3 rounded-base border-2 border-border bg-secondary-background px-4 py-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-shadow"
            >
              <Icon size={20} className="shrink-0 text-main" />
              <span className="min-w-0">
                <span className="block font-heading text-base font-black leading-tight">{label}</span>
                <span className="block truncate text-xs text-foreground/60">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section aria-label="Estado de mis documentos" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map(({ key, label, Icon, cls }) => (
          <button key={key} type="button" onClick={onPipeline} className={`flex min-w-0 flex-col items-start gap-0.5 rounded-base border-2 border-border px-3 py-2 text-left sm:flex-row sm:items-center sm:gap-3 ${cls} hover:-translate-y-0.5`}>
            <span className="font-heading text-2xl font-black leading-none">{loading ? "…" : counts[key] || 0}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold sm:truncate sm:text-sm">
              <Icon size={16} className="shrink-0" /> {label}
            </span>
          </button>
        ))}
        <button type="button" onClick={onPipeline} className="flex min-w-0 flex-col items-start gap-0.5 rounded-base border-2 border-border bg-amber-50 px-3 py-2 text-left hover:-translate-y-0.5 sm:flex-row sm:items-center sm:gap-3" title="Borradores que preparó el bot y esperan revisión">
          <span className="font-heading text-2xl font-black leading-none">{loading ? "…" : bot}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold sm:truncate sm:text-sm">
            <Bot size={16} className="shrink-0" /> Del bot
          </span>
        </button>
      </section>

      {/* Recent + clients */}
      <section className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 rounded-base border-2 border-border bg-background shadow-shadow">
          <div className="flex items-center justify-between border-b-2 border-border px-4 py-2">
            <h2 className="font-heading text-lg font-black">Recientes</h2>
            <NeoButton size="sm" variant="neutral" onClick={onPipeline}>
              Ver todos
            </NeoButton>
          </div>
          <ul className="divide-y-2 divide-border/15">
            {recent.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => onOpenDocument(d)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-main/5">
                  <FileText size={18} className="shrink-0 text-main" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{d.title}</span>
                    <span className="block truncate text-xs text-foreground/60">
                      {d.client_name || "Sin cliente"} · v{d.latest_version ?? d.versions_count} · {fmt(d.updated_at)}
                    </span>
                  </span>
                  <StageChip stage={stageOf(d)} version={d.approved_version} />
                </button>
              </li>
            ))}
            {!loading && !recent.length && <li className="px-4 py-6 text-center text-sm text-foreground/60">Aún no tienes documentos. Crea el primero arriba.</li>}
          </ul>
        </div>
        <div className="min-w-0 rounded-base border-2 border-border bg-background shadow-shadow">
          <div className="border-b-2 border-border px-4 py-2">
            <h2 className="font-heading text-lg font-black">Por cliente</h2>
          </div>
          <ul className="divide-y-2 divide-border/15">
            {clients.slice(0, 6).map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpenClient(c)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-main/5">
                  <User size={18} className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{c.name || "Sin nombre"}</span>
                    <span className="block truncate text-xs text-foreground/60">{c.phone || ""}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-foreground/10 px-2 text-xs font-bold">{c.documents}</span>
                </button>
              </li>
            ))}
            {!clients.length && <li className="px-4 py-6 text-center text-sm text-foreground/60">Ningún cliente con documentos todavía.</li>}
          </ul>
        </div>
      </section>

      {/* Library */}
      <section id="biblioteca" className="space-y-2">
        <div>
          <h2 className="font-heading text-xl font-black">Biblioteca de modelos</h2>
          <p className="text-xs text-foreground/60">Nuestra selección: se usan tal cual o se personalizan para un cliente.</p>
        </div>
        <ModelSearch aiQuery={aiQuery} />
      </section>
    </div>
  );
}

function StageChip({ stage, version }: { stage: Stage; version: number | null }) {
  if (stage === "enviado")
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full border-2 border-border bg-main/20 px-2 text-xs font-bold">
        <Send size={12} /> Enviado
      </span>
    );
  if (stage === "aprobado")
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full border-2 border-border bg-green-100 px-2 text-xs font-bold">
        <CheckCircle2 size={12} /> v{version}
      </span>
    );
  return <span className="shrink-0 rounded-full border-2 border-border/40 px-2 text-xs font-bold text-foreground/70">Borrador</span>;
}
