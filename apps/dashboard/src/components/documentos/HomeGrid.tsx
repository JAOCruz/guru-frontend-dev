import type { PortfolioDocument } from "../../services/documentosApi";

export type ViewKey = "nuevo" | "historial" | "etiquetas" | "servicios" | "biblioteca";

interface Props {
  isAdmin: boolean;
  documents: PortfolioDocument[]; // everything in my scope, for the counters on «Mis documentos»
  loading: boolean;
  onOpen: (view: ViewKey) => void;
}

const stageOf = (d: PortfolioDocument) => (d.sent_at ? "enviado" : d.approved_version ? "aprobado" : "borrador");

// Home of Documentos: the bento grid of big emoji tiles (one per view), like the reference's Servicios grid.
export default function HomeGrid({ isAdmin, documents, loading, onOpen }: Props) {
  const n = (stage: string) => (loading ? "…" : documents.filter((d) => stageOf(d) === stage).length);
  const bot = loading ? "…" : documents.filter((d) => d.prepared_by_bot && !d.approved_version).length;

  const tiles: { key: ViewKey; emoji: string; label: string; hint: string; admin?: boolean }[] = [
    { key: "nuevo", emoji: "🪄", label: "Nuevo documento", hint: "Desde cero con IA, en blanco, desde un modelo o subir" },
    { key: "historial", emoji: "📂", label: "Mis documentos", hint: "Todos en una lista, con versiones: aprobar y enviar" },
    { key: "etiquetas", emoji: "🏷️", label: "Revisión de etiquetas", hint: "Etiquetar y aprobar modelos", admin: true },
    { key: "servicios", emoji: "🛠️", label: "Servicios", hint: "Guía interna: servicios y trámites" },
    { key: "biblioteca", emoji: "🔎", label: "Biblioteca de modelos", hint: "Buscar un modelo y llenarlo" },
  ];

  return (
    <nav aria-label="Menú de documentos" className="gos-grid">
      {tiles
        .filter((t) => !t.admin || isAdmin)
        .map((t) => (
          <button key={t.key} type="button" onClick={() => onOpen(t.key)} className="gos-tile-big group" title={t.hint}>
            <span className="gos-emoji" aria-hidden="true">
              {t.emoji}
            </span>
            <span className="gos-tile-label text-sm">{t.label}</span>
            {t.key === "historial" && (
              <span className="gos-tile-badges" aria-label="Estado de mis documentos">
                <span className="gos-mini">
                  <b>{n("borrador")}</b> Borradores
                </span>
                <span className="gos-mini gos-mini-emerald">
                  <b>{n("aprobado")}</b> Aprobados
                </span>
                <span className="gos-mini gos-mini-blue">
                  <b>{n("enviado")}</b> Enviados
                </span>
                <span className="gos-mini gos-mini-orange" title="Borradores que preparó el bot y esperan revisión">
                  <b>{bot}</b> Del bot
                </span>
              </span>
            )}
          </button>
        ))}
    </nav>
  );
}
