import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { useAuth } from "../context/AuthContext";
import { documentosAPI, type HistoryClient, type Model, type PortfolioDocument } from "../services/documentosApi";
import { notify } from "../lib/dialogs";
import Workspace from "../components/documentos/Workspace";
import History from "../components/documentos/History";
import TagReview from "../components/documentos/TagReview";
import CommandSearch from "../components/documentos/CommandSearch";
import NewDocumentDialog, { type NewDocKind } from "../components/documentos/NewDocumentDialog";
import UploadDialog from "../components/documentos/UploadDialog";
import PersonalizeDialog from "../components/documentos/PersonalizeDialog";
import OwlHelper from "../components/documentos/OwlHelper";
import "../components/documentos/guru-os.css";

// Documentos (remake): one workspace instead of three tabs.
//  · Inicio — create (desde cero con IA, en blanco, desde un modelo, subir), the pipeline of my documents
//    (borradores → aprobados → enviados), recientes, por cliente and the model library
//  · Mis documentos (tab "historial") — each digitador's documents per client, with versions, approve and send
//  · Revisión de etiquetas (admin, tab "etiquetas") — tagged copies of the models
//  · ⌘K / "/" — one search for models, my documents and clients
// Old links keep working: ?tab=historial&client=… and ?tab=etiquetas&model=… (notifications point there).
// Look: "Gurú OS" — a dark bento app container with emoji tiles (styles in components/documentos/guru-os.css).
export default function Documentos() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  type TabKey = "inicio" | "historial" | "etiquetas";
  const asked = params.get("tab");
  const tab: TabKey = asked === "historial" ? "historial" : asked === "etiquetas" && isAdmin ? "etiquetas" : "inicio";
  const setTab = (t: TabKey) => setParams(t === "inicio" ? {} : { tab: t }, { replace: true });

  const [documents, setDocuments] = useState<PortfolioDocument[]>([]);
  const [clients, setClients] = useState<HistoryClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(false);
  const [creating, setCreating] = useState<{ kind?: NewDocKind } | null>(null);
  const [upload, setUpload] = useState(false);
  const [personalize, setPersonalize] = useState<{ model?: Model; doc?: PortfolioDocument } | null>(null);
  const [aiQuery, setAiQuery] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([documentosAPI.documents({ sort: "recent" }), documentosAPI.clients()])
      .then(([d, c]) => {
        setDocuments(d.data.documents);
        setClients(c.data.clients);
      })
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

  const startNew = (kind: NewDocKind) => {
    if (kind === "upload") return setUpload(true);
    if (kind === "model") {
      setTab("inicio");
      document.getElementById("biblioteca")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setCreating({ kind });
  };

  const tabs = [
    { key: "inicio" as const, label: "Inicio", hint: "Crear, en curso y biblioteca", emoji: "🏠" },
    { key: "historial" as const, label: "Mis documentos", hint: "Por cliente, con versiones", emoji: "🗂️" },
    ...(isAdmin ? [{ key: "etiquetas" as const, label: "Revisión de etiquetas", hint: "Etiquetar y aprobar modelos", emoji: "🏷️" }] : []),
  ];

  const pending = documents.filter((d) => d.prepared_by_bot && !d.approved_version).length;
  const owlMessage = creating
    ? "Cuéntame qué documento necesitas: tipo, partes, montos y plazos. Lo que falte lo dejo como etiqueta."
    : search
      ? "Escribe el nombre de un modelo, de un documento o de un cliente. Enter abre el primero."
      : tab === "historial"
        ? "Elige un cliente: aquí apruebas, envías y guardas versiones."
        : tab === "etiquetas"
          ? "Revisa las etiquetas de cada modelo y apruébalo para que todos lo llenen."
          : pending > 0
            ? `El bot preparó ${pending} borrador${pending === 1 ? "" : "es"} que esperan tu revisión.`
            : "¡Hola! Crea un documento desde cero con la IA o busca un modelo en la biblioteca.";

  return (
    <div className="guru-os gos-desk">
      <div className="gos-app">
        <header className="gos-header">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-6 md:pt-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="gos-badge text-2xl md:text-3xl" aria-hidden="true">
                🦉
              </span>
              <div className="min-w-0">
                <h1 className="gos-title font-heading text-2xl md:text-3xl">Documentos</h1>
                <p className="gos-subtitle mt-1">Crea, personaliza, aprueba y envía los documentos de cada cliente.</p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setSearch(true)}
                className="gos-input flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-400 hover:border-blue-500 sm:w-72"
                aria-label="Buscar modelos, documentos y clientes"
              >
                <Search size={16} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">Buscar modelo, documento o cliente…</span>
                <kbd className="hidden rounded border px-1.5 text-[10px] font-bold sm:inline">⌘K</kbd>
              </button>
              <NeoButton onClick={() => setCreating({})} className="w-full shrink-0 font-heading font-black uppercase tracking-wide sm:w-auto">
                <Plus size={18} /> Nuevo documento
              </NeoButton>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-3 md:px-6 md:pb-5">
            <nav role="tablist" aria-label="Secciones de documentos" className="gos-tabs min-w-0">
              {tabs.map(({ key, label, hint, emoji }) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} title={hint} onClick={() => setTab(key)} className="gos-tab">
                  <span aria-hidden="true">{emoji}</span> {label}
                </button>
              ))}
            </nav>
            <Link to="/documents/anterior" className="ml-auto text-xs font-semibold text-slate-500 underline hover:text-slate-200">
              Vista anterior
            </Link>
          </div>
        </header>

        <OwlHelper message={owlMessage} />

        <div className="min-w-0 p-4 md:p-6">
          {tab === "inicio" ? (
            <Workspace
              documents={documents}
              clients={clients}
              loading={loading}
              onNew={startNew}
              onOpenDocument={openDocument}
              onOpenClient={openClient}
              onPipeline={() => setTab("historial")}
              aiQuery={aiQuery}
            />
          ) : tab === "historial" ? (
            <History key={`${params.get("client")}-${params.get("doc")}`} />
          ) : (
            <TagReview key={params.get("model") || "list"} initialModel={Number(params.get("model")) || null} />
          )}
        </div>
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
            setTab("inicio");
            setAiQuery(q);
            document.getElementById("biblioteca")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}
      {creating && (
        <NewDocumentDialog
          initialKind={creating.kind}
          onClose={() => setCreating(null)}
          onPick={(k) => {
            setCreating(null);
            startNew(k);
          }}
          onCreated={reload}
          onOpen={(d) => {
            setCreating(null);
            openDocument(d);
          }}
          onEdit={(d) => {
            setCreating(null);
            setPersonalize({ doc: d });
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
