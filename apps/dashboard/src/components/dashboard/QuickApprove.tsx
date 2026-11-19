import React, { useState } from "react";
import { botAPI } from "../../services/botApi";

// Bell notifications that ask the admin to approve a quote (never invoices, never "precios por confirmar")
export function isQuoteApproval(n: { title: string; metadata?: { invoice_id?: number } | null }): boolean {
  if (!n.metadata?.invoice_id) return false;
  return /cotizaci[oó]n (por aprobar|lista para aprobar)/i.test(n.title);
}

function reasonOf(err: unknown): string {
  const data = (err as { response?: { data?: { code?: string; status?: string } } })?.response?.data;
  if (data?.code === "PRICES_PENDING") return "Tiene precios por confirmar, ábrela";
  if (data?.code === "NOT_PENDING") return data.status === "rejected" ? "Fue rechazada" : "Ya estaba aprobada";
  return "No se pudo aprobar";
}

// "✅ Aprobar" inside a bell notification: approves the quote without opening it. Sending stays with the digitadores.
const QuickApprove: React.FC<{ invoiceId: number; onDone?: () => void }> = ({ invoiceId, onDone }) => {
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");

  const approve = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state !== "idle") return;
    setState("busy");
    try {
      await botAPI.approveInvoice(invoiceId);
      setState("done");
      onDone?.();
    } catch (err) {
      setState(reasonOf(err));
    }
  };

  if (state === "done") return <p className="mt-1 text-right text-xs font-black text-green-700">Aprobada ✓</p>;
  if (state !== "idle" && state !== "busy") {
    return <p className="mt-1 text-right text-xs font-bold text-foreground/70" onClick={(e) => e.stopPropagation()}>{state}</p>;
  }
  return (
    <div className="mt-1 flex justify-end">
      <button
        type="button"
        onClick={approve}
        disabled={state === "busy"}
        className="rounded-base border-2 border-border bg-main px-2 py-0.5 text-xs font-black text-main-foreground shadow-button transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-60"
      >
        {state === "busy" ? "Aprobando…" : "✅ Aprobar"}
      </button>
    </div>
  );
};

export default QuickApprove;
