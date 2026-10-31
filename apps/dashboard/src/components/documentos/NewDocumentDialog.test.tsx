// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const { api } = vi.hoisted(() => ({
  api: { createNew: vi.fn(), searchAllClients: vi.fn(), createClient: vi.fn() },
}));
vi.mock("../../services/documentosApi", () => ({
  documentosAPI: api,
  versionFileUrl: (id: number, f: string) => `version/${id}/${f}`,
}));
vi.mock("./PdfPreview", () => ({ default: (p: { title: string }) => <div data-testid="pdf">{p.title}</div> }));

import NewDocumentDialog from "./NewDocumentDialog";

const DOC = {
  id: 30, title: "CONTRATO DE ALQUILER", client_id: 1, client_name: "Juan Pérez", created_by: 2, created_by_name: "Hengi",
  created_at: "2026-10-31T10:00:00Z", updated_at: "2026-10-31T10:00:00Z", latest_version: 1, approved_version: null, versions_count: 1,
  versions: [{ id: 50, version_number: 1, file_name: "c.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: 1, source: "generated", notes: null, created_at: "2026-10-31T10:00:00Z", created_by: 2, created_by_name: "Hengi", status: "draft" }],
};
const handlers = () => ({ onClose: vi.fn(), onPick: vi.fn(), onCreated: vi.fn(), onOpen: vi.fn(), onEdit: vi.fn() });

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.searchAllClients.mockResolvedValue({ data: { clients: [{ id: 1, name: "Juan Pérez", phone: "1809" }] } });
});
afterEach(cleanup);

describe("NewDocumentDialog", () => {
  it("'Desde cero con IA' sends the request (and the client), then shows the draft and its missing data", async () => {
    const h = handlers();
    api.createNew.mockResolvedValue({ data: { document: DOC, placeholders: ["NOMBRE_ARRENDADOR", "DOCUMENTO IDENTIDAD_ARRENDADOR"], staff_placeholders: ["CIUDAD_FIRMA", "NOMBRE_NOTARIO"] } });
    render(<NewDocumentDialog {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /desde cero con ia/i }));
    fireEvent.click(await screen.findByRole("button", { name: /juan pérez/i }));
    fireEvent.change(screen.getByLabelText(/nombre del documento/i), { target: { value: "Alquiler local Piantini" } });
    fireEvent.change(screen.getByLabelText(/qué necesitas/i), { target: { value: "Contrato de alquiler de un local comercial en Piantini por 2 años, RD$45,000 mensuales" } });
    fireEvent.click(screen.getByRole("button", { name: /redactar con ia/i }));
    await waitFor(() =>
      expect(api.createNew).toHaveBeenCalledWith({ title: "Alquiler local Piantini", client_id: 1, request: "Contrato de alquiler de un local comercial en Piantini por 2 años, RD$45,000 mensuales" }),
    );
    expect(await screen.findByText(/guardado como borrador/i)).toBeTruthy();
    expect(h.onCreated).toHaveBeenCalledWith(DOC);
    expect(screen.getByText(/faltan 2 datos/i)).toBeTruthy();
    expect(screen.getByText("{{NOMBRE_ARRENDADOR}}")).toBeTruthy();
    // what the team always fills is not "missing"
    expect(screen.getByText(/los llena el equipo: 2/i)).toBeTruthy();
    expect(screen.queryByText("{{CIUDAD_FIRMA}}")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /ver documento/i }));
    expect(screen.getByTestId("pdf").textContent).toBe("CONTRATO DE ALQUILER v1");
    fireEvent.click(screen.getByRole("button", { name: /cambios específicos/i }));
    expect(h.onEdit).toHaveBeenCalledWith(DOC);
    fireEvent.click(screen.getByRole("button", { name: /abrir en mis documentos/i }));
    expect(h.onOpen).toHaveBeenCalledWith(DOC);
  });

  it("a short request does not reach the server; the server's message is shown", async () => {
    render(<NewDocumentDialog {...handlers()} initialKind="ai" />);
    fireEvent.change(screen.getByLabelText(/qué necesitas/i), { target: { value: "un poder" } });
    fireEvent.click(screen.getByRole("button", { name: /redactar con ia/i }));
    expect(await screen.findByText(/con un poco más de detalle/i)).toBeTruthy();
    expect(api.createNew).not.toHaveBeenCalled();
    api.createNew.mockRejectedValue({ response: { data: { error: "La IA no respondió; intenta de nuevo" } } });
    fireEvent.change(screen.getByLabelText(/qué necesitas/i), { target: { value: "Poder especial para vender un vehículo en Santiago" } });
    fireEvent.click(screen.getByRole("button", { name: /redactar con ia/i }));
    expect(await screen.findByText("La IA no respondió; intenta de nuevo")).toBeTruthy();
  });

  it("'Documento en blanco' needs a title and sends blank: true", async () => {
    api.createNew.mockResolvedValue({ data: { document: { ...DOC, title: "Carta de autorización" }, placeholders: [], staff_placeholders: [] } });
    render(<NewDocumentDialog {...handlers()} />);
    fireEvent.click(screen.getByRole("button", { name: /documento en blanco/i }));
    fireEvent.click(screen.getByRole("button", { name: /^crear$/i }));
    expect(await screen.findByText(/ponle un nombre/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/nombre del documento/i), { target: { value: "Carta de autorización" } });
    fireEvent.click(screen.getByRole("button", { name: /^crear$/i }));
    await waitFor(() => expect(api.createNew).toHaveBeenCalledWith({ title: "Carta de autorización", blank: true }));
    expect(await screen.findByText(/guardado como borrador/i)).toBeTruthy();
    expect(screen.queryByText(/faltan/i)).toBeNull();
    expect(screen.queryByText(/los llena el equipo/i)).toBeNull();
  });

  it("'Desde un modelo' and 'Subir archivo' hand over to the page", () => {
    const h = handlers();
    render(<NewDocumentDialog {...h} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /desde un modelo/i }));
    expect(h.onPick).toHaveBeenCalledWith("model");
    fireEvent.click(within(dialog).getByRole("button", { name: /subir archivo/i }));
    expect(h.onPick).toHaveBeenCalledWith("upload");
  });
});
