import { useState } from "react";
import { serviciosData, tramitesData, type Servicio } from "./serviciosData";

type SubTab = "pasos" | "costos" | "preguntas";
const SUB_TABS: { id: SubTab; icon: string; label: string }[] = [
  { id: "pasos", icon: "🛤️", label: "Fases" },
  { id: "costos", icon: "💸", label: "Dinero" },
  { id: "preguntas", icon: "🤔", label: "Filtro" },
];

// Guía interna para digitadores: the reference's Servicios (grid → detail) and Trámites (split view)
// with its data as is. No server involved.
export default function ServiciosView({ onContext }: { onContext?: (ctx: { tab: "servicios" | "tramites"; service?: Servicio | null; tramite?: string | null }) => void } = {}) {
  const [tab, setTabState] = useState<"servicios" | "tramites">("servicios");
  const [service, setServiceState] = useState<Servicio | null>(null);
  const [tramiteId, setTramiteIdState] = useState(tramitesData[0].id);
  const [subTab, setSubTab] = useState<SubTab>("pasos");
  const tramite = tramitesData.find((t) => t.id === tramiteId) ?? tramitesData[0];

  const setTab = (t: "servicios" | "tramites") => {
    setTabState(t);
    setServiceState(null);
    onContext?.({ tab: t, service: null, tramite: t === "tramites" ? tramite.title : null });
  };
  const setService = (s: Servicio | null) => {
    setServiceState(s);
    onContext?.({ tab: "servicios", service: s });
  };
  const setTramiteId = (id: string) => {
    setTramiteIdState(id);
    setSubTab("pasos");
    onContext?.({ tab: "tramites", tramite: tramitesData.find((t) => t.id === id)?.title });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="gos-callout-blue !py-2 text-xs font-bold">
          <span aria-hidden="true">📘</span> Guía interna para digitadores
        </p>
        <div role="tablist" aria-label="Servicios o trámites" className="gos-tabs">
          <button type="button" role="tab" aria-selected={tab === "servicios"} onClick={() => setTab("servicios")} className="gos-tab">
            <span aria-hidden="true">🛠️</span> Servicios
          </button>
          <button type="button" role="tab" aria-selected={tab === "tramites"} onClick={() => setTab("tramites")} className="gos-tab">
            <span aria-hidden="true">🗺️</span> Trámites
          </button>
        </div>
      </div>

      {tab === "servicios" && !service && (
        <div className="gos-grid" aria-label="Servicios">
          {serviciosData.map((svc) => (
            <button key={svc.id} type="button" onClick={() => setService(svc)} className="gos-tile-big group">
              <span className="gos-emoji" aria-hidden="true">
                {svc.emoji}
              </span>
              <span className="gos-tile-label text-sm">{svc.title}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "servicios" && service && (
        <section aria-label={service.title} className="overflow-hidden rounded-3xl border-2 border-slate-800 bg-[#0a0c14]">
          <div className="gos-view-head">
            <button type="button" onClick={() => setService(null)} className="gos-back">
              <span aria-hidden="true">←</span> Volver a servicios
            </button>
            <h3 className="gos-view-title font-heading">
              <span aria-hidden="true">{service.emoji}</span> {service.title}
            </h3>
          </div>
          <div className="grid gap-6 p-4 md:grid-cols-2 md:p-6">
            <div className="space-y-5">
              <div className="gos-callout-blue !p-5">
                <p className="text-base font-medium leading-relaxed text-blue-50">{service.desc}</p>
              </div>
              <div className="space-y-2">
                <h4 className="gos-label-emerald flex items-center gap-2 text-sm">
                  <span aria-hidden="true" className="text-lg">
                    ✅
                  </span>
                  ¿Qué entregamos?
                </h4>
                {service.incluye.map((inc, i) => (
                  <p key={i} className="gos-emerald-row">
                    {inc}
                  </p>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="gos-label-orange flex items-center gap-2 text-sm">
                <span aria-hidden="true" className="text-lg">
                  ⚠️
                </span>
                Reglas de oro
              </h4>
              {service.reglas.map((regla, i) => (
                <p key={i} className="gos-callout-orange">
                  {regla}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "tramites" && (
        <div className="grid gap-4 md:grid-cols-[17rem_1fr]">
          <aside className="gos-side flex min-w-0 flex-col p-2 md:p-3">
            <p className="px-2 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Catálogo oficial</p>
            <ul className="flex min-w-0 gap-1.5 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Trámites">
              {tramitesData.map((t) => (
                <li key={t.id} className="shrink-0 md:shrink">
                  <button type="button" aria-current={tramiteId === t.id} onClick={() => setTramiteId(t.id)} className="gos-side-item">
                    <span aria-hidden="true" className="text-xl leading-none">
                      {t.emoji}
                    </span>
                    <span className="truncate text-sm">{t.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="flex min-w-0 flex-col gap-4">
            <h3 className="flex items-center gap-3 font-heading text-2xl font-black text-white md:text-3xl">
              <span className="gos-emoji-box" aria-hidden="true">
                {tramite.emoji}
              </span>
              {tramite.title}
            </h3>
            <div>
              <div className="gos-folder-tabs" role="tablist" aria-label="Detalle del trámite">
                {SUB_TABS.map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={subTab === t.id} onClick={() => setSubTab(t.id)} className="gos-folder-tab flex-1 justify-center">
                    <span aria-hidden="true" className="text-base">
                      {t.icon}
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="gos-folder-panel">
                {subTab === "pasos" && (
                  <ol className="space-y-3">
                    {tramite.pasos.map((paso, i) => (
                      <li key={i} className="gos-step gos-card items-start p-4">
                        <span className="gos-step-num" aria-hidden="true">
                          {i + 1}
                        </span>
                        <p className="text-sm leading-relaxed text-slate-300 md:text-base">{paso.replace(/^\d+\.\s/, "")}</p>
                      </li>
                    ))}
                  </ol>
                )}
                {subTab === "costos" && (
                  <div className="gos-cost-table">
                    <div className="gos-cost-table-head">Tabla oficial de costos</div>
                    <ul>
                      {tramite.costos.map((c, i) => (
                        <li key={i} className="gos-cost-row">
                          <span>{c.item}</span>
                          <span className="gos-price">{c.p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {subTab === "preguntas" && (
                  <div className="space-y-3">
                    <p className="gos-banner-purple">
                      <span aria-hidden="true">⚠️</span> ¡Preguntas obligatorias al cliente!
                    </p>
                    {tramite.preguntas.map((q, i) => (
                      <p key={i} className="gos-callout-purple">
                        <span aria-hidden="true" className="text-2xl">
                          🤔
                        </span>
                        {q}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
