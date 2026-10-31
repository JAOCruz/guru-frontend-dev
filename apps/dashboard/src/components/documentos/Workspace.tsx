import { Sparkles } from "lucide-react";
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
const STAGES: { key: Stage; label: string; emoji: string; cls: string }[] = [
  { key: "borrador", label: "Borradores", emoji: "📝", cls: "" },
  { key: "aprobado", label: "Aprobados", emoji: "✅", cls: "gos-chip-emerald" },
  { key: "enviado", label: "Enviados", emoji: "📨", cls: "gos-chip-blue" },
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
      <section aria-label="Empezar" className="space-y-2">
        <p className="gos-label-blue">🚀 Empezar</p>
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <button type="button" onClick={() => onNew("ai")} className="gos-tile gos-tile-hero group">
            <span className="flex w-full items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="gos-label-blue flex items-center gap-1.5 !text-blue-200">
                  <Sparkles size={12} /> Sin modelo
                </span>
                <span className="mt-1 block font-heading text-xl font-black uppercase leading-tight tracking-wide text-white md:text-2xl">Crear documento desde cero</span>
                <span className="mt-1.5 block max-w-md text-sm font-medium text-blue-100/90">
                  Cuéntale a la IA qué necesitas (tipo de documento, partes, montos, plazos) y redacta el Word completo. Lo que falte queda como etiqueta; no inventa datos.
                </span>
              </span>
              <span className="gos-emoji shrink-0" aria-hidden="true">
                🪄
              </span>
            </span>
            <span className="gos-pill gos-pill-blue !border-black !px-4 !py-1.5 !text-sm group-hover:translate-x-0.5">
              <Sparkles size={14} /> Redactar con IA
            </span>
          </button>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
            {(
              [
                ["blank", "📄", "Documento en blanco", "Solo el título, para escribirlo tú"],
                ["model", "📚", "Desde un modelo", "Busca en la biblioteca y llénalo"],
                ["upload", "📤", "Subir archivo", "Word o PDF a Mis documentos"],
              ] as const
            ).map(([k, emoji, label, hint]) => (
              <button key={k} type="button" onClick={() => onNew(k)} className="gos-tile md:flex-row md:justify-start md:gap-4 md:px-5 md:py-3 md:text-left">
                <span className="gos-emoji !text-3xl md:!text-4xl" aria-hidden="true">
                  {emoji}
                </span>
                <span className="min-w-0">
                  <span className="gos-tile-label block leading-tight">{label}</span>
                  <span className="gos-tile-hint hidden md:block">{hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section aria-label="Estado de mis documentos" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map(({ key, label, emoji, cls }) => (
          <button key={key} type="button" onClick={onPipeline} className={`gos-chip ${cls}`}>
            <span aria-hidden="true" className="text-2xl leading-none">
              {emoji}
            </span>
            <span className="min-w-0">
              <span className="gos-chip-num block">{loading ? "…" : counts[key] || 0}</span>
              <span className="gos-chip-label block truncate">{label}</span>
            </span>
          </button>
        ))}
        <button type="button" onClick={onPipeline} className="gos-chip gos-chip-orange" title="Borradores que preparó el bot y esperan revisión">
          <span aria-hidden="true" className="text-2xl leading-none">
            🤖
          </span>
          <span className="min-w-0">
            <span className="gos-chip-num block">{loading ? "…" : bot}</span>
            <span className="gos-chip-label block truncate">Del bot por revisar</span>
          </span>
        </button>
      </section>

      {/* Recent + clients */}
      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="gos-panel">
          <div className="gos-panel-head">
            <h2 className="gos-h font-heading text-base">
              <span aria-hidden="true">🕘</span> Recientes
            </h2>
            <button type="button" onClick={onPipeline} className="gos-pill gos-pill-ghost hover:border-blue-500 hover:text-white">
              Ver todos
            </button>
          </div>
          <ul className="gos-list">
            {recent.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => onOpenDocument(d)} className="gos-row">
                  <span aria-hidden="true" className="text-xl leading-none">
                    📄
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{d.title}</span>
                    <span className="gos-muted block truncate text-xs">
                      {d.client_name || "Sin cliente"} · v{d.latest_version ?? d.versions_count} · {fmt(d.updated_at)}
                    </span>
                  </span>
                  <StageChip stage={stageOf(d)} version={d.approved_version} />
                </button>
              </li>
            ))}
            {!loading && !recent.length && <li className="gos-muted px-4 py-6 text-center text-sm">Aún no tienes documentos. Crea el primero arriba.</li>}
          </ul>
        </div>
        <div className="gos-panel">
          <div className="gos-panel-head">
            <h2 className="gos-h font-heading text-base">
              <span aria-hidden="true">👥</span> Por cliente
            </h2>
          </div>
          <ul className="gos-list">
            {clients.slice(0, 6).map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpenClient(c)} className="gos-row">
                  <span aria-hidden="true" className="text-xl leading-none">
                    👤
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{c.name || "Sin nombre"}</span>
                    <span className="gos-muted block truncate text-xs">{c.phone || ""}</span>
                  </span>
                  <span className="gos-count">{c.documents}</span>
                </button>
              </li>
            ))}
            {!clients.length && <li className="gos-muted px-4 py-6 text-center text-sm">Ningún cliente con documentos todavía.</li>}
          </ul>
        </div>
      </section>

      {/* Library */}
      <section id="biblioteca" className="space-y-3">
        <div>
          <h2 className="gos-h font-heading text-lg">
            <span aria-hidden="true">🗂️</span> Biblioteca de modelos
          </h2>
          <p className="gos-muted text-xs">Nuestra selección: se usan tal cual o se personalizan para un cliente.</p>
        </div>
        <ModelSearch aiQuery={aiQuery} />
      </section>
    </div>
  );
}

function StageChip({ stage, version }: { stage: Stage; version: number | null }) {
  if (stage === "enviado")
    return (
      <span className="gos-pill gos-pill-blue">
        <span aria-hidden="true">📨</span> Enviado
      </span>
    );
  if (stage === "aprobado")
    return (
      <span className="gos-pill gos-pill-emerald">
        <span aria-hidden="true">✅</span> v{version}
      </span>
    );
  return <span className="gos-pill gos-pill-ghost">Borrador</span>;
}
