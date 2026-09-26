import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: string;
  tone?: "main" | "danger";
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, tone = "main", onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="w-full max-w-md overflow-hidden rounded-base border-2 border-border bg-background shadow-shadow"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`flex items-center justify-between border-b-2 border-border px-5 py-3 font-heading text-lg font-black text-white ${
          tone === "danger" ? "bg-red-500" : "bg-main"
        }`}
      >
        {title}
        <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-base p-1 hover:bg-white/20">
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

export default Modal;

export const fieldCls =
  "mt-1 w-full rounded-base border-2 border-border bg-white px-3 py-2 font-base text-sm text-foreground focus:outline-none";
export const labelCls = "block text-sm font-bold";
