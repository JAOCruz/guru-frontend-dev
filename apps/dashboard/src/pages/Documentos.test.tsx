// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { api, auth, downloadFile } = vi.hoisted(() => ({
  api: {
    models: vi.fn(), aiSearch: vi.fn(), clients: vi.fn(), searchAllClients: vi.fn(), createClient: vi.fn(),
    documents: vi.fn(), document: vi.fn(), upload: vi.fn(), uploadVersion: vi.fn(), approve: vi.fn(), send: vi.fn(), createNew: vi.fn(),
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
  useUserColors: () => ({
    users: [
      { id: 2, name: "Hengi", username: "hengi", role: "digitador" },
      { id: 3, name: "Sofi", username: "sofi", role: "digitador" },
      { id: 9, name: "Administración", username: "administracion", role: "digitador" },
    ],
    appearanceOf: (id: number) => ({ color: { bg: id === 2 ? "#ff0000" : "#00ff00", text: "#000000" }, name: `u${id}`, initial: "U", emoji: null }),
    refresh: vi.fn(),
  }),
}));

vi.mock("../components/documentos/TagEditor", () => ({
  default: (p: { modelId: number; mode: string }) => <div data-testid="tag-editor">{`${p.mode}:${p.modelId}`}</div>,
}));
vi.mock("../components/documentos/TagReview", () => ({
  default: (p: { initialModel?: number | null }) => <div data-testid="tag-review">{p.initialModel ?? ""}</div>,
}));
vi.mock("../components/documentos/SaveAsModelButton", () => ({ default: (p: { documentId: number }) => <button>{`como-modelo:${p.documentId}`}</button> }));

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

describe("Documentos — Inicio (menú de fichas)", () => {
  it("shows the tiles with the counters on «Mis documentos»; a tile opens its view and «Volver al menú» comes back", async () => {
    api.documents.mockResolvedValue({ data: { documents: [DOC, { ...DOC, id: 12, title: "Poder enviado", approved_version: 1, sent_at: "2026-10-01T00:00:00Z" }] } });
    renderAt();
    const menu = await screen.findByRole("navigation", { name: /menú de documentos/i });
    expect(within(menu).getByRole("button", { name: /nuevo documento/i })).toBeTruthy();
    expect(within(menu).getByRole("button", { name: /servicios/i })).toBeTruthy();
    expect(within(menu).getByRole("button", { name: /biblioteca de modelos/i })).toBeTruthy();
    const mine = within(menu).getByRole("button", { name: /mis documentos/i });
    await waitFor(() => expect(mine.textContent).toMatch(/1\s*Borradores/));
    expect(mine.textContent).toMatch(/1\s*Enviados/);
    fireEvent.click(mine);
    expect(await screen.findByRole("heading", { name: /mis documentos/i })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: /menú de documentos/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /volver al menú/i }));
    expect(await screen.findByRole("navigation", { name: /menú de documentos/i })).toBeTruthy();
  });

  it("«Servicios» opens the internal guide; «Volver al menú» returns to the tiles", async () => {
    renderAt();
    const menu = await screen.findByRole("navigation", { name: /menú de documentos/i });
    fireEvent.click(within(menu).getByRole("button", { name: /servicios/i }));
    expect(await screen.findByRole("heading", { name: /servicios/i })).toBeTruthy();
    expect(screen.getByText(/guía interna para digitadores/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /digitación/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /volver al menú/i }));
    expect(await screen.findByRole("navigation", { name: /menú de documentos/i })).toBeTruthy();
    expect(screen.queryByText(/guía interna/i)).toBeNull();
  });

  it("the ⌘K search finds models, my documents and clients", async () => {
    renderAt();
    await screen.findByRole("navigation", { name: /menú de documentos/i });
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const dialog = await screen.findByRole("dialog", { name: /buscar en documentos/i });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "poder" } });
    await waitFor(() => expect(api.models).toHaveBeenCalledWith("poder"));
    expect(await within(dialog).findByText(/modelos \(/i)).toBeTruthy();
    expect(within(dialog).getByText(/clientes \(1\)/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /juan pérez/i }));
    expect(await screen.findByRole("heading", { name: /mis documentos/i })).toBeTruthy();
  });

  it("'Nuevo documento' → 'Desde cero con IA' runs inline: steps, then the draft and its missing data", async () => {
    api.createNew.mockResolvedValue({ data: { document: { ...DOC, id: 30, title: "CONTRATO DE ALQUILER", versions: VERSIONS }, placeholders: ["NOMBRE_ARRENDADOR"], staff_placeholders: ["CIUDAD_FIRMA"] } });
    renderAt();
    const menu = await screen.findByRole("navigation", { name: /menú de documentos/i });
    fireEvent.click(within(menu).getByRole("button", { name: /nuevo documento/i }));
    const view = await screen.findByRole("region", { name: /nuevo documento/i });
    expect(screen.queryByRole("dialog")).toBeNull(); // not a modal any more
    fireEvent.click(within(view).getByRole("button", { name: /desde cero con ia/i }));
    expect(await screen.findByRole("heading", { name: /crear desde cero/i })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/qué necesitas/i), { target: { value: "Contrato de alquiler de un local comercial en Piantini por 2 años" } });
    fireEvent.click(screen.getByRole("button", { name: /redactar con ia/i }));
    await waitFor(() => expect(api.createNew).toHaveBeenCalledWith({ request: "Contrato de alquiler de un local comercial en Piantini por 2 años" }));
    expect(await screen.findByText(/guardado como borrador/i)).toBeTruthy();
    expect(screen.getByText("{{NOMBRE_ARRENDADOR}}")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /abrir en mis documentos/i }));
    expect(await screen.findByRole("heading", { name: /mis documentos/i })).toBeTruthy();
  });

  it("'Desde un modelo' goes to the library and 'Subir archivo' opens the upload dialog", async () => {
    renderAt("/documents?tab=nuevo");
    fireEvent.click(await screen.findByRole("button", { name: /desde un modelo/i }));
    expect(await screen.findByRole("heading", { name: /biblioteca de modelos/i })).toBeTruthy();
    expect(await screen.findByText("PODER ESPECIAL")).toBeTruthy();
    cleanup();
    renderAt("/documents?tab=nuevo");
    fireEvent.click(await screen.findByRole("button", { name: /subir archivo/i }));
    expect(await screen.findByRole("dialog", { name: /subir documento/i })).toBeTruthy();
  });
});

describe("Documentos — Biblioteca de modelos", () => {
  it("lists our selection, searches by name and downloads a model as Word", async () => {
    renderAt("/documents?tab=biblioteca");
    expect(await screen.findByText("PODER ESPECIAL")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/buscar modelo/i), { target: { value: "declaracion" } });
    await waitFor(() => expect(api.models).toHaveBeenCalledWith("declaracion"));
    const row = screen.getByText("DECLARACIÓN JURADA DE INGRESOS").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: /word/i }));
    expect(downloadFile).toHaveBeenCalledWith("model/1/docx", "DECLARACIÓN JURADA DE INGRESOS.docx");
  });

  it("'Buscar con IA' shows the models Gemini picked and why", async () => {
    api.aiSearch.mockResolvedValue({ data: { models: [{ ...MODELS[1], reason: "Para que alguien firme por ti" }] } });
    renderAt("/documents?tab=biblioteca");
    await screen.findByText("PODER ESPECIAL");
    fireEvent.change(screen.getByPlaceholderText(/buscar modelo/i), { target: { value: "que alguien firme por mí" } });
    fireEvent.click(screen.getByRole("button", { name: /buscar con ia/i }));
    expect(await screen.findByText(/Para que alguien firme por ti/)).toBeTruthy();
    expect(api.aiSearch).toHaveBeenCalledWith("que alguien firme por mí");
  });
});

describe("Documentos — Mis documentos", () => {
  it("la pestaña se llama «Mis documentos»", async () => {
    renderAt("/documents?tab=historial&cat=todos");
    expect(await screen.findByRole("heading", { name: /mis documentos/i })).toBeTruthy();
    expect(screen.queryByText(/historial/i)).toBeNull();
  });

  it("a document made from a model can become the model's next version; an uploaded one cannot", async () => {
    api.document.mockResolvedValueOnce({ data: { document: { ...DOC, template_id: 3, versions: VERSIONS } } });
    renderAt("/documents?tab=historial&cat=todos");
    fireEvent.click(await screen.findByRole("button", { name: /contrato de alquiler/i }));
    expect(await screen.findByText("como-modelo:10")).toBeTruthy();
    cleanup();
    renderAt("/documents?tab=historial&cat=todos");
    fireEvent.click(await screen.findByRole("button", { name: /contrato de alquiler/i }));
    expect(await screen.findByText("v2")).toBeTruthy();
    expect(screen.queryByText(/^como-modelo:/)).toBeNull();
  });

  it("the admin's notification link opens that model in Revisión de etiquetas", async () => {
    auth.isAdmin = true;
    renderAt("/documents?tab=etiquetas&model=3");
    expect((await screen.findByTestId("tag-review")).textContent).toBe("3");
  });

  it("lists every document right away, without choosing a client; employees cannot approve or filter by digitador", async () => {
    renderAt("/documents?tab=historial&cat=todos");
    fireEvent.click(await screen.findByRole("button", { name: /contrato de alquiler/i }));
    await waitFor(() => expect(api.documents).toHaveBeenCalledWith({ sort: "recent" }));
    expect(api.clients).not.toHaveBeenCalledWith("");
    expect(await screen.findByText("v2")).toBeTruthy();
    expect(screen.getAllByText(/borrador/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^aprobar v/i })).toBeNull();
    expect(screen.queryByRole("group", { name: /digitador/i })).toBeNull();
  });

  describe("Mis documentos por categoría (estilo Gurú OS)", () => {
    const DOCS = [
      { ...DOC, id: 30, title: "Declaración de soltería", template_id: 1 },
      { ...DOC, id: 31, title: "Declaración de ingresos", template_id: 1, approved_version: 1 },
      { ...DOC, id: 32, title: "Poder para viaje", template_id: 3 },
      { ...DOC, id: 33, title: "Carta subida", template_id: null },
    ];
    const tiles = () => screen.getByRole("list", { name: /categorías/i });
    beforeEach(() => api.documents.mockResolvedValue({ data: { documents: DOCS } }));

    // The real model tree: CONTRATOS CIVILES › CONTRATOS AUTENTICOS › ESTADO CIVIL…
    const PATHS = [
      { ...MODELS[0], category: "ESTADO CIVIL", category_path: ["CONTRATOS CIVILES", "CONTRATOS AUTENTICOS", "ESTADO CIVIL"] },
      { ...MODELS[1], category: "PODERES Y AUTORIZACIONES ESPECIALES", category_path: ["CONTRATOS CIVILES", "CONTRATOS AUTENTICOS", "PODERES Y AUTORIZACIONES ESPECIALES"] },
      { id: 5, name: "NOTIFICACIÓN DE SENTENCIA", file_name: "n.docx", category: "NOTIFICACIONES", category_path: ["NOTIFICACIONES"] },
    ];
    const tile = (name: RegExp) => within(tiles()).getByRole("button", { name });
    beforeEach(() => {
      api.models.mockResolvedValue({ data: { models: PATHS } });
      api.documents.mockResolvedValue({ data: { documents: [...DOCS, { ...DOC, id: 34, title: "Notificación a Pedro", template_id: 5 }] } });
    });

    it("opens on the top folders of the model tree with their counts; documents not made from a model go to «Otros documentos»", async () => {
      renderAt("/documents?tab=historial");
      await waitFor(() => expect(tile(/contratos civiles/i).textContent).toMatch(/3 documentos/));
      expect(tile(/notificaciones/i).textContent).toMatch(/1 documento\b/);
      expect(tile(/otros documentos/i).textContent).toMatch(/1 documento\b/);
      expect(tile(/todos/i).textContent).toMatch(/5 documentos/);
      expect(within(tiles()).queryByRole("button", { name: /estado civil/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /declaración de soltería/i })).toBeNull();
    });

    it("folders open like in Gurú OS down to the documents, with a path to go back up", async () => {
      renderAt("/documents?tab=historial");
      await waitFor(() => expect(tile(/contratos civiles/i).textContent).toMatch(/3/));
      fireEvent.click(tile(/contratos civiles/i));
      await waitFor(() => expect(tile(/auténticos/i).textContent).toMatch(/3 documentos/));
      fireEvent.click(tile(/auténticos/i));
      await waitFor(() => expect(tile(/estado civil/i).textContent).toMatch(/2 documentos/));
      expect(tile(/poderes y autorizaciones especiales/i).textContent).toMatch(/1 documento\b/);
      const path = screen.getByRole("navigation", { name: /ruta/i });
      expect(path.textContent).toMatch(/contratos civiles.*auténticos/i);
      fireEvent.click(tile(/estado civil/i));
      const grid = await screen.findByRole("list", { name: /^documentos$/i });
      expect(within(grid).getByRole("button", { name: /declaración de soltería/i })).toBeTruthy();
      expect(within(grid).getByRole("button", { name: /declaración de ingresos/i })).toBeTruthy();
      expect(within(grid).queryByRole("button", { name: /poder para viaje/i })).toBeNull();
      fireEvent.click(within(screen.getByRole("navigation", { name: /ruta/i })).getByRole("button", { name: /contratos civiles/i }));
      await waitFor(() => expect(tile(/auténticos/i)).toBeTruthy());
      fireEvent.click(screen.getByRole("button", { name: /^volver$/i }));
      await waitFor(() => expect(tile(/notificaciones/i)).toBeTruthy());
    });

    it("a folder with no subfolders goes straight to its documents", async () => {
      renderAt("/documents?tab=historial");
      await waitFor(() => expect(tile(/notificaciones/i).textContent).toMatch(/1/));
      fireEvent.click(tile(/notificaciones/i));
      const grid = await screen.findByRole("list", { name: /^documentos$/i });
      expect(within(grid).getByRole("button", { name: /notificación a pedro/i })).toBeTruthy();
      expect(within(grid).getAllByRole("button")).toHaveLength(1);
    });

    it("each card has a big tile with the status on it and the details below", async () => {
      renderAt("/documents?tab=historial&cat=todos");
      const card = await screen.findByRole("button", { name: /declaración de ingresos/i });
      const tile = card.querySelector(".gos-card-tile")!;
      expect(tile.textContent).toMatch(/✅\s*v1/);
      expect(card.querySelector(".gos-card-info")!.textContent).toMatch(/juan pérez/i);
    });

    it("typing a search skips the tiles and lists the matching documents", async () => {
      renderAt("/documents?tab=historial");
      await screen.findByRole("list", { name: /categorías/i });
      fireEvent.change(screen.getByLabelText(/buscar documento/i), { target: { value: "poder" } });
      expect(await screen.findByRole("button", { name: /poder para viaje/i })).toBeTruthy();
      expect(screen.queryByRole("list", { name: /categorías/i })).toBeNull();
    });
  });

  describe("el admin filtra por digitador", () => {
    const OTHERS = [
      DOC,
      { ...DOC, id: 11, title: "Poder especial", client_id: 2, client_name: "Ana Díaz", created_by: 3, created_by_name: "Sofi" },
      { ...DOC, id: 12, title: "Borrador del bot", client_id: null, client_name: null, created_by: null, created_by_name: null },
      { ...DOC, id: 13, title: "Hecho por la jefa", created_by: 7, created_by_name: "Leandra" },
    ];
    const chip = (name: RegExp) => within(screen.getByRole("group", { name: /digitador/i })).getByRole("button", { name });
    const row = (name: RegExp) => screen.queryByRole("button", { name });

    beforeEach(() => {
      auth.isAdmin = true;
      api.documents.mockResolvedValue({ data: { documents: OTHERS } });
    });

    it("chips with counts: Todos, Sin asignar, digitadores and anyone else with documents; no administracion", async () => {
      renderAt("/documents?tab=historial&cat=todos");
      await screen.findByRole("button", { name: /poder especial/i });
      expect(chip(/todos/i).textContent).toContain("4");
      expect(chip(/sin asignar/i).textContent).toContain("1");
      expect(chip(/hengi/i).textContent).toContain("1");
      expect(chip(/sofi/i).textContent).toContain("1");
      expect(chip(/leandra/i).textContent).toContain("1");
      expect(within(screen.getByRole("group", { name: /digitador/i })).queryByRole("button", { name: /administración/i })).toBeNull();
    });

    it("a chip narrows the list and wears the digitador's color", async () => {
      renderAt("/documents?tab=historial&cat=todos");
      await screen.findByRole("button", { name: /poder especial/i });
      fireEvent.click(chip(/hengi/i));
      expect(chip(/hengi/i).getAttribute("aria-pressed")).toBe("true");
      expect(chip(/hengi/i).style.backgroundColor).toBe("rgb(255, 0, 0)");
      expect(row(/contrato de alquiler/i)).toBeTruthy();
      expect(row(/poder especial/i)).toBeNull();
      fireEvent.click(chip(/sin asignar/i));
      expect(row(/borrador del bot/i)).toBeTruthy();
      expect(row(/contrato de alquiler/i)).toBeNull();
    });

    it("searches by client name and shows the client on each row; the chips count the search", async () => {
      renderAt("/documents?tab=historial&cat=todos");
      await screen.findByRole("button", { name: /poder especial/i });
      fireEvent.change(screen.getByLabelText(/buscar documento/i), { target: { value: "ana" } });
      expect(row(/poder especial/i)).toBeTruthy();
      expect(row(/contrato de alquiler/i)).toBeNull();
      expect(chip(/todos/i).textContent).toContain("1");
      expect(chip(/hengi/i).textContent).toContain("0");
      expect(screen.getByText(/ana díaz/i)).toBeTruthy();
      expect(screen.getByText(/2 versiones/)).toBeTruthy();
    });

    it("shows one card per document and opens the versions in a block of their own, next to the card", async () => {
      api.document.mockResolvedValue({ data: { document: { ...DOC, versions: VERSIONS } } });
      renderAt("/documents?tab=historial&cat=todos");
      const grid = await screen.findByRole("list", { name: /^documentos$/i });
      expect(within(grid).getAllByRole("listitem")).toHaveLength(4);
      expect(screen.getByText(/^4 documentos$/)).toBeTruthy();
      const card = within(grid).getByRole("button", { name: /contrato de alquiler/i });
      fireEvent.click(card);
      const version = await screen.findByText("v2");
      expect(card.getAttribute("aria-expanded")).toBe("true");
      expect(card.closest("li")!.contains(version)).toBe(false);
      expect(within(grid).getAllByRole("listitem").length).toBeGreaterThan(4);
      fireEvent.click(card);
      await waitFor(() => expect(screen.queryByText("v2")).toBeNull());
    });

    it("?client= narrows to that client until it is cleared; 0 is «Sin cliente»", async () => {
      renderAt("/documents?tab=historial&cat=todos&client=2");
      await screen.findByRole("button", { name: /poder especial/i });
      expect(row(/contrato de alquiler/i)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /quitar filtro de cliente/i }));
      expect(row(/contrato de alquiler/i)).toBeTruthy();
      cleanup();
      renderAt("/documents?tab=historial&cat=todos&client=0");
      await screen.findByRole("button", { name: /borrador del bot/i });
      expect(row(/poder especial/i)).toBeNull();
    });

    it("?doc= opens that document even when it is someone else's", async () => {
      api.document.mockResolvedValue({ data: { document: { ...OTHERS[1], versions: VERSIONS } } });
      renderAt("/documents?tab=historial&cat=todos&client=2&doc=11");
      expect(await screen.findByText("v2")).toBeTruthy();
      expect(api.document).toHaveBeenCalledWith(11);
    });
  });

  it("the admin approves a version", async () => {
    auth.isAdmin = true;
    render(<DialogHost />);
    api.approve.mockResolvedValue({ data: { document: { ...DOC, approved_version: 2, versions: [{ ...VERSIONS[0], status: "approved" }, VERSIONS[1]] } } });
    renderAt("/documents?tab=historial&cat=todos");
    fireEvent.click(await screen.findByRole("button", { name: /contrato de alquiler/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^aprobar v2/i }));
    const confirm = await screen.findByRole("dialog", { name: /¿aprobar v2\?/i });
    fireEvent.click(within(confirm).getByRole("button", { name: /^aprobar$/i }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(10, 21, "manual"));
    expect((await screen.findAllByText(/aprobada/i)).length).toBeGreaterThan(0);
  });

  it("uploads a document for the client in the filter (title from the file name)", async () => {
    api.upload.mockResolvedValue({ data: { document: { ...DOC, id: 11, title: "poder firmado", versions: [] } } });
    renderAt("/documents?tab=historial&cat=todos&client=1");
    await screen.findByRole("button", { name: /contrato de alquiler/i });
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
    renderAt("/documents?tab=biblioteca");
    const approved = (await screen.findByText("DECLARACIÓN JURADA DE INGRESOS")).closest("li")!;
    const pending = screen.getByText("PODER ESPECIAL").closest("li")!;
    expect(within(pending).queryByRole("button", { name: /^llenar/i })).toBeNull();
    fireEvent.click(within(approved).getByRole("button", { name: /^llenar/i }));
    expect(screen.getByTestId("tag-editor").textContent).toBe("fill:1");
  });

  it("the admin also fills pending models and sees their status", async () => {
    auth.isAdmin = true;
    api.models.mockResolvedValue({ data: { models: TAGGED } });
    renderAt("/documents?tab=biblioteca");
    const pending = (await screen.findByText("PODER ESPECIAL")).closest("li")!;
    expect(within(pending).getByText(/por publicar/i)).toBeTruthy();
    expect(within(pending).getByRole("button", { name: /^llenar/i })).toBeTruthy();
  });

  it("only the admin has the 'Revisión de etiquetas' tile", async () => {
    renderAt();
    await screen.findByRole("navigation", { name: /menú de documentos/i });
    expect(screen.queryByRole("button", { name: /revisión de etiquetas/i })).toBeNull();
    cleanup();
    auth.isAdmin = true;
    renderAt();
    fireEvent.click(await screen.findByRole("button", { name: /revisión de etiquetas/i }));
    expect(await screen.findByTestId("tag-review")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /revisión de etiquetas/i })).toBeTruthy();
  });
});

describe("Documentos — enviado por el bot", () => {
  const BOT = { ...DOC, prepared_by_bot: true, invoice_id: 7, send_mode: null, sent_at: null, send_error: null, can_approve: true };
  const openBotDoc = async (doc: Record<string, unknown>) => {
    api.documents.mockResolvedValue({ data: { documents: [doc] } });
    api.document.mockResolvedValue({ data: { document: { ...doc, versions: VERSIONS } } });
    renderAt("/documents?tab=historial&cat=todos");
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
