// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const { tags, dialogs } = vi.hoisted(() => ({
  tags: { corrections: vi.fn(), report: vi.fn(), dismiss: vi.fn() },
  dialogs: { confirmDialog: vi.fn(() => Promise.resolve(true)), notify: vi.fn() },
}));
vi.mock("../../services/etiquetasApi", async (orig) => ({ ...(await orig<object>()), etiquetasAPI: tags }));
vi.mock("../../lib/dialogs", () => dialogs);

import CorrectionsPanel, { aiPromptFor } from "./CorrectionsPanel";

const base = { template_id: 7, version_id: 12, version_number: 2, resolved_by_name: null, resolved_at: null, resolution_note: null, resulting_version_number: null };
const PENDING = { ...base, id: 1, excerpt: "amplio y suficiente", comment: "Falta el plazo", status: "pending", created_by_name: "Maribel", created_at: "2026-10-20T14:00:00Z" };
const APPLIED = { ...base, id: 2, excerpt: null, comment: "Fecha en letras", status: "applied", created_by_name: "Wilkin", created_at: "2026-10-18T14:00:00Z", resolved_by_name: "Leandro", resolved_at: "2026-10-19T10:00:00Z", resulting_version_number: 3 };
const DISMISSED = { ...base, id: 3, excerpt: null, comment: "Cambiar ciudad", status: "dismissed", created_by_name: "Rosanna", created_at: "2026-10-17T14:00:00Z", resolved_by_name: "Leandro", resolved_at: "2026-10-18T10:00:00Z", resolution_note: "La oficina está en Santo Domingo" };

beforeEach(() => {
  Object.values(tags).forEach((f) => f.mockReset());
  tags.corrections.mockResolvedValue({ data: { corrections: [] } });
});
afterEach(cleanup);

describe("Correcciones de un modelo", () => {
  it("a digitador sends the part they selected and what to change", async () => {
    tags.report.mockResolvedValue({ data: { correction: PENDING } });
    const clear = vi.fn();
    render(<CorrectionsPanel modelId={7} versionId={12} admin={false} excerpt="amplio y suficiente" onClearExcerpt={clear} />);
    expect(await screen.findByText(/todavía no has reportado/i)).toBeTruthy();
    expect(screen.getByText(/«amplio y suficiente»/)).toBeTruthy();
    const send = screen.getByRole("button", { name: /enviar corrección/i }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/qué está mal/i), { target: { value: "Falta el plazo" } });
    fireEvent.click(send);
    await waitFor(() => expect(tags.report).toHaveBeenCalledWith(7, { comment: "Falta el plazo", excerpt: "amplio y suficiente", version_id: 12 }));
    expect(clear).toHaveBeenCalled();
    expect(tags.corrections).toHaveBeenCalledTimes(2); // reloaded
  });

  it("the history shows who reported each one, when, and how it was resolved", async () => {
    tags.corrections.mockResolvedValue({ data: { corrections: [APPLIED, DISMISSED, PENDING] } });
    render(<CorrectionsPanel modelId={7} versionId={12} admin={false} excerpt={null} onClearExcerpt={() => {}} />);
    const items = within(await screen.findByRole("list", { name: /historial de correcciones/i })).getAllByRole("listitem");
    expect(items[0].textContent).toMatch(/Pendiente.*Maribel/); // pending first
    expect(items[1].textContent).toMatch(/Aplicada en v3 por Leandro/);
    expect(items[2].textContent).toMatch(/Descartada por Leandro.*La oficina está en Santo Domingo/);
    expect(screen.queryByRole("button", { name: /descartar/i })).toBeNull(); // employees only follow them
  });

  it("the admin applies a pending one by text or AI, or dismisses it with a reason", async () => {
    tags.corrections.mockResolvedValue({ data: { corrections: [PENDING] } });
    tags.dismiss.mockResolvedValue({ data: { correction: { ...PENDING, status: "dismissed" } } });
    const onText = vi.fn();
    const onAi = vi.fn();
    render(<CorrectionsPanel modelId={7} versionId={12} admin excerpt={null} onClearExcerpt={() => {}} onApplyText={onText} onApplyAi={onAi} />);
    expect(await screen.findByText("1 pendiente")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /editar texto/i }));
    expect(onText).toHaveBeenCalledWith(PENDING);
    fireEvent.click(screen.getByRole("button", { name: /corregir con ia/i }));
    expect(onAi).toHaveBeenCalledWith(PENDING);
    fireEvent.click(screen.getByRole("button", { name: /^descartar$/i }));
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: "Ya está así" } });
    fireEvent.click(screen.getByRole("button", { name: /^descartar$/i }));
    await waitFor(() => expect(tags.dismiss).toHaveBeenCalledWith(1, "Ya está así"));
  });

  it("the AI's instructions carry the part pointed at and the comment", () => {
    expect(aiPromptFor(PENDING as never)).toBe("En la parte «amplio y suficiente»: Falta el plazo");
    expect(aiPromptFor({ ...PENDING, excerpt: null } as never)).toBe("Falta el plazo");
  });
});
