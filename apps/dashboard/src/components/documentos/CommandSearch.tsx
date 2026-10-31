import { useEffect, useRef, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
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
    <div className="guru-os fixed inset-0 z-[70] flex items-start justify-center bg-black/70 p-3 pt-[10vh] md:p-6 md:pt-[12vh]" onClick={onClose}>
      <div role="dialog" aria-label="Buscar en Documentos" className="gos-dialog w-full max-w-2xl overflow-hidden rounded-[1.5rem]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b-2 border-blue-900/60 bg-[#0d111c] px-3">
          <span aria-hidden="true" className="gos-badge text-lg">
            🔍
          </span>
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
            className="gos-bare-input min-w-0 flex-1 bg-transparent py-3.5 text-base text-white outline-none placeholder:text-slate-500"
          />
          <kbd className="hidden rounded border px-1.5 text-[10px] font-bold sm:inline">Esc</kbd>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-xl border border-slate-700 bg-black p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {query.length < 2 && (
            <p className="gos-muted flex items-center justify-center gap-2 px-2 py-6 text-center text-sm">
              <Search size={16} className="shrink-0" /> Escribe el nombre de un modelo, un documento o un cliente.
            </p>
          )}
          {models.length > 0 && (
            <Group label={`Modelos (${models.length})`}>
              {models.map((m) => (
                <Row key={m.id} emoji="📄" title={m.name} hint={m.category || "Sin categoría"} onClick={() => onModel(m)} />
              ))}
            </Group>
          )}
          {docs.length > 0 && (
            <Group label={`Mis documentos (${docs.length})`}>
              {docs.map((d) => (
                <Row
                  key={d.id}
                  emoji="🗂️"
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
                <Row key={c.id} emoji="👤" title={c.name || "Sin nombre"} hint={c.phone || ""} onClick={() => onClient(c)} />
              ))}
            </Group>
          )}
          {empty && <p className="gos-muted px-2 py-4 text-center text-sm">Nada con ese nombre.</p>}
          {query.length >= 3 && (
            <button
              type="button"
              onClick={() => onAskAI(query)}
              className="mt-1 flex w-full items-center gap-2 rounded-2xl border-2 border-dashed border-blue-500/60 bg-blue-900/20 px-3 py-2.5 text-left text-sm font-bold text-blue-100 hover:border-blue-400 hover:bg-blue-900/40"
            >
              <Sparkles size={16} className="shrink-0 text-blue-300" /> Buscar con IA: «{query}»
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
      <p className="gos-label-blue px-2 pb-1 pt-1">{label}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function Row({ emoji, title, hint, onClick }: { emoji: string; title: string; hint: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="gos-row rounded-xl border-2 border-transparent px-2 py-2 hover:border-blue-500 hover:bg-blue-900/30">
        <span aria-hidden="true" className="text-xl leading-none">
          {emoji}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-white">{title}</span>
          <span className="gos-muted block truncate text-xs">{hint}</span>
        </span>
      </button>
    </li>
  );
}
