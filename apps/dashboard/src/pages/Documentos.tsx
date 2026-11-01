import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { documentosAPI, type HistoryClient, type Model, type PortfolioDocument } from "../services/documentosApi";
import { notify } from "../lib/dialogs";
import HomeGrid, { type ViewKey } from "../components/documentos/HomeGrid";
import FullView from "../components/documentos/FullView";
import History from "../components/documentos/History";
import TagReview from "../components/documentos/TagReview";
import ServiciosView from "../components/documentos/ServiciosView";
import ModelSearch from "../components/documentos/ModelSearch";
import CommandSearch from "../components/documentos/CommandSearch";
import { NewDocumentFlow, type NewDocKind } from "../components/documentos/NewDocumentDialog";
import UploadDialog from "../components/documentos/UploadDialog";
import PersonalizeDialog from "../components/documentos/PersonalizeDialog";
import OwlHelper from "../components/documentos/OwlHelper";
import "../components/documentos/guru-os.css";

// Documentos («Gurú OS»): a home grid of big emoji tiles, each opening a full view inside the bento container.
//  · Nuevo documento (?tab=nuevo) — desde cero con IA, en blanco, desde un modelo, subir; the steps run inline
//  · Mis documentos (?tab=historial&client=…&doc=…) — each digitador's documents per client, versions, approve, send
//  · Revisión de etiquetas (admin, ?tab=etiquetas&model=…) — tagged copies of the models
//  · Servicios (?tab=servicios) — guía interna: servicios y trámites
//  · Biblioteca de modelos (?tab=biblioteca) — search a model, fill or personalize it
//  · ⌘K / "/" — one search for models, my documents and clients (stays in the header)
// Old links keep working (notifications point to ?tab=historial / ?tab=etiquetas).
type TabKey = "inicio" | ViewKey;

const VIEWS: Record<ViewKey, { emoji: string; title: string }> = {
  nuevo: { emoji: "🪄", title: "Nuevo documento" },
  historial: { emoji: "📂", title: "Mis documentos" },
  etiquetas: { emoji: "🏷️", title: "Revisión de etiquetas" },
  servicios: { emoji: "🛠️", title: "Servicios" },
  biblioteca: { emoji: "🔎", title: "Biblioteca de modelos" },
};

export default function Documentos() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const tab: TabKey =
    asked === "historial" || asked === "nuevo" || asked === "servicios" || asked === "biblioteca" ? asked : asked === "etiquetas" && isAdmin ? "etiquetas" : "inicio";
  const setTab = (t: TabKey, extra: Record<string, string> = {}) => setParams(t === "inicio" ? {} : { tab: t, ...extra }, { replace: t === "inicio" || tab === t });

  const [documents, setDocuments] = useState<PortfolioDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(false);
  const [upload, setUpload] = useState(false);
  const [personalize, setPersonalize] = useState<{ model?: Model; doc?: PortfolioDocument } | null>(null);
  const [aiQuery, setAiQuery] = useState<string | null>(null);
  const [newHeading, setNewHeading] = useState<string | null>(null);
  const [serviceCtx, setServiceCtx] = useState<{ tab: "servicios" | "tramites"; service?: { title: string; emoji: string } | null; tramite?: string | null }>({ tab: "servicios" });

  // The section lays out by its own width, not the screen's: with the sidebar open a tablet leaves it phone-sized
  const desk = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = desk.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setWide(el.clientWidth >= 720);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    documentosAPI
      .documents({ sort: "recent" })
      .then((d) => setDocuments(d.data.documents))
      .catch(() => notify("No se pudieron cargar tus documentos"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(reload, [reload, tab]);

  // ⌘K / Ctrl+K or "/" (outside a field) opens the search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName || "") || (e.target as HTMLElement)?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openClient = (c: HistoryClient) => setParams({ tab: "historial", client: String(c.id) });
  const openDocument = (d: PortfolioDocument) => setParams({ tab: "historial", client: String(d.client_id ?? 0), doc: String(d.id) });
  const goHome = () => setTab("inicio");

  // "Desde un modelo" goes to the library; "Subir archivo" opens the upload flow
  const pick = (kind: NewDocKind) => {
    if (kind === "upload") return setUpload(true);
    if (kind === "model") return setTab("biblioteca");
  };

  const pending = documents.filter((d) => d.prepared_by_bot && !d.approved_version).length;
  const owlMessage = search
    ? "Escribe el nombre de un modelo, de un documento o de un cliente. Enter abre el primero."
    : tab === "nuevo"
      ? newHeading === "Borrador listo"
        ? "Tu borrador ya está en Mis documentos. Revísalo y completa las etiquetas antes de aprobarlo."
        : "Cuéntame qué documento necesitas: tipo, partes, montos y plazos. Lo que falte lo dejo como etiqueta."
      : tab === "historial"
        ? "Elige un cliente: aquí apruebas, envías y guardas versiones."
        : tab === "etiquetas"
          ? "Revisa las etiquetas de cada modelo y apruébalo para que todos lo llenen."
          : tab === "servicios"
            ? serviceCtx.service
              ? `${serviceCtx.service.emoji} ${serviceCtx.service.title}: mira las reglas de oro antes de cotizar.`
              : serviceCtx.tab === "tramites"
                ? `¡No olvides las preguntas clave de ${serviceCtx.tramite || "cada trámite"}!`
                : "Los 9 pilares de servicio. Toca uno para ver qué entregamos y sus reglas."
            : tab === "biblioteca"
              ? "Busca un modelo por nombre o describe lo que necesitas y la IA lo elige."
              : pending > 0
                ? `El bot preparó ${pending} borrador${pending === 1 ? "" : "es"} que esperan tu revisión en Mis documentos.`
                : "¡Hola! Soy Gurú. Toca una ficha para empezar.";

  const view = tab === "inicio" ? null : VIEWS[tab];
  const viewTitle = tab === "nuevo" && newHeading && newHeading !== "Nuevo documento" ? newHeading : view?.title;

  return (
    <div ref={desk} className={`guru-os gos-desk${wide ? " gos-md" : ""}`} data-view={tab === "inicio" ? "home" : "full"}>
      <div className="gos-app">
        <header className="gos-header">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 gos-md:px-6 gos-md:py-5">
            <button type="button" onClick={goHome} className="flex min-w-0 items-center gap-3 text-left" title="Volver al menú">
              <span className="gos-badge text-2xl gos-md:text-3xl" aria-hidden="true">
                🦉
              </span>
              <span className="min-w-0">
                <h1 className="gos-title font-heading text-xl gos-md:text-3xl">Documentos</h1>
                <span className="gos-subtitle mt-1 block text-[0.55rem] gos-md:text-[0.7rem]">Gurú OS · crea, personaliza, aprueba y envía</span>
              </span>
            </button>
            <div className="flex w-full items-center gap-3 gos-md:w-auto">
              <button
                type="button"
                onClick={() => setSearch(true)}
                className="gos-input flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-400 hover:border-blue-500 gos-md:w-72"
                aria-label="Buscar modelos, documentos y clientes"
              >
                <Search size={16} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">Buscar modelo, documento o cliente…</span>
                <kbd className="hidden rounded border px-1.5 text-[10px] font-bold gos-md:inline">⌘K</kbd>
              </button>
              <Link to="/documents/anterior" className="hidden shrink-0 text-xs font-semibold text-slate-500 underline hover:text-slate-200 gos-md:inline">
                Vista anterior
              </Link>
            </div>
          </div>
        </header>

        <OwlHelper message={owlMessage} />

        {tab === "inicio" ? (
          <div className="min-w-0 p-4 gos-md:p-6">
            <HomeGrid isAdmin={isAdmin} documents={documents} loading={loading} onOpen={(v) => setTab(v)} />
          </div>
        ) : (
          <FullView
            emoji={view!.emoji}
            title={viewTitle!}
            onBack={goHome}
            actions={
              <button type="button" onClick={() => setSearch(true)} aria-label="Abrir la búsqueda" className="gos-back gos-phone-only">
                <Search size={18} />
              </button>
            }
          >
            {tab === "nuevo" ? (
              <NewDocumentFlow
                key="nuevo"
                onPick={pick}
                onCreated={reload}
                onOpen={openDocument}
                onEdit={(d) => setPersonalize({ doc: d })}
                onHeading={setNewHeading}
              />
            ) : tab === "historial" ? (
              <History key={`${params.get("client")}-${params.get("doc")}`} />
            ) : tab === "etiquetas" ? (
              <TagReview key={params.get("model") || "list"} initialModel={Number(params.get("model")) || null} />
            ) : tab === "servicios" ? (
              <ServiciosView onContext={setServiceCtx} />
            ) : (
              <ModelSearch aiQuery={aiQuery} />
            )}
          </FullView>
        )}
      </div>

      {search && (
        <CommandSearch
          documents={documents}
          onClose={() => setSearch(false)}
          onModel={(m) => {
            setSearch(false);
            setPersonalize({ model: m });
          }}
          onDocument={(d) => {
            setSearch(false);
            openDocument(d);
          }}
          onClient={(c) => {
            setSearch(false);
            openClient(c);
          }}
          onAskAI={(q) => {
            setSearch(false);
            setAiQuery(q);
            setTab("biblioteca");
          }}
        />
      )}
      {upload && (
        <UploadDialog
          onClose={() => setUpload(false)}
          onDone={(d) => {
            setUpload(false);
            notify("Documento subido", "success");
            reload();
            openDocument(d);
          }}
        />
      )}
      {personalize?.model && (
        <PersonalizeDialog source={{ model_id: personalize.model.id }} title={personalize.model.name} onSaved={reload} onClose={() => setPersonalize(null)} />
      )}
      {personalize?.doc?.versions?.[0] && (
        <PersonalizeDialog
          source={{ version_id: personalize.doc.versions[0].id }}
          title={`${personalize.doc.title} v${personalize.doc.versions[0].version_number}`}
          fixedClient={personalize.doc.client_id ? { id: personalize.doc.client_id, name: personalize.doc.client_name, phone: null } : undefined}
          onSaved={reload}
          onClose={() => setPersonalize(null)}
        />
      )}
    </div>
  );
}
