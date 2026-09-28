// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { auth, fetchFile, api } = vi.hoisted(() => ({
  auth: { isAdmin: false, user: { id: 2, username: "hengi", role: "digitador" } },
  fetchFile: vi.fn(),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("../services/api", () => ({ default: api, getAPIUrl: () => "http://api" }));
vi.mock("../services/botApi", () => ({ botAPI: { getAllClients: vi.fn().mockResolvedValue({ data: [] }), sendInvoiceWhatsapp: vi.fn() } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/UserColorsContext", async () => {
  const { toAppearance } = await import("../lib/userColors");
  return { useUserColors: () => ({ users: [], refresh: vi.fn(), appearanceOf: () => toAppearance(undefined), appearanceOfColumn: () => toAppearance(undefined) }) };
});
vi.mock("../utils", async (orig) => ({ ...(await orig<typeof import("../utils")>()), fetchAuthenticatedFile: fetchFile }));

import Cotizaciones from "./Cotizaciones";

const quote = (status: string) => ({
  id: 7, doc_number: "COT-7", type: "COTIZACIÓN", status, client_name: "Juan Pérez", client_phone: "18095550000",
  items: [{ desc: "Contrato", cantidad: 1, precio: 1000, itbis: false }], subtotal: 1000, itbis: 0, total: 1000,
  pdf_path: "/data/invoices/COT-7.pdf", created_at: "2026-09-28T10:00:00Z", created_by: 2, created_by_name: "Hengi",
});

const open = async (status: string) => {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === "/invoices" ? { invoices: [quote(status)] } : { users: [] } }),
  );
  render(<MemoryRouter><Cotizaciones /></MemoryRouter>);
  fireEvent.click((await screen.findAllByText("Juan Pérez"))[0].closest("button")!);
};

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  fetchFile.mockReset();
  fetchFile.mockResolvedValue("blob:pdf");
});
afterEach(cleanup);

describe("Cotizaciones — employee visibility", () => {
  it("an employee can't see a pending document, only its status", async () => {
    auth.isAdmin = false;
    await open("pending_approval");
    expect(await screen.findByText("Esperando aprobación del admin")).toBeTruthy();
    expect(fetchFile).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /enviar por whatsapp/i })).toBeNull();
  });

  it("an employee sees and can send the document once approved", async () => {
    auth.isAdmin = false;
    await open("approved");
    await waitFor(() => expect(fetchFile).toHaveBeenCalledWith("http://api/api/invoices/pdf/COT-7.pdf"));
    expect(screen.queryByText("Esperando aprobación del admin")).toBeNull();
    expect(screen.getByRole("button", { name: /enviar por whatsapp/i })).toBeTruthy();
  });

  it("the admin sees a pending document and can approve and send it", async () => {
    auth.isAdmin = true;
    await open("pending_approval");
    await waitFor(() => expect(fetchFile).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /aprobar y enviar por whatsapp/i })).toBeTruthy();
  });
});
