// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { gen, docs } = vi.hoisted(() => ({
  gen: { fields: vi.fn(), extract: vi.fn(), generate: vi.fn(), aiEdit: vi.fn() },
  docs: { searchAllClients: vi.fn(), createClient: vi.fn() },
}));
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
  });
});

describe("Personalizar — cambios específicos", () => {
  it("from a history version: instructions → new version with the list of changes", async () => {
    gen.aiEdit.mockResolvedValue({ data: { document: { ...DOC, versions: [] }, changes: [{ op: "insert_after", i: 2, before: null, after: "SEGUNDO: Penalidad del 10%." }] } });
    render(<PersonalizeDialog source={{ version_id: 40 }} title="Venta Corolla v1" fixedClient={{ id: 1, name: "Juan Pérez", phone: null }} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("tab", { name: /cambios específicos/i }));
    fireEvent.change(screen.getByLabelText(/qué cambios/i), { target: { value: "Agrega una penalidad del 10%" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar cambios/i }));
    await waitFor(() => expect(gen.aiEdit).toHaveBeenCalledWith(expect.objectContaining({ version_id: 40, instructions: "Agrega una penalidad del 10%" })));
    expect(await screen.findByText("SEGUNDO: Penalidad del 10%.")).toBeTruthy();
  });
});
