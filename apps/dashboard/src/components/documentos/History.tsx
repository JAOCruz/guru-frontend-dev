import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, Eye, FileDown, Search, Send, Sparkles, Upload } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { useAuth } from "../../context/AuthContext";
import { useUserColors } from "../../context/UserColorsContext";
import {
  documentosAPI, downloadFile, versionFileUrl,
  type DocSort, type DocVersion, type SendMode, type SendResult, type HistoryClient, type PortfolioDocument,
} from "../../services/documentosApi";
import { notify, confirmDialog } from "../../lib/dialogs";
import UploadDialog from "./UploadDialog";
import PdfPreview from "./PdfPreview";
import PersonalizeDialog from "./PersonalizeDialog";
import SaveAsModelButton from "./SaveAsModelButton";
import Modal from "../users/Modal";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const fmt = (d: string) => new Date(d).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" });
const SORTS: { key: DocSort; label: string; emoji: string }[] = [
  { key: "recent", label: "Recientes", emoji: "🕘" },
  { key: "date", label: "Fecha", emoji: "📅" },
  { key: "name", label: "Nombre", emoji: "🔤" },
];

// Historial del digitador: personalized documents per client. Each digitador sees only what
// they created; the admin sees everyone's (with a filter) and approves versions.
// Split view: clients on the left (a chip row on phones), the client's documents in a folder panel.
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
  const [personalize, setPersonalize] = useState<{ doc: PortfolioDocument; version: DocVersion } | null>(null);
  const [approving, setApproving] = useState<{ doc: PortfolioDocument; version: DocVersion } | null>(null);
  const [sending, setSending] = useState(false);
  const [params] = useSearchParams();
  // «Sin cliente» is id 0; ?doc= opens that document once the list is in
  const wantedClient = params.has("client") ? Number(params.get("client")) : null;
  const wantedDoc = Number(params.get("doc")) || null;
  const openedWanted = useRef(false);

  const loadClients = () =>
    documentosAPI
      .clients(clientQ.trim())
      .then(({ data }) => {
        setClients(data.clients);
        // coming from "Personalizar" or Inicio: open that client
        if (wantedClient !== null && !selected) {
          const c = data.clients.find((x) => x.id === wantedClient);
          if (c) setSelected(c);
        }
      })
      .catch(() => notify("No se pudieron cargar los clientes"));

  useEffect(() => {
    const t = setTimeout(loadClients, 250);
    return () => clearTimeout(t);
  }, [clientQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDocuments = () => {
    if (!selected) return;
    documentosAPI
      .documents({ client_id: selected.id, sort, ...(creator ? { created_by: Number(creator) } : {}) })
      .then(({ data }) => {
        setDocuments(data.documents);
        const wanted = wantedDoc && !openedWanted.current ? data.documents.find((d) => d.id === wantedDoc) : null;
        if (wanted) {
          openedWanted.current = true;
          toggleDoc(wanted);
        }
      })
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

  const reportSend = (r: SendResult, mode?: SendMode) => {
    if (r.sent) notify("Enviado al cliente por WhatsApp", "success");
    else if (r.code === "WINDOW_CLOSED") notify(WINDOW_NOTICE, "info");
    else if (r.code === "ALREADY_SENT") notify("Este documento ya se había enviado", "info");
    else if (mode === "al_pagar") notify("Aprobada: se enviará cuando el cliente pague", "success");
    else if (r.code) notify("No se pudo enviar el documento. Puedes reintentar con «Enviar al cliente»");
  };

  const approve = async (doc: PortfolioDocument, v: DocVersion, mode: SendMode) => {
    setApproving(null);
    try {
      const r = (await documentosAPI.approve(doc.id, v.id, mode)).data;
      setOpenDoc(r.document);
      loadDocuments();
      notify(`v${v.version_number} aprobada`, "success");
      reportSend(r, mode);
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudo aprobar");
    }
  };

  const sendToClient = async (doc: PortfolioDocument) => {
    // approved before phase 2 (no send mode chosen): sending it now is a deliberate choice
    if (!doc.send_mode) {
      const ok = await confirmDialog("Este documento se aprobó antes; ¿enviarlo ahora al cliente por WhatsApp?", {
        title: "Enviar al cliente",
        confirmLabel: "Enviar",
      });
      if (!ok) return;
    }
    setSending(true);
    try {
      const r = (await documentosAPI.send(doc.id)).data;
      setOpenDoc((cur) => (cur ? { ...cur, ...r.document, versions: r.document.versions ?? cur.versions } : r.document));
      loadDocuments();
      reportSend(r);
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudo enviar el documento");
    } finally {
      setSending(false);
    }
  };

  const afterUpload = (doc: PortfolioDocument) => {
    setUpload(null);
    notify("Documento subido", "success");
    // a document without a client goes to the «Sin cliente» group (id 0)
    const client = doc.client_id ? { id: doc.client_id, name: doc.client_name, phone: null } : { id: 0, name: "Sin cliente", phone: null };
    if (!selected || selected.id !== client.id) setSelected(client);
    else loadDocuments();
    setOpenDoc(doc);
    loadClients();
  };

  const download = (doc: { title: string }, v: DocVersion, format: "docx" | "pdf") =>
    downloadFile(versionFileUrl(v.id, format), format === "docx" ? v.file_name : `${doc.title} v${v.version_number}.pdf`)?.catch?.(
      (err: Error) => notify(err.message),
    );

  return (
    <section className="grid min-h-[50vh] gap-4 md:grid-cols-[17rem_1fr]">
      {/* Clients: a column on desktop, a chip row on phones */}
      <aside className="gos-side flex min-w-0 flex-col">
        <div className="space-y-2 border-b-2 border-slate-800 p-3">
          <NeoButton className="w-full font-heading font-black uppercase tracking-wide" onClick={() => setUpload({})}>
            <Upload size={16} /> Subir documento
          </NeoButton>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={clientQ}
              onChange={(e) => setClientQ(e.target.value)}
              placeholder="Buscar cliente"
              aria-label="Buscar cliente"
              className="gos-input py-2 pl-9 pr-3"
            />
          </div>
        </div>
        <p className="px-4 pt-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Clientes</p>
        <ul className="flex min-w-0 gap-1.5 overflow-x-auto p-2 md:flex-1 md:flex-col md:overflow-y-auto">
          {clients.map((c) => {
            const current = selected?.id === c.id;
            return (
              <li key={c.id} className="shrink-0 md:shrink">
                <button
                  type="button"
                  aria-current={current}
                  onClick={() => {
                    setSelected(c);
                    setOpenDoc(null);
                  }}
                  className="gos-side-item max-w-[14rem] md:max-w-none"
                >
                  <span aria-hidden="true" className="text-xl leading-none">
                    👤
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{c.name || "Sin nombre"}</span>
                    <span className="gos-muted hidden truncate text-xs font-medium md:block">{c.phone}</span>
                  </span>
                  <span className="gos-count">{c.documents}</span>
                </button>
              </li>
            );
          })}
          {!clients.length && (
            <li className="gos-muted w-full px-3 py-6 text-center text-sm">
              {clientQ ? "Ningún cliente con documentos coincide." : "Aún no hay documentos. Sube el primero."}
            </li>
          )}
        </ul>
      </aside>

      {/* Documents of the selected client */}
      <div className="flex min-w-0 flex-col gap-3">
        {!selected ? (
          <div className="gos-muted flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-800 p-8 text-center text-sm">
            <span aria-hidden="true" className="text-5xl">
              🗂️
            </span>
            Elige un cliente para ver sus documentos, o sube uno nuevo.
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-3 px-1">
              <span aria-hidden="true" className="gos-badge shrink-0 text-2xl">
                👤
              </span>
              <h2 className="min-w-0 flex-1 break-words font-heading text-lg font-black uppercase tracking-wide text-white md:text-xl">{selected.name || "Sin nombre"}</h2>
              {isAdmin && (
                <select
                  value={creator}
                  onChange={(e) => setCreator(e.target.value)}
                  aria-label="Filtrar por digitador"
                  className="gos-input basis-full px-2 py-1.5 text-xs font-bold sm:w-auto sm:basis-auto"
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

            {/* Folder tabs: how the list is ordered */}
            <div>
              <div className="gos-folder-tabs" role="group" aria-label="Ordenar">
                {SORTS.map((s) => (
                  <button key={s.key} type="button" onClick={() => setSort(s.key)} aria-pressed={sort === s.key} className="gos-folder-tab">
                    <span aria-hidden="true" className="text-base">
                      {s.emoji}
                    </span>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="gos-folder-panel">
                <ul className="space-y-2">
                  {documents.map((d) => {
                    const open = openDoc?.id === d.id;
                    return (
                      <li key={d.id} className="gos-card overflow-hidden" data-open={open}>
                        <button type="button" onClick={() => toggleDoc(d)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-left sm:px-4">
                          <span aria-hidden="true" className="text-2xl leading-none">
                            📄
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-bold text-white">{d.title}</span>
                            <span className="gos-muted block text-xs">
                              {d.versions_count} versión{d.versions_count === 1 ? "" : "es"} · {fmt(d.updated_at)}
                              {isAdmin && d.created_by_name ? ` · ${d.created_by_name}` : ""}
                            </span>
                          </span>
                          {/* badges go under the title on phones, next to it from sm */}
                          <span className="order-last flex basis-full flex-wrap gap-1.5 sm:order-none sm:basis-auto">
                            {d.prepared_by_bot && <BotBadge />}
                            <StatusBadge approved={d.approved_version} />
                          </span>
                          <ChevronDown size={18} className={`shrink-0 text-blue-400 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                        {open && openDoc && (
                          <div className="border-t border-blue-900/40 bg-black/30 px-3 py-3">
                            {(() => {
                              const canApprove = openDoc.can_approve ?? isAdmin;
                              const delivery = deliveryLine(openDoc);
                              return (
                                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold">
                                  {openDoc.prepared_by_bot && (
                                    <>
                                      <BotBadge />
                                      {openDoc.invoice_id ? (
                                        <Link to={`/cotizaciones?invoice=${openDoc.invoice_id}`} className="text-blue-300 underline">
                                          Ver cotización
                                        </Link>
                                      ) : null}
                                    </>
                                  )}
                                  {delivery &&
                                    (delivery.warn ? (
                                      <span className="gos-callout-orange basis-full !py-2 text-xs">
                                        <span aria-hidden="true">⚠️</span> {delivery.text}
                                      </span>
                                    ) : (
                                      <span className="text-emerald-400">
                                        <span aria-hidden="true">✅</span> {delivery.text}
                                      </span>
                                    ))}
                                  {canApprove && openDoc.client_id && openDoc.approved_version && !openDoc.sent_at && (
                                    <NeoButton size="sm" disabled={sending} onClick={() => sendToClient(openDoc)}>
                                      <Send size={14} /> Enviar al cliente
                                    </NeoButton>
                                  )}
                                </div>
                              );
                            })()}
                            <p className="gos-label-blue mb-2">Versiones</p>
                            <ul className="space-y-2">
                              {openDoc.versions?.map((v) => (
                                <li key={v.id} className="gos-step gos-card p-3">
                                  <span className={`gos-step-num ${v.status === "approved" ? "gos-step-num-emerald" : ""}`}>v{v.version_number}</span>
                                  <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                      {v.status === "approved" ? (
                                        <span className="gos-pill gos-pill-emerald">
                                          <span aria-hidden="true">✅</span> Aprobada
                                        </span>
                                      ) : (
                                        <span className="gos-pill gos-pill-ghost">Borrador</span>
                                      )}
                                      <span className="gos-muted min-w-0 basis-full break-words text-xs sm:basis-auto">
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
                                      {v.mime_type === DOCX && (
                                        <NeoButton size="sm" variant="neutral" onClick={() => setPersonalize({ doc: openDoc, version: v })} title="Llenar con datos o pedir cambios a la IA: crea una versión nueva">
                                          <Sparkles size={14} /> Personalizar
                                        </NeoButton>
                                      )}
                                      {(openDoc.can_approve ?? isAdmin) && v.status !== "approved" && (
                                        <NeoButton size="sm" onClick={() => setApproving({ doc: openDoc, version: v })}>
                                          Aprobar v{v.version_number}
                                        </NeoButton>
                                      )}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <NeoButton size="sm" variant="neutral" onClick={() => setUpload({ doc: openDoc })}>
                                <Upload size={14} /> Subir nueva versión
                              </NeoButton>
                              {/* made from a model and has a Word: its wording can become the model's next version */}
                              {openDoc.template_id && openDoc.versions?.some((v) => v.mime_type === DOCX) ? <SaveAsModelButton documentId={openDoc.id} /> : null}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {!documents.length && (
                    <li className="gos-muted rounded-2xl border-2 border-dashed border-slate-700 p-6 text-center text-sm">
                      No hay documentos {creator ? "de ese digitador " : ""}para este cliente.
                    </li>
                  )}
                </ul>
              </div>
            </div>
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
      {personalize && (
        <PersonalizeDialog
          source={{ version_id: personalize.version.id }}
          title={`${personalize.doc.title} v${personalize.version.version_number}`}
          fixedClient={personalize.doc.client_id ? { id: personalize.doc.client_id, name: personalize.doc.client_name, phone: null } : undefined}
          onSaved={(doc) => {
            setOpenDoc(doc);
            loadDocuments();
          }}
          onClose={() => setPersonalize(null)}
        />
      )}
      {approving && (
        <ApproveDialog
          doc={approving.doc}
          version={approving.version}
          onCancel={() => setApproving(null)}
          onApprove={(mode) => approve(approving.doc, approving.version, mode)}
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

const WINDOW_NOTICE = "Lista, sin enviar: pasaron más de 24 h desde el último mensaje del cliente";

function deliveryLine(d: PortfolioDocument): { text: string; warn: boolean } | null {
  if (d.sent_at) return { text: `Enviado ${fmt(d.sent_at)}`, warn: false };
  if (d.send_error === "WINDOW_CLOSED") return { text: WINDOW_NOTICE, warn: true };
  if (d.send_error) return { text: "No se pudo enviar", warn: true };
  if (d.send_mode === "al_pagar" && d.approved_version) return { text: "Se enviará cuando el cliente pague", warn: false };
  return null;
}

function BotBadge() {
  return (
    <span className="gos-pill gos-pill-orange">
      <span aria-hidden="true">🤖</span> Preparado por el bot
    </span>
  );
}

// "Aprobar" asks how the approved document should reach the client.
// "Enviar cuando pague" needs a cotización to wait for: without one it is not offered (the server answers NO_INVOICE).
function ApproveDialog({ doc, version, onCancel, onApprove }: {
  doc: PortfolioDocument; version: DocVersion; onCancel: () => void; onApprove: (mode: SendMode) => void;
}) {
  // A quote that is already paid will never fire "when paid": the document would go out at approval with no new
  // payment, so that case defaults to "Solo aprobar" and says so.
  const alreadyPaid = !!doc.invoice_id && doc.invoice_status === "paid";
  const [mode, setMode] = useState<SendMode>(doc.invoice_id && !alreadyPaid ? "al_pagar" : "manual");
  const options: { value: SendMode; label: string; hint: string; emoji: string }[] = [
    ...(doc.invoice_id
      ? [{
          value: "al_pagar" as const, label: "Enviar cuando pague", emoji: "💸",
          hint: alreadyPaid ? "La cotización ya está pagada: se envía al aprobar." : "Se manda por WhatsApp al confirmar el pago de la cotización",
        }]
      : []),
    // without a client there is nobody to send it to
    ...(doc.client_id ? [{ value: "ya" as const, label: "Enviar ya", emoji: "📨", hint: "Se manda por WhatsApp ahora mismo" }] : []),
    { value: "manual", label: "Solo aprobar", emoji: "✅", hint: "No se envía; lo mandas tú después" },
  ];
  return (
    <Modal title={`¿Aprobar v${version.version_number}?`} onClose={onCancel}>
      <p className="mb-3 text-sm">
        La versión v{version.version_number} quedará como la aprobada de «{doc.title}».
      </p>
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o.value} className="gos-card flex cursor-pointer items-start gap-2 p-2.5">
            <input type="radio" name="send_mode" value={o.value} checked={mode === o.value} onChange={() => setMode(o.value)} className="mt-1" />
            <span>
              <span className="block text-sm font-bold text-white">
                <span aria-hidden="true">{o.emoji}</span> {o.label}
              </span>
              <span className="gos-muted block text-xs">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <NeoButton variant="neutral" onClick={onCancel}>Cancelar</NeoButton>
        <NeoButton onClick={() => onApprove(mode)}>Aprobar</NeoButton>
      </div>
    </Modal>
  );
}

function StatusBadge({ approved }: { approved: number | null }) {
  return approved ? (
    <span className="gos-pill gos-pill-emerald">
      <span aria-hidden="true">✅</span> v{approved}
    </span>
  ) : (
    <span className="gos-pill gos-pill-ghost">Borrador</span>
  );
}
