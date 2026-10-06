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
import DialogHost from "../components/DialogHost";

const quote = (status: string) => ({
  id: 7, doc_number: "COT-7", type: "COTIZACIÓN", status, client_name: "Juan Pérez", client_phone: "18095550000",
  items: [{ desc: "Contrato", cantidad: 1, precio: 1000, itbis: false }], subtotal: 1000, itbis: 0, total: 1000,
  pdf_path: "/data/invoices/COT-7.pdf", created_at: "2026-09-28T10:00:00Z", created_by: 2, created_by_name: "Hengi",
});

const open = async (status: string, extra: Record<string, unknown> = {}) => {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === "/invoices" ? { invoices: [{ ...quote(status), ...extra }] } : { users: [] } }),
  );
  render(<MemoryRouter><Cotizaciones /><DialogHost /></MemoryRouter>);
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

describe("Cotizaciones — compact list", () => {
  const many = [
    { ...quote("pending_approval"), id: 1, client_name: "Ana" },
    { ...quote("pending_approval"), id: 2, client_name: "Beto" },
    { ...quote("draft"), id: 3, client_name: "Carla" },
    { ...quote("paid"), id: 4, client_name: "Dario" },
  ];
  const renderList = async () => {
    auth.isAdmin = true;
    api.get.mockImplementation((url: string) => Promise.resolve({ data: url === "/invoices" ? { invoices: many } : { users: [] } }));
    render(<MemoryRouter><Cotizaciones /></MemoryRouter>);
    await screen.findByText("Ana");
  };

  it("status tabs show counts and filter the list without refetching", async () => {
    await renderList();
    await new Promise((r) => setTimeout(r, 400)); // let the initial debounced load finish
    const tab = screen.getByRole("tab", { name: /por aprobar\s*2/i });
    const calls = api.get.mock.calls.length;
    fireEvent.click(tab);
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("Carla")).toBeNull();
    expect(screen.getByRole("tab", { name: /todas\s*4/i })).toBeTruthy();
    await new Promise((r) => setTimeout(r, 400));
    expect(api.get.mock.calls.filter((c) => c[0] === "/invoices").length).toBe(
      api.get.mock.calls.slice(0, calls).filter((c) => c[0] === "/invoices").length,
    );
  });

  it("advanced filters stay folded until 'Filtros' is opened; active ones show as removable chips", async () => {
    await renderList();
    expect(screen.queryByLabelText(/^tipo$/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }));
    fireEvent.change(screen.getByLabelText(/^tipo$/i), { target: { value: "FACTURA" } });
    expect(screen.getByRole("button", { name: /filtros · 1/i })).toBeTruthy();
    const chip = screen.getByRole("button", { name: /quitar filtro: facturas/i });
    fireEvent.click(chip);
    expect(screen.getByRole("button", { name: /^filtros$/i })).toBeTruthy();
  });
});

describe("Cotizaciones — aprobar y enviar (bot)", () => {
  it("the admin sees 'Aprobar y enviar' next to 'Aprobar' and it posts approve-and-send", async () => {
    auth.isAdmin = true;
    api.post.mockResolvedValue({ data: { invoice: quote("sent"), sent: true } });
    await open("pending_approval");
    expect(screen.getByRole("button", { name: /^aprobar$/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^aprobar y enviar$/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/invoices/7/approve-and-send"));
    expect(await screen.findByText(/enviada por whatsapp/i)).toBeTruthy();
  });

  it("explains the 24 h window when approve-and-send could not send", async () => {
    auth.isAdmin = true;
    api.post.mockResolvedValue({ data: { invoice: { ...quote("approved"), send_error: "WINDOW_CLOSED" }, sent: false, code: "WINDOW_CLOSED" } });
    await open("draft");
    fireEvent.click(screen.getByRole("button", { name: /^aprobar y enviar$/i }));
    expect((await screen.findAllByText(/lista, sin enviar: pasaron más de 24 h desde el último mensaje del cliente/i)).length).toBeGreaterThan(0);
  });

  it("shows 'Enviada por WhatsApp' when sent_by_bot_at is set", async () => {
    auth.isAdmin = true;
    await open("sent", { sent_by_bot_at: "2026-10-01T10:00:00Z" });
    expect((await screen.findAllByText(/enviada por whatsapp/i)).length).toBeGreaterThan(0);
  });

  it("keeps the send button next to the WINDOW_CLOSED notice, and a generic note for other errors", async () => {
    auth.isAdmin = true;
    await open("approved", { send_error: "WINDOW_CLOSED" });
    expect(await screen.findByText(/lista, sin enviar: pasaron más de 24 h/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /enviar por whatsapp/i })).toBeTruthy();
    cleanup();
    await open("approved", { send_error: "SEND_FAILED" });
    expect(await screen.findByText(/no se pudo enviar/i)).toBeTruthy();
  });

  it("employees never get 'Aprobar y enviar'", async () => {
    auth.isAdmin = false;
    await open("draft");
    expect(screen.queryByRole("button", { name: /^aprobar y enviar$/i })).toBeNull();
  });
});
