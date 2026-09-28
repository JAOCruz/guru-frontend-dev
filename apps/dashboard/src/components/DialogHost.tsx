import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { NeoButton } from "@guru/ui";
import Modal from "./users/Modal";
import { answerConfirm, dismissToast, subscribe, type ConfirmRequest, type Toast } from "../lib/dialogs";

const TOAST_STYLE = {
  success: { cls: "bg-green-100", Icon: CheckCircle2, role: "status" },
  error: { cls: "bg-red-100", Icon: AlertTriangle, role: "alert" },
  info: { cls: "bg-background", Icon: Info, role: "status" },
} as const;

// Renders page-styled confirmations and notices (see lib/dialogs.ts)
export default function DialogHost() {
  const [confirms, setConfirms] = useState<ConfirmRequest[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(
    () =>
      subscribe((s) => {
        setConfirms(s.confirms);
        setToasts(s.toasts);
      }),
    [],
  );

  const current = confirms[0];
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && answerConfirm(current.id, false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current]);

  return (
    <>
      {current && (
        <div className="relative z-[300]">
          <Modal title={current.title} tone={current.danger ? "danger" : "main"} onClose={() => answerConfirm(current.id, false)}>
            <p className="whitespace-pre-line text-sm leading-relaxed">{current.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <NeoButton type="button" variant="neutral" onClick={() => answerConfirm(current.id, false)}>
                {current.cancelLabel}
              </NeoButton>
              <NeoButton
                type="button"
                autoFocus
                onClick={() => answerConfirm(current.id, true)}
                className={current.danger ? "bg-red-500 text-white" : ""}
              >
                {current.confirmLabel}
              </NeoButton>
            </div>
          </Modal>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-4 left-4 z-[300] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const { cls, Icon, role } = TOAST_STYLE[t.tone];
          return (
            <div
              key={t.id}
              role={role}
              className={`pointer-events-auto flex items-start gap-2 rounded-base border-2 border-border px-3 py-2.5 text-sm font-semibold shadow-shadow ${cls}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <p className="min-w-0 flex-1 break-words">{t.message}</p>
              <button type="button" onClick={() => dismissToast(t.id)} aria-label="Cerrar aviso" className="shrink-0 rounded-base p-0.5 hover:bg-black/10">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
