import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronLeft, Eye, FileDown, FilePlus2, Search, Upload } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { useAuth } from "../../context/AuthContext";
import { useUserColors } from "../../context/UserColorsContext";
import {
  documentosAPI, downloadFile, versionFileUrl,
  type DocSort, type DocVersion, type HistoryClient, type PortfolioDocument,
} from "../../services/documentosApi";
import { confirmDialog, notify } from "../../lib/dialogs";
import UploadDialog from "./UploadDialog";
import PdfPreview from "./PdfPreview";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const fmt = (d: string) => new Date(d).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" });

// Historial del digitador: personalized documents per client. Each digitador sees only what
// they created; the admin sees everyone's (with a filter) and approves versions.
export default function History() {
  const { isAdmin } = useAuth();
  const { users } = useUserColors();
  const [clients, setClients] = useState<HistoryClient[]>([]);
  const [clientQ, setClientQ] = useState("");
  const [selected, setSelected] = useState<HistoryClient | null>(null);
  const [documents, setDocuments] = useState<PortfolioDocument[]>([]);
  const [sort, setSort] = useState<DocSort>("recent");
  const [creator, setCreator] = useState<string>("");
  const [openDoc, setOpenDoc] = useState<PortfolioDocument | null>(null);
  const [upload, setUpload] = useState<{ doc?: PortfolioDocument } | null>(null);
  const [preview, setPreview] = useState<{ title: string; version: DocVersion } | null>(null);

  const loadClients = () =>
    documentosAPI.clients(clientQ.trim()).then(({ data }) => setClients(data.clients)).catch(() => notify("No se pudieron cargar los clientes"));

  useEffect(() => {
    const t = setTimeout(loadClients, 250);
    return () => clearTimeout(t);
  }, [clientQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDocuments = () => {
    if (!selected) return;
    documentosAPI
      .documents({ client_id: selected.id, sort, ...(creator ? { created_by: Number(creator) } : {}) })
      .then(({ data }) => setDocuments(data.documents))
      .catch(() => notify("No se pudieron cargar los documentos"));
  };
  useEffect(loadDocuments, [selected, sort, creator]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDoc = async (d: PortfolioDocument) => {
    if (openDoc?.id === d.id) return setOpenDoc(null);
    try {
      setOpenDoc((await documentosAPI.document(d.id)).data.document);
    } catch {
      notify("No se pudo abrir el documento");
    }
  };

  const approve = async (doc: PortfolioDocument, v: DocVersion) => {
    const ok = await confirmDialog(`La versión v${v.version_number} quedará como la aprobada de «${doc.title}».`, {
      title: `¿Aprobar v${v.version_number}?`,
      confirmLabel: "Aprobar",
    });
    if (!ok) return;
    try {
      setOpenDoc((await documentosAPI.approve(doc.id, v.id)).data.document);
      loadDocuments();
      notify(`v${v.version_number} aprobada`, "success");
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudo aprobar");
    }
  };

  const afterUpload = (doc: PortfolioDocument) => {
    setUpload(null);
    notify("Documento subido", "success");
    const client = { id: doc.client_id, name: doc.client_name, phone: null };
    if (!selected || selected.id !== doc.client_id) setSelected(client);
    else loadDocuments();
    setOpenDoc(doc);
    loadClients();
  };

  const download = (doc: { title: string }, v: DocVersion, format: "docx" | "pdf") =>
    downloadFile(versionFileUrl(v.id, format), format === "docx" ? v.file_name : `${doc.title} v${v.version_number}.pdf`)?.catch?.(
      (err: Error) => notify(err.message),
    );

  return (
    <section className="grid min-h-[60vh] gap-4 md:grid-cols-[18rem_1fr]">
      {/* Clients */}
      <aside className={`${selected ? "hidden md:flex" : "flex"} min-w-0 flex-col rounded-base border-2 border-border bg-secondary-background shadow-shadow`}>
        <div className="space-y-2 border-b-2 border-border p-3">
          <NeoButton className="w-full" onClick={() => setUpload({})}>
            <Upload size={16} /> Subir documento
          </NeoButton>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
            <input
              value={clientQ}
              onChange={(e) => setClientQ(e.target.value)}
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
              className="w-full rounded-base border-2 border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-main"
            />
          </div>
        </div>
        <ul className="flex-1 divide-y-2 divide-border/15 overflow-y-auto">
          {clients.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(c);
                  setOpenDoc(null);
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left ${
                  selected?.id === c.id ? "bg-main/15 shadow-[inset_4px_0_0_0_var(--main)]" : "hover:bg-background"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{c.name || "Sin nombre"}</span>
                  <span className="block truncate text-xs text-foreground/60">{c.phone}</span>
                </span>
                <span className="shrink-0 rounded-full bg-foreground/10 px-2 text-xs font-bold">{c.documents}</span>
              </button>
            </li>
          ))}
          {!clients.length && (
            <li className="px-3 py-8 text-center text-sm text-foreground/60">
              {clientQ ? "Ningún cliente con documentos coincide." : "Aún no hay documentos. Sube el primero."}
            </li>
          )}
        </ul>
      </aside>

      {/* Documents of the selected client */}
      <div className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-col gap-3`}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center rounded-base border-2 border-dashed border-border p-8 text-center text-foreground/60">
            Elige un cliente para ver sus documentos, o sube uno nuevo.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setSelected(null)} className="rounded-base border-2 border-border p-1.5 md:hidden" aria-label="Volver a clientes">
                <ChevronLeft size={18} />
              </button>
              <h2 className="min-w-0 flex-1 truncate font-heading text-2xl font-black">{selected.name || "Sin nombre"}</h2>
              {/* on phones the client list (with its upload button) is hidden */}
              <NeoButton size="sm" className="md:hidden" onClick={() => setUpload({})}>
                <FilePlus2 size={14} /> Subir
              </NeoButton>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="text-foreground/60">Ordenar:</span>
              {(["recent", "date", "name"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSort(s)}
                  aria-pressed={sort === s}
                  className={`rounded-base border-2 px-2 py-0.5 ${sort === s ? "border-border bg-main text-main-foreground" : "border-transparent hover:border-border"}`}
                >
                  {{ recent: "Recientes", date: "Fecha", name: "Nombre" }[s]}
                </button>
              ))}
              {isAdmin && (
                <select
                  value={creator}
                  onChange={(e) => setCreator(e.target.value)}
                  aria-label="Filtrar por digitador"
                  className="ml-auto rounded-base border-2 border-border bg-background px-2 py-1"
                >
                  <option value="">Todos los digitadores</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.username}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <ul className="space-y-2">
              {documents.map((d) => {
                const open = openDoc?.id === d.id;
                return (
                  <li key={d.id} className="overflow-hidden rounded-base border-2 border-border bg-background shadow-shadow">
                    <button type="button" onClick={() => toggleDoc(d)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-bold">{d.title}</span>
                        <span className="block text-xs text-foreground/60">
                          {d.versions_count} versión{d.versions_count === 1 ? "" : "es"} · {fmt(d.updated_at)}
                          {isAdmin && d.created_by_name ? ` · ${d.created_by_name}` : ""}
                        </span>
                      </span>
                      <StatusBadge approved={d.approved_version} />
                      <ChevronDown size={18} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && openDoc && (
                      <div className="border-t-2 border-border bg-secondary-background px-3 py-3">
                        <ul className="space-y-2">
                          {openDoc.versions?.map((v) => (
                            <li key={v.id} className="flex flex-col gap-2 rounded-base border-2 border-border bg-background px-3 py-2">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-heading text-lg font-black">v{v.version_number}</span>
                                {v.status === "approved" ? (
                                  <span className="flex items-center gap-1 rounded-full border-2 border-border bg-green-100 px-2 text-xs font-bold">
                                    <CheckCircle2 size={12} /> Aprobada
                                  </span>
                                ) : (
                                  <span className="rounded-full border-2 border-border/40 px-2 text-xs font-bold text-foreground/70">Borrador</span>
                                )}
                                <span className="min-w-0 basis-full break-words text-xs text-foreground/60 sm:basis-auto">
                                  {v.created_by_name} · {fmt(v.created_at)}
                                  {v.notes ? ` · ${v.notes}` : ""}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <NeoButton size="sm" variant="neutral" onClick={() => setPreview({ title: `${openDoc.title} v${v.version_number}`, version: v })}>
                                  <Eye size={14} /> Ver
                                </NeoButton>
                                {v.mime_type === DOCX && (
                                  <NeoButton size="sm" variant="neutral" onClick={() => download(openDoc, v, "docx")}>
                                    <FileDown size={14} /> Word
                                  </NeoButton>
                                )}
                                <NeoButton size="sm" variant="neutral" onClick={() => download(openDoc, v, "pdf")}>
                                  <FileDown size={14} /> PDF
                                </NeoButton>
                                {isAdmin && v.status !== "approved" && (
                                  <NeoButton size="sm" onClick={() => approve(openDoc, v)}>
                                    Aprobar v{v.version_number}
                                  </NeoButton>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                        <NeoButton size="sm" variant="neutral" className="mt-3" onClick={() => setUpload({ doc: openDoc })}>
                          <Upload size={14} /> Subir nueva versión
                        </NeoButton>
                      </div>
                    )}
                  </li>
                );
              })}
              {!documents.length && (
                <li className="rounded-base border-2 border-dashed border-border p-6 text-center text-sm text-foreground/60">
                  No hay documentos {creator ? "de ese digitador " : ""}para este cliente.
                </li>
              )}
            </ul>
          </>
        )}
      </div>

      {upload && (
        <UploadDialog
          document={upload.doc}
          initialClient={upload.doc ? undefined : selected}
          onClose={() => setUpload(null)}
          onDone={afterUpload}
        />
      )}
      {preview && (
        <PdfPreview
          title={preview.title}
          pdfUrl={versionFileUrl(preview.version.id, "pdf", true)}
          onClose={() => setPreview(null)}
          onDownloadWord={preview.version.mime_type === DOCX ? () => download({ title: preview.title }, preview.version, "docx") : undefined}
        />
      )}
    </section>
  );
}

function StatusBadge({ approved }: { approved: number | null }) {
  return approved ? (
    <span className="flex shrink-0 items-center gap-1 rounded-full border-2 border-border bg-green-100 px-2 text-xs font-bold">
      <CheckCircle2 size={12} /> v{approved}
    </span>
  ) : (
    <span className="shrink-0 rounded-full border-2 border-border/40 px-2 text-xs font-bold text-foreground/70">Borrador</span>
  );
}
