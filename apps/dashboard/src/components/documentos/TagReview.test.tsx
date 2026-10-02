// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const { tags, dialogs } = vi.hoisted(() => ({
  tags: { summary: vi.fn(), startBatch: vi.fn(), aiTag: vi.fn() },
  dialogs: { confirmDialog: vi.fn(() => Promise.resolve(true)), notify: vi.fn() },
}));
vi.mock("../../services/etiquetasApi", async (orig) => ({ ...(await orig<object>()), etiquetasAPI: tags }));
vi.mock("../../lib/dialogs", () => dialogs);
vi.mock("./TagEditor", () => ({
  default: (p: { modelId: number; mode: string }) => <div data-testid="editor">{`${p.mode}:${p.modelId}`}</div>,
}));

import TagReview from "./TagReview";

const IDLE = { running: false, total: 0, done: 0, failed: [], current: null, finished_at: null };
const MODELS = [
  { id: 1, name: "ACTO DE VENTA", category: "Vehículos", status: "approved", latest_version: 2, taggable: true },
  { id: 2, name: "PODER", category: "Poderes", status: "pending", latest_version: 1, taggable: true },
  { id: 3, name: "CONTRATO", category: "Alquiler", status: "untagged", latest_version: null, taggable: true },
  { id: 4, name: "VIEJO", category: "Otros", status: "untagged", latest_version: null, taggable: false },
];
const summary = (batch = IDLE) => ({ data: { counts: { untagged: 2, pending: 1, approved: 1 }, models: MODELS, batch } });

beforeEach(() => {
  Object.values(tags).forEach((f) => f.mockReset());
  dialogs.confirmDialog.mockClear();
  tags.summary.mockResolvedValue(summary());
});
afterEach(cleanup);

describe("Revisión de etiquetas", () => {
  it("counts per status and filters by clicking a counter", async () => {
    render(<TagReview />);
    const pend = await screen.findByRole("button", { name: /pendiente de revisión\s*1/i });
    expect(screen.getByRole("button", { name: /sin etiquetar\s*2/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /aprobado\s*1/i })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    fireEvent.click(pend);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("PODER")).toBeTruthy();
  });

  it("each row offers the right action; Revisar opens the editor", async () => {
    render(<TagReview />);
    const row = (name: string) => screen.getByText(name).closest("li")!;
    await screen.findByText("ACTO DE VENTA");
    expect(within(row("CONTRATO")).getByRole("button", { name: /etiquetar con ia/i })).toBeTruthy();
    expect(within(row("VIEJO")).getByText(/sin word/i)).toBeTruthy();
    fireEvent.click(within(row("PODER")).getByRole("button", { name: /revisar/i }));
    expect(screen.getByTestId("editor").textContent).toBe("review:2");
  });

  it("AI-tags one model, then opens it for review", async () => {
    tags.aiTag.mockResolvedValue({ data: { model: { id: 3 } } });
    render(<TagReview />);
    await screen.findByText("CONTRATO");
    fireEvent.click(within(screen.getByText("CONTRATO").closest("li")!).getByRole("button", { name: /etiquetar con ia/i }));
    await waitFor(() => expect(tags.aiTag).toHaveBeenCalledWith(3));
    expect(await screen.findByTestId("editor")).toBeTruthy();
    expect(screen.getByTestId("editor").textContent).toBe("review:3");
  });

  it("the batch asks first, then shows its progress", async () => {
    tags.startBatch.mockResolvedValue({ data: { batch: { ...IDLE, running: true, total: 2 } } });
    tags.summary.mockResolvedValueOnce(summary()).mockResolvedValue(summary({ ...IDLE, running: true, total: 2, done: 1, current: "CONTRATO" }));
    render(<TagReview />);
    fireEvent.click(await screen.findByRole("button", { name: /etiquetar todos con ia/i }));
    await waitFor(() => expect(tags.startBatch).toHaveBeenCalled());
    expect(dialogs.confirmDialog).toHaveBeenCalled();
    expect(await screen.findByText(/1 de 2/)).toBeTruthy();
    expect(screen.getByText(/contrato/i, { selector: "span" })).toBeTruthy();
  });
});
