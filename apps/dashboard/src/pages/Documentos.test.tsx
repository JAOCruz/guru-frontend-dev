// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { api, auth, downloadFile } = vi.hoisted(() => ({
  api: {
    models: vi.fn(), aiSearch: vi.fn(), clients: vi.fn(), searchAllClients: vi.fn(), createClient: vi.fn(),
    documents: vi.fn(), document: vi.fn(), upload: vi.fn(), uploadVersion: vi.fn(), approve: vi.fn(), send: vi.fn(),
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

vi.mock("../components/documentos/TagEditor", () => ({
  default: (p: { modelId: number; mode: string }) => <div data-testid="tag-editor">{`${p.mode}:${p.modelId}`}</div>,
}));
vi.mock("../components/documentos/TagReview", () => ({ default: () => <div data-testid="tag-review" /> }));

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
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(10, 21, "manual"));
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

describe("Documentos — Etiquetas", () => {
  const TAGGED = [
    { ...MODELS[0], tag_status: "approved" },
    { ...MODELS[1], tag_status: "pending" },
  ];

  it("employees get 'Llenar' only on approved models; it opens the fill editor", async () => {
    api.models.mockResolvedValue({ data: { models: TAGGED } });
    renderAt();
    const approved = (await screen.findByText("DECLARACIÓN JURADA DE INGRESOS")).closest("li")!;
    const pending = screen.getByText("PODER ESPECIAL").closest("li")!;
    expect(within(approved).getByText(/listo para llenar/i)).toBeTruthy();
    expect(within(pending).queryByRole("button", { name: /^llenar/i })).toBeNull();
    fireEvent.click(within(approved).getByRole("button", { name: /^llenar/i }));
    expect(screen.getByTestId("tag-editor").textContent).toBe("fill:1");
  });

  it("the admin also fills pending models and sees their status", async () => {
    auth.isAdmin = true;
    api.models.mockResolvedValue({ data: { models: TAGGED } });
    renderAt();
    const pending = (await screen.findByText("PODER ESPECIAL")).closest("li")!;
    expect(within(pending).getByText(/pendiente de revisión/i)).toBeTruthy();
    expect(within(pending).getByRole("button", { name: /^llenar/i })).toBeTruthy();
  });

  it("only the admin has the 'Revisión de etiquetas' tab", async () => {
    renderAt();
    await screen.findByText("PODER ESPECIAL");
    expect(screen.queryByRole("tab", { name: /revisión de etiquetas/i })).toBeNull();
    cleanup();
    auth.isAdmin = true;
    renderAt();
    fireEvent.click(await screen.findByRole("tab", { name: /revisión de etiquetas/i }));
    expect(await screen.findByTestId("tag-review")).toBeTruthy();
  });
});

describe("Documentos — enviado por el bot", () => {
  const BOT = { ...DOC, prepared_by_bot: true, invoice_id: 7, send_mode: null, sent_at: null, send_error: null, can_approve: true };
  const openBotDoc = async (doc: Record<string, unknown>) => {
    api.documents.mockResolvedValue({ data: { documents: [doc] } });
    api.document.mockResolvedValue({ data: { document: { ...doc, versions: VERSIONS } } });
    renderAt("/documents?tab=historial");
    fireEvent.click(await screen.findByRole("button", { name: /juan pérez/i }));
    fireEvent.click(await screen.findByRole("button", { name: /contrato de alquiler/i }));
    await screen.findByText("v2");
  };

  it("shows 'Preparado por el bot' with a link to the cotización", async () => {
    await openBotDoc(BOT);
    expect(screen.getAllByText(/preparado por el bot/i).length).toBeGreaterThan(0);
    const link = screen.getByRole("link", { name: /cotización/i });
    expect(link.getAttribute("href")).toContain("7");
  });

  it("approve dialog defaults to 'Enviar cuando pague' with a cotización and sends al_pagar", async () => {
    render(<DialogHost />);
    api.approve.mockResolvedValue({ data: { document: { ...BOT, approved_version: 2, versions: VERSIONS }, sent: false } });
    await openBotDoc(BOT);
    fireEvent.click(screen.getByRole("button", { name: /^aprobar v2/i }));
    const dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByLabelText(/enviar cuando pague/i) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: /^aprobar$/i }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(10, 21, "al_pagar"));
  });

  it("'Enviar ya' and 'Solo aprobar' map to ya / manual; no cotización defaults to manual", async () => {
    api.approve.mockResolvedValue({ data: { document: { ...BOT, approved_version: 2, versions: VERSIONS }, sent: true } });
    await openBotDoc(BOT);
    fireEvent.click(screen.getByRole("button", { name: /^aprobar v2/i }));
    let dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText(/enviar ya/i));
    fireEvent.click(within(dialog).getByRole("button", { name: /^aprobar$/i }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(10, 21, "ya"));
    cleanup();
    api.approve.mockClear();
    await openBotDoc({ ...BOT, invoice_id: null });
    fireEvent.click(screen.getByRole("button", { name: /^aprobar v2/i }));
    dialog = await screen.findByRole("dialog");
    expect((within(dialog).getByLabelText(/solo aprobar/i) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: /^aprobar$/i }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(10, 21, "manual"));
  });

  it("a linked cotización already paid: warns under 'Enviar cuando pague' and defaults to 'Solo aprobar'", async () => {
    api.approve.mockResolvedValue({ data: { document: { ...BOT, approved_version: 2, versions: VERSIONS }, sent: false } });
    await openBotDoc({ ...BOT, invoice_status: "paid" });
    fireEvent.click(screen.getByRole("button", { name: /^aprobar v2/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("La cotización ya está pagada: se envía al aprobar.")).toBeTruthy();
    expect((within(dialog).getByLabelText(/solo aprobar/i) as HTMLInputElement).checked).toBe(true);
    expect((within(dialog).getByLabelText(/enviar cuando pague/i) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: /^aprobar$/i }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(10, 21, "manual"));
  });

  it("a pending cotización keeps the normal hint and 'Enviar cuando pague' default", async () => {
    await openBotDoc({ ...BOT, invoice_status: "pending_approval" });
    fireEvent.click(screen.getByRole("button", { name: /^aprobar v2/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(/ya está pagada/i)).toBeNull();
    expect((within(dialog).getByLabelText(/enviar cuando pague/i) as HTMLInputElement).checked).toBe(true);
  });

  it("approve controls follow can_approve (digitador without permission sees none)", async () => {
    await openBotDoc({ ...BOT, can_approve: false });
    expect(screen.queryByRole("button", { name: /^aprobar v/i })).toBeNull();
  });

  it("a digitador with can_approve can approve", async () => {
    await openBotDoc(BOT);
    expect(screen.getByRole("button", { name: /^aprobar v2/i })).toBeTruthy();
  });

  it("'Enviar al cliente' on approved, unsent docs calls send", async () => {
    render(<DialogHost />);
    api.send.mockResolvedValue({ data: { document: { ...BOT, approved_version: 2, sent_at: "2026-10-02T10:00:00Z", versions: VERSIONS }, sent: true } });
    await openBotDoc({ ...BOT, approved_version: 2, send_mode: "manual" });
    fireEvent.click(screen.getByRole("button", { name: /^enviar al cliente$/i }));
    await waitFor(() => expect(api.send).toHaveBeenCalledWith(10));
    expect(screen.queryByRole("dialog")).toBeNull(); // approved with a send mode: no question
    expect((await screen.findAllByText(/^Enviado /)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^enviar al cliente$/i })).toBeNull();
  });

  // M2: a document approved before phase 2 has no send_mode; sending it is a deliberate choice
  it("'Enviar al cliente' on a document approved before phase 2 (no send_mode) asks first", async () => {
    render(<DialogHost />);
    api.send.mockResolvedValue({ data: { document: { ...BOT, approved_version: 2, sent_at: "2026-10-02T10:00:00Z", versions: VERSIONS }, sent: true } });
    await openBotDoc({ ...BOT, approved_version: 2, send_mode: null });
    fireEvent.click(screen.getByRole("button", { name: /^enviar al cliente$/i }));
    const dlg = await screen.findByRole("dialog", { name: /enviar al cliente/i });
    expect(within(dlg).getByText(/este documento se aprobó antes; ¿enviarlo ahora al cliente por whatsapp\?/i)).toBeTruthy();
    expect(api.send).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: /^cancelar$/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.send).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^enviar al cliente$/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^enviar al cliente$/i }));
    const again = await screen.findByRole("dialog", { name: /enviar al cliente/i });
    fireEvent.click(within(again).getByRole("button", { name: /^enviar$/i }));
    await waitFor(() => expect(api.send).toHaveBeenCalledWith(10));
    expect((await screen.findAllByText(/^Enviado /)).length).toBeGreaterThan(0);
  });

  // T3: "Enviar cuando pague" needs a cotización to wait for
  it("the approve dialog hides 'Enviar cuando pague' when the document has no cotización", async () => {
    api.approve.mockResolvedValue({ data: { document: { ...BOT, invoice_id: null, approved_version: 2, versions: VERSIONS }, sent: false } });
    await openBotDoc({ ...BOT, invoice_id: null });
    fireEvent.click(screen.getByRole("button", { name: /^aprobar v2/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText(/enviar cuando pague/i)).toBeNull();
    expect(within(dialog).getByLabelText(/enviar ya/i)).toBeTruthy();
    expect((within(dialog).getByLabelText(/solo aprobar/i) as HTMLInputElement).checked).toBe(true);
    cleanup();
    await openBotDoc(BOT);
    fireEvent.click(screen.getByRole("button", { name: /^aprobar v2/i }));
    expect(within(await screen.findByRole("dialog")).getByLabelText(/enviar cuando pague/i)).toBeTruthy();
  });

  it("shows 'Enviado {fecha}' and the 24 h notice", async () => {
    await openBotDoc({ ...BOT, approved_version: 2, sent_at: "2026-10-02T10:00:00Z" });
    expect(screen.getByText(/^Enviado /)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^enviar al cliente$/i })).toBeNull();
    cleanup();
    await openBotDoc({ ...BOT, approved_version: 2, send_error: "WINDOW_CLOSED" });
    expect(screen.getByText(/pasaron más de 24 h/i)).toBeTruthy();
  });
});
