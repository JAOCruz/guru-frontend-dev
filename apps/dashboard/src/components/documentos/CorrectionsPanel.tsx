import { useCallback, useEffect, useState } from "react";
import { MessageSquareWarning, PencilLine, Send, Sparkles, X } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { fieldCls, labelCls } from "../users/Modal";
import { CORRECTION_LABEL, etiquetasAPI, type Correction, type CorrectionStatus } from "../../services/etiquetasApi";
import { notify } from "../../lib/dialogs";

// Corrections of a model: anyone reports the part that is wrong or could be better (a selection in the
// document plus what to change); the admin applies it (editing the text or with the AI) or dismisses it.
// Employees see their own reports and how they were resolved; the admin sees them all.
interface Props {
  modelId: number;
  versionId: number; // the version on screen
  admin: boolean;
  excerpt: string | null; // the text selected in the document
  onClearExcerpt: () => void;
  refreshKey?: number; // changes after a save that may have applied one
  active?: number | null; // admin: the correction being applied
  onApplyText?: (c: Correction) => void;
  onApplyAi?: (c: Correction) => void;
}

const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleString("es-DO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const TONE: Record<CorrectionStatus, string> = {
  pending: "bg-amber-200 text-amber-900",
  applied: "bg-green-200 text-green-900",
  dismissed: "bg-foreground/10",
};

export default function CorrectionsPanel({ modelId, versionId, admin, excerpt, onClearExcerpt, refreshKey, active, onApplyText, onApplyAi }: Props) {
  const [list, setList] = useState<Correction[] | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(!admin);
  const [dismissing, setDismissing] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(
    () =>
      etiquetasAPI
        .corrections(modelId)
        .then(({ data }) => setList(data.corrections))
        .catch(() => setList([])),
    [modelId],
  );
  useEffect(() => {
    load();
  }, [load, refreshKey]);
  // selecting text opens the form
  useEffect(() => {
    if (excerpt) setFormOpen(true);
  }, [excerpt]);

  const send = async () => {
    setBusy(true);
    try {
      await etiquetasAPI.report(modelId, { comment: comment.trim(), excerpt, version_id: versionId });
      setComment("");
      onClearExcerpt();
      if (admin) setFormOpen(false);
      notify("Corrección enviada; el administrador la revisará", "success");
      load();
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudo enviar la corrección");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (c: Correction) => {
    setBusy(true);
    try {
      await etiquetasAPI.dismiss(c.id, reason.trim());
      setDismissing(null);
      setReason("");
      load();
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudo descartar");
    } finally {
      setBusy(false);
    }
  };

  const pending = (list || []).filter((c) => c.status === "pending");
  // pending first, then the rest newest first (as the server sends them)
  const sorted = [...pending, ...(list || []).filter((c) => c.status !== "pending")];

  return (
    <section className="space-y-2 rounded-base border-2 border-border bg-background p-3" aria-label="Correcciones">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex flex-wrap items-center gap-1 text-sm font-black">
          <MessageSquareWarning size={15} className="shrink-0 text-main" /> Correcciones
          {pending.length > 0 && <span className="whitespace-nowrap rounded-base border border-border bg-amber-200 px-1.5 text-xs text-amber-900">{pending.length} pendiente{pending.length === 1 ? "" : "s"}</span>}
        </h3>
        {admin && !formOpen && (
          <button type="button" className="text-xs font-semibold underline" onClick={() => setFormOpen(true)}>
            Reportar una
          </button>
        )}
      </div>

      {formOpen && (
        <div className="space-y-2">
          {excerpt ? (
            <div className="flex items-start gap-2 rounded-base border-2 border-main bg-main/5 p-2 text-xs">
              <p className="min-w-0 flex-1 break-words">
                <span className="font-bold">Parte señalada:</span> «{excerpt}»
              </p>
              <button type="button" aria-label="Quitar la parte señalada" onClick={onClearExcerpt} className="shrink-0 rounded-base border-2 border-border p-0.5 hover:bg-red-100">
                <X size={12} />
              </button>
            </div>
          ) : (
            <p className="text-xs text-foreground/60">Selecciona en el documento la parte que está mal o se puede mejorar (opcional).</p>
          )}
          <label className={labelCls}>
            ¿Qué está mal o cómo quedaría mejor?
            <textarea
              className={fieldCls}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej. Falta la cédula del apoderado; la fecha debe ir en letras…"
            />
          </label>
          <div className="flex justify-end gap-2">
            {admin && (
              <NeoButton size="sm" variant="neutral" type="button" onClick={() => { setFormOpen(false); onClearExcerpt(); }}>
                Cancelar
              </NeoButton>
            )}
            <NeoButton size="sm" type="button" onClick={send} disabled={busy || comment.trim().length < 3}>
              <Send size={13} /> {busy ? "Enviando…" : "Enviar corrección"}
            </NeoButton>
          </div>
        </div>
      )}

      {list && !list.length && <p className="text-xs text-foreground/60">{admin ? "Nadie ha reportado correcciones en este modelo." : "Todavía no has reportado correcciones en este modelo."}</p>}
      {sorted.length > 0 && (
        <ul aria-label="Historial de correcciones" className="space-y-2">
          {sorted.map((c) => (
            <li key={c.id} className={`space-y-1 rounded-base border-2 p-2 text-xs ${active === c.id ? "border-main" : "border-border/30"}`}>
              <p className="flex flex-wrap items-center gap-1">
                <span className={`rounded-base border border-border px-1.5 font-bold ${TONE[c.status]}`}>{CORRECTION_LABEL[c.status]}</span>
                <b>{c.created_by_name || "—"}</b>
                <span className="text-foreground/60">· {fmt(c.created_at)}{c.version_number ? ` · en v${c.version_number}` : ""}</span>
              </p>
              {c.excerpt && <p className="break-words italic text-foreground/70">«{c.excerpt}»</p>}
              <p className="whitespace-pre-wrap break-words">{c.comment}</p>
              {c.status === "applied" && (
                <p className="text-green-800">✓ Aplicada en v{c.resulting_version_number ?? "?"} por {c.resolved_by_name || "admin"} · {fmt(c.resolved_at)}</p>
              )}
              {c.status === "dismissed" && (
                <p className="text-foreground/70">
                  Descartada por {c.resolved_by_name || "admin"} · {fmt(c.resolved_at)}
                  {c.resolution_note ? `: ${c.resolution_note}` : ""}
                </p>
              )}
              {admin && c.status === "pending" && (
                dismissing === c.id ? (
                  <div className="space-y-1 pt-1">
                    <input className={fieldCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (lo verá quien la reportó)" aria-label="Motivo para descartar" />
                    <div className="flex justify-end gap-1">
                      <NeoButton size="sm" variant="neutral" type="button" onClick={() => setDismissing(null)}>Cancelar</NeoButton>
                      <NeoButton size="sm" type="button" onClick={() => dismiss(c)} disabled={busy}>Descartar</NeoButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 pt-1">
                    <NeoButton size="sm" type="button" variant="neutral" onClick={() => onApplyText?.(c)} title="Selecciona el texto en el documento y cámbialo">
                      <PencilLine size={13} /> Editar texto
                    </NeoButton>
                    <NeoButton size="sm" type="button" variant="neutral" onClick={() => onApplyAi?.(c)} title="La IA propone los cambios a partir de esta corrección">
                      <Sparkles size={13} /> Corregir con IA
                    </NeoButton>
                    <NeoButton size="sm" type="button" variant="neutral" onClick={() => { setDismissing(c.id); setReason(""); }}>
                      <X size={13} /> Descartar
                    </NeoButton>
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The AI's instructions for a correction, for the admin to adjust before asking
export const aiPromptFor = (c: Correction) =>
  `${c.excerpt ? `En la parte «${c.excerpt}»: ` : ""}${c.comment}`;
