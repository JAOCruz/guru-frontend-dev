// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";

const { tags, docs, scrollTo, dialogs } = vi.hoisted(() => ({
  tags: { model: vi.fn(), fill: vi.fn(), edit: vi.fn(), approve: vi.fn(), restore: vi.fn(), profile: vi.fn(), extract: vi.fn(), aiEdit: vi.fn() },
  docs: { searchAllClients: vi.fn(), createClient: vi.fn() },
  scrollTo: vi.fn(() => 2),
  dialogs: { confirmDialog: vi.fn((_msg: string, _opts?: unknown) => Promise.resolve(true)), notify: vi.fn() },
}));

vi.mock("../../services/etiquetasApi", async (orig) => ({ ...(await orig<object>()), etiquetasAPI: tags, tagVersionFileUrl: (id: number) => `tagfile/${id}` }));
vi.mock("../../services/documentosApi", () => ({
  documentosAPI: docs,
  downloadFile: vi.fn(() => Promise.resolve()),
  versionFileUrl: (id: number, f: string) => `version/${id}/${f}`,
}));
vi.mock("../../lib/dialogs", () => dialogs);

let lastSelect: ((s: unknown) => void) | undefined;
vi.mock("./DocxView", () => ({
  default: forwardRef(function Fake(props: { url: string; values?: Record<string, string>; onTagClick?: (k: string) => void; onSelect?: (s: unknown) => void }, ref) {
    useImperativeHandle(ref, () => ({ scrollTo }));
    lastSelect = props.onSelect;
    return (
      <div data-testid="doc">
        <span data-testid="doc-url">{props.url}</span>
        <span data-testid="doc-values">{JSON.stringify(props.values || {})}</span>
        <button type="button" onClick={() => props.onTagClick?.("NOMBRE_COMPRADOR")}>chip comprador</button>
      </div>
    );
  }),
}));

import TagEditor from "./TagEditor";

const TAGS = [
  { key: "NOMBRE_VENDEDOR", label: "Nombre (vendedor)", group: "VENDEDOR", example: "JOSE PEREZ" },
  { key: "NOMBRE_COMPRADOR", label: "Nombre (comprador)", group: "COMPRADOR", example: "MARIA LOPEZ" },
  { key: "PRECIO_VENTA_NUMEROS", label: "Precio en números", group: "DOCUMENTO", example: "RD$100" },
  { key: "PRECIO_VENTA_LETRAS", label: "Precio en letras", group: "DOCUMENTO", example: "CIEN" },
];
const V2 = { id: 12, template_id: 7, version_number: 2, tags: TAGS, skipped: [], source: "edit", notes: null, created_at: "2026-10-01T10:00:00Z", created_by_name: "Leandro", approved_at: "2026-10-01T12:00:00Z", approved_by_name: "Leandro" };
const APPROVED = { id: 7, name: "ACTO DE VENTA", category: "Vehículos", status: "approved", current: V2, approved: V2 };

beforeEach(() => {
  [...Object.values(tags), ...Object.values(docs)].forEach((f) => f.mockReset());
  scrollTo.mockClear();
  dialogs.confirmDialog.mockClear();
  docs.searchAllClients.mockResolvedValue({ data: { clients: [{ id: 1, name: "Juan Pérez", phone: "1809" }, { id: 2, name: "Ana Díaz", phone: "1829" }] } });
  tags.profile.mockResolvedValue({ data: { profile: { NOMBRE: "JUAN PÉREZ" } } });
});
afterEach(cleanup);

describe("Llenar un modelo aprobado", () => {
  it("shows the document info and the tags grouped by role, empty or filled", async () => {
    tags.model.mockResolvedValue({ data: { model: APPROVED } });
    render(<TagEditor modelId={7} mode="fill" onClose={() => {}} />);
    expect(await screen.findByRole("heading", { name: "ACTO DE VENTA" })).toBeTruthy();
    expect(screen.getByText(/vehículos/i)).toBeTruthy();
    expect(screen.getByText("v2")).toBeTruthy();
    expect(screen.getByText(/aprobado por leandro/i)).toBeTruthy();
    expect(screen.getByText("0 de 4 llenas")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Vendedor" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Datos generales" })).toBeTruthy();
    expect(screen.getByTestId("doc-url").textContent).toBe("tagfile/12");
  });

  it("typing a value updates the document live; clicking a tag goes to it (next place on repeat)", async () => {
    tags.model.mockResolvedValue({ data: { model: APPROVED } });
    render(<TagEditor modelId={7} mode="fill" onClose={() => {}} />);
    fireEvent.change(await screen.findByLabelText("Nombre (comprador)"), { target: { value: "MARÍA GÓMEZ" } });
    expect(JSON.parse(screen.getByTestId("doc-values").textContent!)).toEqual({ NOMBRE_COMPRADOR: "MARÍA GÓMEZ" });
    expect(screen.getByText("1 de 4 llenas")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /ir a nombre \(vendedor\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /ir a nombre \(vendedor\)/i }));
    expect(scrollTo.mock.calls).toEqual([["NOMBRE_VENDEDOR", 0], ["NOMBRE_VENDEDOR", 1]]);
  });

  it("clicking a chip in the document focuses its field", async () => {
    tags.model.mockResolvedValue({ data: { model: APPROVED } });
    render(<TagEditor modelId={7} mode="fill" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "chip comprador" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Nombre (comprador)")));
  });

  it("client + role fill that role from the legal profile; numbers can be written in words", async () => {
    tags.model.mockResolvedValue({ data: { model: APPROVED } });
    render(<TagEditor modelId={7} mode="fill" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /juan pérez/i }));
    fireEvent.change(screen.getByLabelText(/el cliente es/i), { target: { value: "VENDEDOR" } });
    await waitFor(() => expect((screen.getByLabelText("Nombre (vendedor)") as HTMLInputElement).value).toBe("JUAN PÉREZ"));
    expect(tags.profile).toHaveBeenCalledWith(1);
    fireEvent.change(screen.getByLabelText("Precio en números"), { target: { value: "RD$100,000.00" } });
    fireEvent.click(screen.getByRole("button", { name: "En letras" }));
    expect((screen.getByLabelText("Precio en letras") as HTMLInputElement).value).toBe("CIEN MIL PESOS DOMINICANOS");
  });

  it("generate warns about empty tags, saves to the history and offers the downloads", async () => {
    tags.model.mockResolvedValue({ data: { model: APPROVED } });
    tags.fill.mockResolvedValue({ data: { document: { id: 30, title: "Venta Juan", client_id: 1, versions: [{ id: 40 }] }, empty: 3 } });
    const onSaved = vi.fn();
    render(<TagEditor modelId={7} mode="fill" onClose={() => {}} onSaved={onSaved} />);
    fireEvent.click(await screen.findByRole("button", { name: /juan pérez/i }));
    fireEvent.change(screen.getByLabelText(/el cliente es/i), { target: { value: "VENDEDOR" } });
    await waitFor(() => expect((screen.getByLabelText("Nombre (vendedor)") as HTMLInputElement).value).toBe("JUAN PÉREZ"));
    fireEvent.click(screen.getByRole("button", { name: /generar y guardar para/i }));
    await waitFor(() => expect(tags.fill).toHaveBeenCalled());
    expect(dialogs.confirmDialog.mock.calls[0][0]).toMatch(/3 etiquetas/);
    expect(tags.fill).toHaveBeenCalledWith(7, { values: { NOMBRE_VENDEDOR: "JUAN PÉREZ" }, client_id: 1, client_role: "VENDEDOR", title: "ACTO DE VENTA", version_id: 12 });
    expect(await screen.findByText(/guardado en el historial/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /descargar word/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /descargar pdf/i })).toBeTruthy();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 30 }));
  });

  it("changing the client clears what the previous client's profile filled", async () => {
    tags.model.mockResolvedValue({ data: { model: APPROVED } });
    tags.profile.mockImplementation((id: number) => Promise.resolve({ data: { profile: id === 1 ? { NOMBRE: "JUAN PÉREZ" } : {} } }));
    render(<TagEditor modelId={7} mode="fill" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /juan pérez/i }));
    fireEvent.change(screen.getByLabelText(/el cliente es/i), { target: { value: "VENDEDOR" } });
    await waitFor(() => expect((screen.getByLabelText("Nombre (vendedor)") as HTMLInputElement).value).toBe("JUAN PÉREZ"));
    fireEvent.change(screen.getByLabelText("Nombre (comprador)"), { target: { value: "MARÍA" } });
    fireEvent.click(screen.getByRole("button", { name: /cambiar/i }));
    fireEvent.click(await screen.findByRole("button", { name: /ana díaz/i }));
    fireEvent.change(screen.getByLabelText(/el cliente es/i), { target: { value: "VENDEDOR" } });
    await waitFor(() => expect(tags.profile).toHaveBeenLastCalledWith(2));
    expect((screen.getByLabelText("Nombre (vendedor)") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Nombre (comprador)") as HTMLInputElement).value).toBe("MARÍA"); // typed by hand: kept
  });

  it("'Llenar con IA' reads into the tags of the version on screen", async () => {
    tags.model.mockResolvedValue({ data: { model: APPROVED } });
    tags.extract.mockResolvedValue({ data: { values: { NOMBRE_COMPRADOR: "ANA" } } });
    render(<TagEditor modelId={7} mode="fill" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /llenar con ia \(/i }));
    fireEvent.change(screen.getByLabelText(/información del caso/i), { target: { value: "La compradora es Ana" } });
    fireEvent.click(screen.getByRole("button", { name: /^llenar con ia$/i }));
    await waitFor(() => expect((screen.getByLabelText("Nombre (comprador)") as HTMLInputElement).value).toBe("ANA"));
    expect(tags.extract).toHaveBeenCalledWith(7, { version_id: 12, client_id: undefined, text: "La compradora es Ana", files: [] });
  });

  it("without a client it does not generate", async () => {
    tags.model.mockResolvedValue({ data: { model: APPROVED } });
    render(<TagEditor modelId={7} mode="fill" onClose={() => {}} />);
    await screen.findByRole("heading", { name: "ACTO DE VENTA" });
    fireEvent.click(screen.getByRole("button", { name: /generar y guardar para/i }));
    expect(dialogs.notify).toHaveBeenCalledWith("Elige el cliente");
    expect(tags.fill).not.toHaveBeenCalled();
  });
});

describe("Revisión de etiquetas (admin)", () => {
  const V3 = { ...V2, id: 13, version_number: 3, source: "ai", approved_at: null, approved_by_name: null, skipped: [{ i: 4, text: "TERCERO: texto sin etiquetar" }] };
  const PENDING = { id: 7, name: "ACTO DE VENTA", category: "Vehículos", status: "pending", current: V3, approved: V2, versions: [V3, V2] };

  it("shows status, skipped paragraphs and versions; queued edits are saved as one new version", async () => {
    tags.model.mockResolvedValue({ data: { model: PENDING } });
    tags.edit.mockResolvedValue({ data: { model: { ...PENDING, current: { ...V3, id: 14, version_number: 4 } } } });
    render(<TagEditor modelId={7} mode="review" onClose={() => {}} />);
    expect(await screen.findByText(/pendiente de revisión/i)).toBeTruthy();
    expect(screen.getByText("TERCERO: texto sin etiquetar")).toBeTruthy();
    expect(screen.getByText(/v2 · en uso/i)).toBeTruthy();

    // select text in the document → tag it
    lastSelect!({ text: "TERCERO: el plazo es 30 días", offset: 21, length: 7, occurrence: 0, selected: "30 días", hasTags: false });
    fireEvent.change(await screen.findByLabelText(/nombre de la etiqueta/i), { target: { value: "plazo_dias" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar etiqueta/i }));
    // rename a label, remove a tag
    fireEvent.change(screen.getByLabelText("Etiqueta NOMBRE_VENDEDOR"), { target: { value: "Vendedor (nombre completo)" } });
    fireEvent.click(screen.getByRole("button", { name: /quitar nombre_comprador/i }));
    expect(screen.getByText(/3 cambios al modelo sin guardar/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /guardar como v\d+ del modelo/i }));
    await waitFor(() => expect(tags.edit).toHaveBeenCalled());
    expect(tags.edit).toHaveBeenCalledWith(7, {
      base_version_id: 13,
      notes: "",
      ops: [
        { op: "tag", text: "TERCERO: el plazo es 30 días", offset: 21, length: 7, occurrence: 0, key: "PLAZO_DIAS", label: undefined, group: "DOCUMENTO" },
        { op: "meta", key: "NOMBRE_VENDEDOR", label: "Vendedor (nombre completo)" },
        { op: "untag", key: "NOMBRE_COMPRADOR" },
      ],
    });
  });

  it("approves the latest version after confirming", async () => {
    tags.model.mockResolvedValue({ data: { model: PENDING } });
    tags.approve.mockResolvedValue({ data: { model: { ...PENDING, status: "approved", approved: V3 } } });
    render(<TagEditor modelId={7} mode="review" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /aprobar v3/i }));
    await waitFor(() => expect(tags.approve).toHaveBeenCalledWith(13));
    expect(dialogs.confirmDialog).toHaveBeenCalled();
  });

  it("a label can be cleared while typing (it does not snap back)", async () => {
    tags.model.mockResolvedValue({ data: { model: PENDING } });
    render(<TagEditor modelId={7} mode="review" onClose={() => {}} />);
    const input = (await screen.findByLabelText("Etiqueta NOMBRE_VENDEDOR")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(input.value).toBe("");
  });

  it("an older version opens read-only and can be restored", async () => {
    tags.model.mockResolvedValue({ data: { model: PENDING } });
    tags.restore.mockResolvedValue({ data: { model: PENDING } });
    render(<TagEditor modelId={7} mode="review" onClose={() => {}} />);
    const versions = await screen.findByRole("list", { name: /versiones/i });
    fireEvent.click(within(versions).getByRole("button", { name: /^v2/i }));
    expect(screen.getByTestId("doc-url").textContent).toBe("tagfile/12");
    expect(screen.queryByRole("button", { name: /aprobar/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /restaurar v2/i }));
    await waitFor(() => expect(tags.restore).toHaveBeenCalledWith(7, 12));
  });
  it("changes the wording of a selection (tags included) and saves it as a new version", async () => {
    tags.model.mockResolvedValue({ data: { model: PENDING } });
    tags.edit.mockResolvedValue({ data: { model: { ...PENDING, current: { ...V3, id: 14, version_number: 4 } } } });
    render(<TagEditor modelId={7} mode="review" onClose={() => {}} />);
    await screen.findByText(/pendiente de revisión/i);
    const text = "vende a {{NOMBRE_COMPRADOR}} el vehículo";
    lastSelect!({ text, offset: 0, length: 27, occurrence: 0, selected: "vende a {{NOMBRE_COMPRADOR}}", hasTags: true });
    // a selection with tags can only be changed as text
    expect(screen.queryByRole("button", { name: /agregar etiqueta/i })).toBeNull();
    const box = (await screen.findByLabelText(/texto nuevo/i)) as HTMLTextAreaElement;
    expect(box.value).toBe("vende a {{NOMBRE_COMPRADOR}}");
    fireEvent.change(box, { target: { value: "dona a {{NOMBRE_DONATARIO}}" } });
    fireEvent.click(screen.getByRole("button", { name: /agregar cambio/i }));
    expect(screen.getByText("dona a {{NOMBRE_DONATARIO}}")).toBeTruthy();
    expect(screen.getByText(/1 cambios al modelo sin guardar/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /guardar como v4 del modelo/i }));
    await waitFor(() => expect(tags.edit).toHaveBeenCalledWith(7, {
      base_version_id: 13,
      notes: "",
      ops: [{ op: "text", text, offset: 0, length: 27, occurrence: 0, replacement: "dona a {{NOMBRE_DONATARIO}}" }],
    }));
  });

  it("tag edits and text changes are saved separately", async () => {
    tags.model.mockResolvedValue({ data: { model: PENDING } });
    render(<TagEditor modelId={7} mode="review" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /quitar nombre_comprador/i }));
    lastSelect!({ text: "PRIMERO: algo", offset: 0, length: 7, occurrence: 0, selected: "PRIMERO", hasTags: false });
    fireEvent.click(await screen.findByRole("button", { name: /^cambiar texto$/i }));
    expect(screen.getByText(/guarda primero los cambios de etiquetas/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /agregar cambio/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Cambiar con IA: proposes changes, shows them to confirm, saves only the ones kept", async () => {
    tags.model.mockResolvedValue({ data: { model: PENDING } });
    tags.aiEdit.mockResolvedValue({ data: { base_version_id: 13, changes: [
      { op: "para", i: 1, from: "Yo, {{NOMBRE_VENDEDOR}}, vendo.", to: "Yo, {{NOMBRE_VENDEDOR}}, de nacionalidad {{NACIONALIDAD_VENDEDOR}}, vendo.", tags_added: ["NACIONALIDAD_VENDEDOR"], tags_removed: [] },
      { op: "insert", after: 3, text: "CUARTO: Elección de domicilio.", tags_added: [], tags_removed: [] },
    ] } });
    tags.edit.mockResolvedValue({ data: { model: { ...PENDING, current: { ...V3, id: 14, version_number: 4 } } } });
    render(<TagEditor modelId={7} mode="review" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /cambiar texto con ia/i }));
    fireEvent.change(screen.getByLabelText(/cambios legales/i), { target: { value: "Agrega la nacionalidad del vendedor" } });
    fireEvent.click(screen.getByRole("button", { name: /proponer cambios/i }));
    await waitFor(() => expect(tags.aiEdit).toHaveBeenCalledWith(7, "Agrega la nacionalidad del vendedor"));
    expect(await screen.findByText(/de nacionalidad \{\{NACIONALIDAD_VENDEDOR\}\}/)).toBeTruthy();
    // while a proposal is open, the usual save/approve buttons step aside
    expect(screen.queryByRole("button", { name: /aprobar v3/i })).toBeNull();
    expect(screen.getByText(/\+ NACIONALIDAD_VENDEDOR/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Incluir cambio 2"));
    fireEvent.click(screen.getByRole("button", { name: /guardar como v4 \(1 cambio\)/i }));
    await waitFor(() => expect(tags.edit).toHaveBeenCalledWith(7, {
      base_version_id: 13,
      notes: "IA: Agrega la nacionalidad del vendedor",
      ops: [{ op: "para", i: 1, from: "Yo, {{NOMBRE_VENDEDOR}}, vendo.", to: "Yo, {{NOMBRE_VENDEDOR}}, de nacionalidad {{NACIONALIDAD_VENDEDOR}}, vendo." }],
    }));
  });
});
