import { useEffect, useRef, useState } from "react";
import { FileText, FolderOpen, Search, Sparkles, User, X } from "lucide-react";
import { documentosAPI, type HistoryClient, type Model, type PortfolioDocument } from "../../services/documentosApi";

interface Props {
  documents: PortfolioDocument[]; // my documents, already loaded by the page
  onClose: () => void;
  onModel: (m: Model) => void;
  onDocument: (d: PortfolioDocument) => void;
  onClient: (c: HistoryClient) => void;
  onAskAI: (q: string) => void; // "Buscar con IA" in the library with this text
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// One search for everything (⌘K or "/"): models of the library, my documents and clients, grouped.
// Picking a model opens Personalizar; a document or a client opens Mis documentos right there.
export default function CommandSearch({ documents, onClose, onModel, onDocument, onClient, onAskAI }: Props) {
  const [q, setQ] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [clients, setClients] = useState<HistoryClient[]>([]);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const query = q.trim();

  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (query.length < 2) {
      setModels([]);
      setClients([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      Promise.all([documentosAPI.models(query), documentosAPI.searchAllClients(query)])
        .then(([m, c]) => {
          setModels(m.data.models.slice(0, 6));
          setClients(c.data.clients.slice(0, 4));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const docs = query.length < 2 ? [] : documents.filter((d) => norm(`${d.title} ${d.client_name || ""}`).includes(norm(query))).slice(0, 5);
  const empty = query.length >= 2 && !loading && !models.length && !docs.length && !clients.length;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-3 pt-[10vh] md:p-6 md:pt-[12vh]" onClick={onClose}>
      <div role="dialog" aria-label="Buscar en Documentos" className="w-full max-w-2xl overflow-hidden rounded-base border-2 border-border bg-background shadow-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b-2 border-border px-3">
          <Search size={18} className="shrink-0 text-foreground/50" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (models[0]) onModel(models[0]);
              else if (docs[0]) onDocument(docs[0]);
              else if (clients[0]) onClient(clients[0]);
              else if (query.length >= 3) onAskAI(query);
            }}
            placeholder="Buscar modelos, documentos y clientes…"
            aria-label="Buscar modelos, documentos y clientes"
            className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
          />
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-base p-1 hover:bg-foreground/10">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.length < 2 && <p className="px-2 py-6 text-center text-sm text-foreground/60">Escribe el nombre de un modelo, un documento o un cliente.</p>}
          {models.length > 0 && (
            <Group label={`Modelos (${models.length})`}>
              {models.map((m) => (
                <Row key={m.id} icon={<FileText size={16} className="text-main" />} title={m.name} hint={m.category || "Sin categoría"} onClick={() => onModel(m)} />
              ))}
            </Group>
          )}
          {docs.length > 0 && (
            <Group label={`Mis documentos (${docs.length})`}>
              {docs.map((d) => (
                <Row
                  key={d.id}
                  icon={<FolderOpen size={16} />}
                  title={d.title}
                  hint={`${d.client_name || "Sin cliente"} · ${d.approved_version ? `v${d.approved_version} aprobada` : "Borrador"}`}
                  onClick={() => onDocument(d)}
                />
              ))}
            </Group>
          )}
          {clients.length > 0 && (
            <Group label={`Clientes (${clients.length})`}>
              {clients.map((c) => (
                <Row key={c.id} icon={<User size={16} />} title={c.name || "Sin nombre"} hint={c.phone || ""} onClick={() => onClient(c)} />
              ))}
            </Group>
          )}
          {empty && <p className="px-2 py-4 text-center text-sm text-foreground/60">Nada con ese nombre.</p>}
          {query.length >= 3 && (
            <button type="button" onClick={() => onAskAI(query)} className="mt-1 flex w-full items-center gap-2 rounded-base border-2 border-dashed border-border px-3 py-2 text-left text-sm font-semibold hover:bg-main/10">
              <Sparkles size={16} className="text-main" /> Buscar con IA: «{query}»
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-foreground/50">{label}</p>
      <ul>{children}</ul>
    </div>
  );
}

function Row({ icon, title, hint, onClick }: { icon: React.ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-base px-2 py-2 text-left hover:bg-main/10">
        <span className="shrink-0">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{title}</span>
          <span className="block truncate text-xs text-foreground/60">{hint}</span>
        </span>
      </button>
    </li>
  );
}
