// Page-styled replacements for the browser's native popups. confirmDialog() and notify()
// can be called from anywhere; <DialogHost /> (mounted once in main.tsx) renders them.

export type Tone = "success" | "error" | "info";

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // red header and button (deletions)
}

export interface ConfirmRequest extends Required<Omit<ConfirmOptions, "danger">> {
  id: number;
  message: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface State {
  confirms: ConfirmRequest[];
  toasts: Toast[];
}

let state: State = { confirms: [], toasts: [] };
let nextId = 1;
const listeners = new Set<(s: State) => void>();
const emit = () => listeners.forEach((l) => l(state));

export function subscribe(listener: (s: State) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export function confirmDialog(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const req: ConfirmRequest = {
      id: nextId++,
      message,
      title: opts.title ?? "¿Estás seguro?",
      confirmLabel: opts.confirmLabel ?? "Confirmar",
      cancelLabel: opts.cancelLabel ?? "Cancelar",
      danger: !!opts.danger,
      resolve,
    };
    state = { ...state, confirms: [...state.confirms, req] };
    emit();
  });
}

export function answerConfirm(id: number, ok: boolean) {
  const req = state.confirms.find((c) => c.id === id);
  if (!req) return;
  state = { ...state, confirms: state.confirms.filter((c) => c.id !== id) };
  emit();
  req.resolve(ok);
}

export function notify(message: string, tone: Tone = "error") {
  const toast = { id: nextId++, message, tone };
  state = { ...state, toasts: [...state.toasts, toast] };
  emit();
  setTimeout(() => dismissToast(toast.id), tone === "error" ? 6000 : 4000);
}

export function dismissToast(id: number) {
  if (!state.toasts.some((t) => t.id === id)) return;
  state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
  emit();
}
