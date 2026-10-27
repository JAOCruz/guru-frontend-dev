// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { gen, docs } = vi.hoisted(() => ({
  gen: { fields: vi.fn(), extract: vi.fn(), generate: vi.fn(), aiEdit: vi.fn(), aiEditDownload: vi.fn() },
  docs: { searchAllClients: vi.fn(), createClient: vi.fn() },
}));
vi.mock("./SaveAsModelButton", () => ({ default: (p: { documentId: number }) => <button>{`modelo:${p.documentId}`}</button> }));
vi.mock("../../services/documentosApi", () => ({
  generacionAPI: gen,
  documentosAPI: docs,
  fetchFile: vi.fn().mockResolvedValue("blob:pdf"),
  versionFileUrl: (id: number, f: string) => `version/${id}/${f}`,
}));

import PersonalizeDialog from "./PersonalizeDialog";

const FIELDS = [
  { key: "NOMBRE_VENDEDOR", label: "Nombre", group: "VENDEDOR" },
  { key: "DOCUMENTO IDENTIDAD_VENDEDOR", label: "Documento identidad", group: "VENDEDOR" },
  { key: "NOMBRE_COMPRADOR", label: "Nombre", group: "COMPRADOR" },
];
const DOC = { id: 30, title: "Venta Corolla", client_id: 1, client_name: "Juan Pérez", versions: [{ id: 40, version_number: 1, status: "draft" }] };

beforeEach(() => {
  Object.values(gen).forEach((f) => f.mockReset());
  Object.values(docs).forEach((f) => f.mockReset());
  docs.searchAllClients.mockResolvedValue({ data: { clients: [{ id: 1, name: "Juan Pérez", phone: "1809" }] } });
  gen.fields.mockImplementation((_s: unknown, clientId?: number, role?: string) =>
    Promise.resolve({
      data: {
        fields: FIELDS, roles: ["VENDEDOR", "COMPRADOR"], exact: false,
        prefill: clientId && role === "VENDEDOR" ? { NOMBRE_VENDEDOR: "JUAN PÉREZ", "DOCUMENTO IDENTIDAD_VENDEDOR": "402-1111111-2" } : {},
      },
    }),
  );
});
afterEach(cleanup);

describe("Personalizar — llenar con los datos del cliente", () => {
  it("client → role prefills from the legal profile → AI fills the rest → generate shows the changes", async () => {
    gen.extract.mockResolvedValue({ data: { values: { NOMBRE_COMPRADOR: "MARÍA GÓMEZ" } } });
    gen.generate.mockResolvedValue({ data: { document: DOC, exact: false, changes: [{ op: "replace", i: 1, before: "Yo, JOSE ANTONIO PEREZ", after: "Yo, JUAN PÉREZ" }] } });
    const onSaved = vi.fn();
    render(<PersonalizeDialog source={{ model_id: 7 }} title="ACTO DE VENTA" onClose={() => {}} onSaved={onSaved} />);
    fireEvent.click(await screen.findByRole("button", { name: /juan pérez/i }));
    fireEvent.change(await screen.findByLabelText(/papel del cliente/i), { target: { value: "VENDEDOR" } });
    await waitFor(() => expect((screen.getAllByLabelText(/^nombre$/i)[0] as HTMLInputElement).value).toBe("JUAN PÉREZ"));
    fireEvent.change(screen.getByLabelText(/información/i), { target: { value: "La compradora es María Gómez" } });
    fireEvent.click(screen.getByRole("button", { name: /llenar con ia/i }));
    await waitFor(() => expect((screen.getAllByLabelText(/^nombre$/i)[1] as HTMLInputElement).value).toBe("MARÍA GÓMEZ"));
    expect(gen.extract).toHaveBeenCalledWith({ model_id: 7 }, expect.objectContaining({ client_id: 1, text: "La compradora es María Gómez" }));
    fireEvent.click(screen.getByRole("button", { name: /generar documento/i }));
    await waitFor(() =>
      expect(gen.generate).toHaveBeenCalledWith(expect.objectContaining({
        model_id: 7, client_id: 1, client_role: "VENDEDOR",
        values: { NOMBRE_VENDEDOR: "JUAN PÉREZ", "DOCUMENTO IDENTIDAD_VENDEDOR": "402-1111111-2", NOMBRE_COMPRADOR: "MARÍA GÓMEZ" },
      })),
    );
    expect(await screen.findByText(/guardado como borrador/i)).toBeTruthy();
    expect(screen.getByText("Yo, JUAN PÉREZ")).toBeTruthy();
    expect(onSaved).toHaveBeenCalledWith(DOC);
    // only placing the client's data: nothing new to keep in the model
    expect(screen.queryByText(/^modelo:/)).toBeNull();
  });
});

describe("Personalizar — cambios específicos", () => {
  it("from a history version: instructions → new version with the list of changes", async () => {
    gen.aiEdit.mockResolvedValue({ data: { document: { ...DOC, template_id: 7, versions: [] }, changes: [{ op: "insert_after", i: 2, before: null, after: "SEGUNDO: Penalidad del 10%." }] } });
    render(<PersonalizeDialog source={{ version_id: 40 }} title="Venta Corolla v1" fixedClient={{ id: 1, name: "Juan Pérez", phone: null }} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /cambios específicos/i }));
    fireEvent.change(screen.getByLabelText(/qué cambios/i), { target: { value: "Agrega una penalidad del 10%" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar cambios/i }));
    await waitFor(() => expect(gen.aiEdit).toHaveBeenCalledWith(expect.objectContaining({ version_id: 40, instructions: "Agrega una penalidad del 10%" })));
    expect(await screen.findByText("SEGUNDO: Penalidad del 10%.")).toBeTruthy();
    // the new wording can become the model's next version
    expect(screen.getByText("modelo:30")).toBeTruthy();
  });

  // Leandro, 2026-10-27: el botón se quedaba apagado sin cliente y la IA no da formato
  it("sin cliente: Formato auténtico enciende el botón y descarga el Word", async () => {
    gen.aiEditDownload.mockResolvedValue({ data: new Blob(["docx"]) });
    const createObjectURL = vi.fn(() => "blob:docx");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    render(<PersonalizeDialog source={{ model_id: 7 }} title="PODER DE AUTORIZACION PARA ADUANA" onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /cambios específicos/i }));
    const button = screen.getByRole("button", { name: /dar formato y descargar/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/escribe el cambio o marca formato auténtico/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /formato auténtico/i }));
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(gen.aiEditDownload).toHaveBeenCalledWith(expect.objectContaining({ model_id: 7, autentico: true, title: "PODER DE AUTORIZACION PARA ADUANA" })));
    expect(await screen.findByText(/se descargó «PODER DE AUTORIZACION PARA ADUANA\.docx»/i)).toBeTruthy();
    expect(createObjectURL).toHaveBeenCalled();
    expect(gen.aiEdit).not.toHaveBeenCalled();
  });

  it("con cliente: cambios + Formato auténtico se guardan en su historial", async () => {
    gen.aiEdit.mockResolvedValue({ data: { document: DOC, changes: [] } });
    render(<PersonalizeDialog source={{ version_id: 40 }} title="Venta Corolla v1" fixedClient={{ id: 1, name: "Juan Pérez", phone: null }} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /cambios específicos/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /formato auténtico/i }));
    fireEvent.click(screen.getByRole("button", { name: /dar formato auténtico/i }));
    await waitFor(() => expect(gen.aiEdit).toHaveBeenCalledWith(expect.objectContaining({ version_id: 40, client_id: 1, autentico: true })));
    expect(await screen.findByText(/guardado como borrador/i)).toBeTruthy();
  });

  it("el error de una descarga se muestra", async () => {
    gen.aiEditDownload.mockRejectedValue({ response: { data: new Blob([JSON.stringify({ error: "La IA no respondió; intenta de nuevo" })]) } });
    render(<PersonalizeDialog source={{ model_id: 7 }} title="PODER" onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /cambios específicos/i }));
    fireEvent.change(screen.getByLabelText(/qué cambios/i), { target: { value: "Agrega la nacionalidad" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar y descargar/i }));
    expect(await screen.findByText("La IA no respondió; intenta de nuevo")).toBeTruthy();
  });

  it("llenar sin cliente dice qué falta", async () => {
    render(<PersonalizeDialog source={{ model_id: 7 }} title="PODER" onClose={() => {}} onSaved={() => {}} />);
    expect(await screen.findByText(/elige el cliente para generar el documento/i)).toBeTruthy();
  });

  it("muestra los cambios de formato y lo que no se pudo", async () => {
    gen.aiEdit.mockResolvedValue({ data: { document: DOC, changes: [
      { op: "format", label: "Letra Times New Roman, 12 pt (todo el documento)" },
      { op: "unsupported", label: "No se pudo: poner una marca de agua. Hazlo directamente en Word." },
    ] } });
    render(<PersonalizeDialog source={{ version_id: 40 }} title="Venta Corolla v1" fixedClient={{ id: 1, name: "Juan Pérez", phone: null }} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /cambios específicos/i }));
    fireEvent.change(screen.getByLabelText(/qué cambios/i), { target: { value: "Todo en Times 12 y marca de agua" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar cambios/i }));
    expect(await screen.findByText("Letra Times New Roman, 12 pt (todo el documento)")).toBeTruthy();
    expect(screen.getByText(/no se pudo: poner una marca de agua/i)).toBeTruthy();
  });
});
