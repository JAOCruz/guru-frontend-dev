import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, Eye, FileDown, Search, Send, Sparkles, Upload, X } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { useAuth } from "../../context/AuthContext";
import { useUserColors } from "../../context/UserColorsContext";
import UserAvatar from "../UserAvatar";
import {
  documentosAPI, downloadFile, versionFileUrl,
  type DocSort, type DocVersion, type SendMode, type SendResult, type PortfolioDocument,
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

// Mis documentos: one list of every document in the user's scope. Each digitador sees only theirs;
// the admin sees everyone's and filters by digitador, with the same colored chips as Casos.
// ?client= (from the search, or after personalizing) narrows the list to that client until it is cleared.
type Owner = "all" | "none" | number;

export default function History() {
  const { isAdmin } = useAuth();
  const { users, appearanceOf } = useUserColors();
  const [q, setQ] = useState("");
  const [documents, setDocuments] = useState<PortfolioDocument[] | null>(null);
  const [sort, setSort] = useState<DocSort>("recent");
  const [owner, setOwner] = useState<Owner>("all");
  const [openDoc, setOpenDoc] = useState<PortfolioDocument | null>(null);
  const [upload, setUpload] = useState<{ doc?: PortfolioDocument } | null>(null);
  const [preview, setPreview] = useState<{ title: string; version: DocVersion } | null>(null);
  const [personalize, setPersonalize] = useState<{ doc: PortfolioDocument; version: DocVersion } | null>(null);
  const [approving, setApproving] = useState<{ doc: PortfolioDocument; version: DocVersion } | null>(null);
  const [sending, setSending] = useState(false);
  const [params] = useSearchParams();
  // «Sin cliente» is id 0; ?doc= opens that document once the list is in
  const [clientFilter, setClientFilter] = useState<number | null>(params.has("client") ? Number(params.get("client")) : null);
  const wantedDoc = Number(params.get("doc")) || null;
  const openedWanted = useRef(false);

  const loadDocuments = () => {
    documentosAPI
      .documents({ sort })
      .then(({ data }) => {
        setDocuments(data.documents);
        const wanted = wantedDoc && !openedWanted.current ? data.documents.find((d) => d.id === wantedDoc) : null;
        if (wanted) {
          openedWanted.current = true;
          toggleDoc(wanted);
        }
      })
      .catch(() => {
        setDocuments((cur) => cur ?? []);
        notify("No se pudieron cargar los documentos");
      });
  };
  useEffect(loadDocuments, [sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = documents ?? [];
  // «Sin cliente» is id 0
  const filterClient = clientFilter === null ? null : all.find((d) => (d.client_id ?? 0) === clientFilter) ?? null;
  const term = q.trim().toLowerCase();
  // The chips count what the search and the client leave; the list also applies the chosen digitador
  const narrowed = all.filter(
    (d) =>
      (clientFilter === null || (d.client_id ?? 0) === clientFilter) &&
      (!term || [d.title, d.client_name, d.client_phone, d.created_by_name].some((x) => x?.toLowerCase().includes(term))),
  );
  const visible = narrowed.filter((d) => (owner === "all" ? true : owner === "none" ? d.created_by == null : d.created_by === owner));
  // Digitadores always get a chip; anyone else who made a document too, so no document is out of reach
  const chips = useMemo<Array<[Owner, string, number]>>(() => {
    const people = new Map<number, string>();
    users
      .filter((u) => u.role === "digitador" && u.is_active !== false && u.username !== "administracion")
      .forEach((u) => people.set(u.id, u.name || u.username || "Digitador"));
    all.forEach((d) => {
      if (d.created_by != null && !people.has(d.created_by)) people.set(d.created_by, d.created_by_name || "Sin nombre");
    });
    return [
      ["all", "Todos", narrowed.length],
      ["none", "Sin asignar", narrowed.filter((d) => d.created_by == null).length],
      ...[...people].map(([id, name]): [Owner, string, number] => [id, name, narrowed.filter((d) => d.created_by === id).length]),
    ];
  }, [users, all, narrowed]);

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
    // clear whatever would hide the new document
    setQ("");
    setOwner("all");
    setClientFilter((cur) => (cur === (doc.client_id ?? 0) ? cur : null));
    setOpenDoc(doc);
    loadDocuments();
  };

  const download = (doc: { title: string }, v: DocVersion, format: "docx" | "pdf") =>
    downloadFile(versionFileUrl(v.id, format), format === "docx" ? v.file_name : `${doc.title} v${v.version_number}.pdf`)?.catch?.(
      (err: Error) => notify(err.message),
    );

  return (
    <section className="flex min-h-[50vh] min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar documento, cliente o digitador"
            aria-label="Buscar documento, cliente o digitador"
            className="gos-input py-2 pl-9 pr-3"
          />
        </div>
        <NeoButton className="font-heading text-sm font-black uppercase tracking-wide" onClick={() => setUpload({})}>
          <Upload size={16} /> Subir documento
        </NeoButton>
      </div>

      {/* By digitador, with how many documents each has (same chips as Casos) */}
      {isAdmin && (
        <div role="group" aria-label="Digitador" className="flex gap-1.5 overflow-x-auto pb-1 gos-md:flex-wrap" style={{ scrollbarWidth: "none" }}>
          {chips.map(([key, label, count]) => {
            const active = owner === key;
            const a = typeof key === "number" ? appearanceOf(key) : null;
            // Inline because the Gurú OS theme repaints bg-white and lets buttons wrap on phones
            const colors = a
              ? active
                ? { backgroundColor: a.color.bg, color: a.color.text }
                : { backgroundColor: `color-mix(in srgb, ${a.color.bg} 25%, white)`, color: "#000" }
              : active
                ? { backgroundColor: "#2563eb", color: "#fff" }
                : { backgroundColor: "#fff", color: "#000" };
            return (
              <button
                key={String(key)}
                type="button"
                aria-pressed={active}
                onClick={() => setOwner(key)}
                style={{ ...colors, whiteSpace: "nowrap" }}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-black px-2.5 py-1 text-xs font-bold ${a ? "pl-1" : ""}`}
              >
                {a && <span aria-hidden="true"><UserAvatar appearance={a} size="xs" /></span>}
                {label}
                <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/25" : "bg-black/10"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {clientFilter !== null && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="gos-muted">Solo el cliente:</span>
          <button type="button" onClick={() => setClientFilter(null)} aria-label="Quitar filtro de cliente" className="gos-pill gos-pill-ghost">
            <span aria-hidden="true">👤</span> {clientFilter === 0 ? "Sin cliente" : filterClient?.client_name || "Sin nombre"} <X size={12} />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-3">
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
                  {visible.map((d) => {
                    const open = openDoc?.id === d.id;
                    const madeBy = d.created_by != null ? appearanceOf(d.created_by) : null;
                    return (
                      <li key={d.id} className="gos-card overflow-hidden" data-open={open} style={isAdmin && madeBy ? { borderLeft: `6px solid ${madeBy.color.bg}` } : undefined}>
                        <button type="button" onClick={() => toggleDoc(d)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-left sm:px-4">
                          <span aria-hidden="true" className="text-2xl leading-none">
                            📄
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-bold text-white">{d.title}</span>
                            <span className="gos-muted block text-xs">
                              <span aria-hidden="true">👤</span> {d.client_name || "Sin cliente"} · {d.versions_count} {d.versions_count === 1 ? "versión" : "versiones"} · {fmt(d.updated_at)}
                            </span>
                          </span>
                          {/* who made it and the badges go under the title on phones, next to it from sm */}
                          <span className="order-last flex basis-full flex-wrap items-center gap-1.5 sm:order-none sm:basis-auto">
                            {isAdmin && madeBy && d.created_by_name && (
                              <span className="inline-flex max-w-[11rem] items-center gap-1.5 text-xs font-bold text-white">
                                <UserAvatar appearance={madeBy} size="sm" />
                                <span className="truncate">{d.created_by_name}</span>
                              </span>
                            )}
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
                  {!visible.length && (
                    <li className="gos-muted rounded-2xl border-2 border-dashed border-slate-700 p-6 text-center text-sm">
                      {documents === null
                        ? "Cargando documentos…"
                        : !all.length
                          ? "Aún no hay documentos. Sube el primero."
                          : "Ningún documento coincide con estos filtros."}
                    </li>
                  )}
                </ul>
              </div>
            </div>
      </div>

      {upload && (
        <UploadDialog
          document={upload.doc}
          initialClient={upload.doc || !filterClient?.client_id ? undefined : { id: filterClient.client_id, name: filterClient.client_name, phone: filterClient.client_phone ?? null }}
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
