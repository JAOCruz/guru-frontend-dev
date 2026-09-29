// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { api, auth, downloadFile } = vi.hoisted(() => ({
  api: {
    models: vi.fn(), aiSearch: vi.fn(), clients: vi.fn(), searchAllClients: vi.fn(), createClient: vi.fn(),
    documents: vi.fn(), document: vi.fn(), upload: vi.fn(), uploadVersion: vi.fn(), approve: vi.fn(),
  },
  auth: { isAdmin: false, user: { id: 2, username: "hengi", role: "digitador" } },
  downloadFile: vi.fn(),
}));
vi.mock("../services/documentosApi", () => ({
  documentosAPI: api,
  downloadFile,
  fetchFile: vi.fn().mockResolvedValue("blob:pdf"),
  modelFileUrl: (id: number, f: string) => `model/${id}/${f}`,
  versionFileUrl: (id: number, f: string) => `version/${id}/${f}`,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/UserColorsContext", () => ({
  useUserColors: () => ({ users: [{ id: 2, name: "Hengi", username: "hengi", role: "digitador" }], refresh: vi.fn() }),
}));

import Documentos from "./Documentos";
import DialogHost from "../components/DialogHost";

const MODELS = [
  { id: 1, name: "DECLARACIÓN JURADA DE INGRESOS", file_name: "d.docx", category: "DECLARACIONES" },
  { id: 3, name: "PODER ESPECIAL", file_name: "p.docx", category: "CONTRATOS" },
];
const DOC = {
  id: 10, title: "Contrato de alquiler", client_id: 1, client_name: "Juan Pérez", created_by: 2, created_by_name: "Hengi",
  created_at: "2026-09-28T10:00:00Z", updated_at: "2026-09-29T10:00:00Z", latest_version: 2, approved_version: null, versions_count: 2,
};
const VERSIONS = [
  { id: 21, version_number: 2, file_name: "v2.pdf", mime_type: "application/pdf", size_bytes: 10, source: "upload", notes: "con cambios", created_at: "2026-09-29T10:00:00Z", created_by: 2, created_by_name: "Hengi", status: "draft" },
  { id: 20, version_number: 1, file_name: "v1.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: 10, source: "upload", notes: null, created_at: "2026-09-28T10:00:00Z", created_by: 2, created_by_name: "Hengi", status: "draft" },
];

const renderAt = (url = "/documents") => render(<MemoryRouter initialEntries={[url]}><Documentos /></MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  downloadFile.mockReset();
  auth.isAdmin = false;
  api.models.mockResolvedValue({ data: { models: MODELS } });
  api.clients.mockResolvedValue({ data: { clients: [{ id: 1, name: "Juan Pérez", phone: "1809", documents: 1 }] } });
  api.searchAllClients.mockResolvedValue({ data: { clients: [{ id: 1, name: "Juan Pérez", phone: "1809" }] } });
  api.documents.mockResolvedValue({ data: { documents: [DOC] } });
  api.document.mockResolvedValue({ data: { document: { ...DOC, versions: VERSIONS } } });
});
afterEach(cleanup);

describe("Documentos — Buscar por nombre", () => {
  it("lists our selection, searches by name and downloads a model as Word", async () => {
    renderAt();
    expect(await screen.findByText("PODER ESPECIAL")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/buscar modelo/i), { target: { value: "declaracion" } });
    await waitFor(() => expect(api.models).toHaveBeenCalledWith("declaracion"));
    const row = screen.getByText("DECLARACIÓN JURADA DE INGRESOS").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: /word/i }));
    expect(downloadFile).toHaveBeenCalledWith("model/1/docx", "DECLARACIÓN JURADA DE INGRESOS.docx");
  });

  it("'Buscar con IA' shows the models Gemini picked and why", async () => {
    api.aiSearch.mockResolvedValue({ data: { models: [{ ...MODELS[1], reason: "Para que alguien firme por ti" }] } });
    renderAt();
    await screen.findByText("PODER ESPECIAL");
    fireEvent.change(screen.getByPlaceholderText(/buscar modelo/i), { target: { value: "que alguien firme por mí" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar con ia/i }));
    expect(await screen.findByText(/Para que alguien firme por ti/)).toBeTruthy();
    expect(api.aiSearch).toHaveBeenCalledWith("que alguien firme por mí");
  });
});

describe("Documentos — Mi historial", () => {
  it("client → documents → versions; employees cannot approve", async () => {
    renderAt("/documents?tab=historial");
    fireEvent.click(await screen.findByRole("button", { name: /juan pérez/i }));
    await waitFor(() => expect(api.documents).toHaveBeenCalledWith(expect.objectContaining({ client_id: 1 })));
    fireEvent.click(await screen.findByRole("button", { name: /contrato de alquiler/i }));
    expect(await screen.findByText("v2")).toBeTruthy();
    expect(screen.getAllByText(/borrador/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^aprobar v/i })).toBeNull();
  });

  it("the admin approves a version", async () => {
    auth.isAdmin = true;
    render(<DialogHost />);
    api.approve.mockResolvedValue({ data: { document: { ...DOC, approved_version: 2, versions: [{ ...VERSIONS[0], status: "approved" }, VERSIONS[1]] } } });
    renderAt("/documents?tab=historial");
    fireEvent.click(await screen.findByRole("button", { name: /juan pérez/i }));
    fireEvent.click(await screen.findByRole("button", { name: /contrato de alquiler/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^aprobar v2/i }));
    const confirm = await screen.findByRole("dialog", { name: /¿aprobar v2\?/i });
    fireEvent.click(within(confirm).getByRole("button", { name: /^aprobar$/i }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(10, 21));
    expect((await screen.findAllByText(/aprobada/i)).length).toBeGreaterThan(0);
  });

  it("uploads a document for the selected client (title from the file name)", async () => {
    api.upload.mockResolvedValue({ data: { document: { ...DOC, id: 11, title: "poder firmado", versions: [] } } });
    renderAt("/documents?tab=historial");
    fireEvent.click(await screen.findByRole("button", { name: /juan pérez/i }));
    fireEvent.click(await screen.findByRole("button", { name: /subir documento/i }));
    const dialog = await screen.findByRole("dialog");
    const file = new File(["PK"], "poder firmado.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    fireEvent.change(within(dialog).getByLabelText(/archivo/i), { target: { files: [file] } });
    expect((within(dialog).getByLabelText(/nombre del documento/i) as HTMLInputElement).value).toBe("poder firmado");
    fireEvent.click(within(dialog).getByRole("button", { name: /^subir$/i }));
    await waitFor(() => expect(api.upload).toHaveBeenCalledWith({ file, client_id: 1, title: "poder firmado", notes: "" }));
  });
});
