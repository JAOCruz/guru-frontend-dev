import { Link, useSearchParams } from "react-router-dom";
import { FolderOpen, Search, Tags } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ModelSearch from "../components/documentos/ModelSearch";
import History from "../components/documentos/History";
import TagReview from "../components/documentos/TagReview";

// Documentos (Fase 1). Two parts, as Leandro described them:
//  · Buscar por nombre — our curated selection of models, used as-is (never saved to a history)
//  · Historial — each digitador's personalized documents per client, with versions
//  · Revisión de etiquetas (admin) — tagged copies of the models: AI tagging, review and approval
// Separate from MotherBrain (its tag names are only used as vocabulary).
export default function Documentos() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  type TabKey = "buscar" | "historial" | "etiquetas";
  const asked = params.get("tab");
  const tab: TabKey = asked === "historial" ? "historial" : asked === "etiquetas" && isAdmin ? "etiquetas" : "buscar";
  const setTab = (t: TabKey) => setParams(t === "buscar" ? {} : { tab: t }, { replace: true });

  const tabs = [
    { key: "buscar" as const, label: "Buscar por nombre", hint: "Nuestra selección de modelos", Icon: Search },
    { key: "historial" as const, label: isAdmin ? "Historial" : "Mi historial", hint: "Documentos personalizados por cliente", Icon: FolderOpen },
    ...(isAdmin ? [{ key: "etiquetas" as const, label: "Revisión de etiquetas", hint: "Etiquetar, revisar y aprobar modelos", Icon: Tags }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-black md:text-4xl">Documentos</h1>
          <p className="text-sm text-foreground/70">
            Busca un modelo de nuestra selección o trabaja los documentos personalizados de cada cliente.
          </p>
        </div>
        <Link to="/documents/anterior" className="text-xs font-semibold underline text-foreground/60 hover:text-foreground">
          Vista anterior
        </Link>
      </div>

      <div role="tablist" aria-label="Secciones de documentos" className={`grid min-w-0 gap-2 ${tabs.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {tabs.map(({ key, label, hint, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={`flex min-w-0 items-center gap-3 rounded-base border-2 border-border px-4 py-3 text-left transition-all ${
                active ? "bg-main text-main-foreground shadow-shadow" : "bg-secondary-background hover:-translate-y-0.5"
              }`}
            >
              <Icon size={22} className="shrink-0" />
              <span className="min-w-0">
                <span className="block font-heading text-lg font-black leading-tight">{label}</span>
                <span className={`block truncate text-xs ${active ? "opacity-80" : "text-foreground/60"}`}>{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {tab === "buscar" ? <ModelSearch /> : tab === "historial" ? <History /> : <TagReview />}
    </div>
  );
}
