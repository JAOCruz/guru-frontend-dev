import { useEffect, useRef, useState } from "react";
import { FileUp, UserPlus, X } from "lucide-react";
import { NeoButton } from "@guru/ui";
import Modal, { fieldCls, labelCls } from "../users/Modal";
import { documentosAPI, type HistoryClient, type PortfolioDocument } from "../../services/documentosApi";

interface Props {
  // new document for a client, or a new version of an existing one
  document?: PortfolioDocument;
  initialClient?: HistoryClient | null;
  onClose: () => void;
  onDone: (doc: PortfolioDocument) => void;
}

const ACCEPT = ".docx,.pdf";
const MAX_MB = 20;

export default function UploadDialog({ document: doc, initialClient, onClose, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [client, setClient] = useState<HistoryClient | null>(initialClient ?? null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!/\.(docx|pdf)$/i.test(f.name)) return setError("Solo documentos Word (.docx) o PDF");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`El archivo pasa de ${MAX_MB} MB`);
    setError(null);
    setFile(f);
    if (!doc && !title) setTitle(f.name.replace(/\.(docx|pdf)$/i, ""));
  };

  const submit = async () => {
    if (!file) return setError("Elige un archivo");
    if (!doc && !client) return setError("Elige el cliente");
    if (!doc && !title.trim()) return setError("Ponle un nombre al documento");
    setSaving(true);
    setError(null);
    try {
      const { data } = doc
        ? await documentosAPI.uploadVersion(doc.id, file, notes)
        : await documentosAPI.upload({ file, client_id: client!.id, title: title.trim(), notes });
      onDone(data.document);
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo subir el documento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={doc ? `Nueva versión de «${doc.title}»` : "Subir documento"} onClose={onClose}>
      <div className="space-y-4">
        {!doc && <ClientPicker client={client} onChange={setClient} />}

        <div>
          <label htmlFor="doc-upload-file" className={labelCls}>
            Archivo
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={`mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-base border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
              dragging ? "border-main bg-main/10" : "border-border bg-secondary-background hover:bg-main/5"
            }`}
          >
            <FileUp size={26} className="text-main" />
            {file ? (
              <span className="break-all font-semibold">{file.name}</span>
            ) : (
              <span>
                <b>Arrastra el documento aquí</b> o haz clic para elegirlo
                <br />
                <span className="text-xs text-foreground/60">Word (.docx) o PDF · máx. {MAX_MB} MB</span>
              </span>
            )}
          </div>
          <input
            id="doc-upload-file"
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>

        {!doc && (
          <label className={labelCls}>
            Nombre del documento
            <input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Contrato de alquiler" />
          </label>
        )}
        <label className={labelCls}>
          Nota (opcional)
          <input className={fieldCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Qué cambió o para qué es" />
        </label>

        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <NeoButton type="button" variant="neutral" onClick={onClose}>
            Cancelar
          </NeoButton>
          <NeoButton type="button" onClick={submit} disabled={saving}>
            {saving ? "Subiendo…" : "Subir"}
          </NeoButton>
        </div>
      </div>
    </Modal>
  );
}

// Choose an existing client or create one (name + phone)
export function ClientPicker({ client, onChange }: { client: HistoryClient | null; onChange: (c: HistoryClient | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<HistoryClient[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (client || creating) return;
    const t = setTimeout(() => {
      documentosAPI
        .searchAllClients(q.trim())
        .then(({ data }) => setResults(data.clients))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, client, creating]);

  const create = async () => {
    setError(null);
    try {
      const { data } = await documentosAPI.createClient(name.trim(), phone.trim());
      onChange(data.client);
      setCreating(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || "No se pudo crear el cliente");
    }
  };

  if (client) {
    return (
      <div>
        <p className={labelCls}>Cliente</p>
        <div className="mt-1 flex items-center justify-between gap-2 rounded-base border-2 border-border bg-secondary-background px-3 py-2">
          <span className="min-w-0 truncate text-sm font-bold">
            {client.name || "Sin nombre"} <span className="font-normal text-foreground/60">{client.phone}</span>
          </span>
          <button type="button" onClick={() => onChange(null)} className="flex shrink-0 items-center gap-1 text-xs font-semibold underline">
            <X size={12} /> Cambiar
          </button>
        </div>
      </div>
    );
  }

  if (creating) {
    return (
      <div className="space-y-2 rounded-base border-2 border-border p-3">
        <p className="text-sm font-bold">Nuevo cliente</p>
        <label className={labelCls}>
          Nombre
          <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={labelCls}>
          Teléfono
          <input className={fieldCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="809…" inputMode="tel" />
        </label>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <NeoButton size="sm" variant="neutral" type="button" onClick={() => setCreating(false)}>
            Volver
          </NeoButton>
          <NeoButton size="sm" type="button" onClick={create} disabled={!name.trim() || phone.trim().length < 7}>
            Crear cliente
          </NeoButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className={labelCls}>
        Cliente
        <input className={fieldCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" />
      </label>
      <ul className="mt-1 max-h-40 overflow-y-auto rounded-base border-2 border-border">
        {results.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onChange(c)} className="w-full px-3 py-2 text-left text-sm hover:bg-main/10">
              <b>{c.name || "Sin nombre"}</b> <span className="text-foreground/60">{c.phone}</span>
            </button>
          </li>
        ))}
        {!results.length && <li className="px-3 py-2 text-sm text-foreground/60">Sin resultados</li>}
      </ul>
      <button type="button" onClick={() => setCreating(true)} className="mt-2 flex items-center gap-1 text-sm font-semibold underline">
        <UserPlus size={14} /> Crear cliente nuevo
      </button>
    </div>
  );
}
