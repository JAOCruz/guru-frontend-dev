// Who may WhatsApp a quote/invoice to the client. Mirrors the backend rule in
// routes/invoices.js (send-whatsapp): employees need the admin's approval first.
export type WhatsappAction = "send" | "request" | "wait" | "none";

export function whatsappAction({ isAdmin, isOwner, status }: { isAdmin: boolean; isOwner: boolean; status: string }): WhatsappAction {
  if (status === "rejected") return "none";
  if (isAdmin) return "send";
  if (!isOwner) return "none";
  if (status === "draft") return "request";
  if (status === "pending_approval") return "wait";
  return "send";
}

// Employees only see the document (PDF/preview) once an admin approved it; mirrors the backend.
export function canViewDocument({ isAdmin, status }: { isAdmin: boolean; status: string }): boolean {
  return isAdmin || ["approved", "sent", "paid"].includes(status);
}
