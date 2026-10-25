// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { api, auth, dialogs } = vi.hoisted(() => ({
  dialogs: { notify: vi.fn(), confirmDialog: vi.fn(() => Promise.resolve(true)) },
  api: { get: vi.fn(), post: vi.fn() },
  auth: { isAdmin: true, user: { id: 1, username: "admin", role: "admin" } },
}));
vi.mock("../services/api", () => ({ default: api }));
vi.mock("../lib/dialogs", () => dialogs);
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/UserColorsContext", async () => {
  const { toAppearance } = await import("../lib/userColors");
  return { useUserColors: () => ({ users: [], refresh: vi.fn(), appearanceOf: () => toAppearance(undefined), appearanceOfColumn: () => toAppearance(undefined) }) };
});

import Cases from "./Cases";

const row = (id: number, title: string, status: string, tag?: string) => ({
  id, case_number: `CASO-${id}`, title, status, client_id: 1, user_id: null, created_at: "2026-10-01T10:00:00Z",
  tags: tag ? [{ tag_type: "complaint", tag_value: tag }] : [], client_name: "Ana Gómez",
});
const fetchMock = vi.fn();

beforeEach(() => {
  api.get.mockResolvedValue({ data: { users: [] } });
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => (url.includes("case_type=digitacion") && !url.includes("reclamaciones")
      ? [row(9, "Acto de venta", "open")]
      : [row(1, "Cobro de más", "open", "Precios altos"), row(2, "Error en contrato", "open", "Servicio erróneo"), row(3, "Ya resuelto", "resolved")]),
  }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const tab = (name: RegExp) => screen.getByRole("tab", { name });

describe("Casos — list", () => {
  it("Abiertos/Resueltos are tabs with counts", async () => {
    render(<Cases />);
    await screen.findByText("Cobro de más");
    expect(tab(/abiertos/i).textContent).toMatch(/2/);
    expect(tab(/resueltos/i).textContent).toMatch(/1/);
    fireEvent.click(tab(/resueltos/i));
    expect(screen.getByText("Ya resuelto")).toBeTruthy();
    expect(screen.queryByText("Cobro de más")).toBeNull();
  });

  it("the section is one compact picker", async () => {
    render(<Cases />);
    await screen.findByText("Cobro de más");
    fireEvent.change(screen.getByLabelText(/sección/i), { target: { value: "digitacion" } });
    expect(await screen.findByText("Acto de venta")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("case_type=digitacion"), expect.anything()));
  });

  it("complaint types are folded filters with removable chips", async () => {
    render(<Cases />);
    await screen.findByText("Cobro de más");
    fireEvent.click(screen.getByRole("button", { name: /^filtros/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /precios altos/i }));
    expect(screen.queryByText("Error en contrato")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /quitar filtro: precios altos/i }));
    expect(screen.getByText("Error en contrato")).toBeTruthy();
  });

  it("rows show the case number and the client", async () => {
    render(<Cases />);
    const title = await screen.findByText("Cobro de más");
    const li = title.closest("li")!;
    expect(li.textContent).toMatch(/CASO-1/);
    expect(li.textContent).toMatch(/Ana Gómez/);
  });
});

describe("Casos — from a notification", () => {
  afterEach(() => window.history.pushState({}, "", "/"));

  it("?case= opens that case in its section, even when it is resolved", async () => {
    window.history.pushState({}, "", "/cases?case=9");
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string) =>
      /\/api\/cases\/9$/.test(url)
        ? { ok: true, json: async () => ({ case: { ...row(9, "Acto de venta", "resolved"), case_type: "digitacion", tags: undefined, description: "Venta de carro" } }) }
        : base(url));
    render(<Cases />);
    expect(await screen.findByRole("heading", { name: "Acto de venta" })).toBeTruthy();
    expect(await screen.findByText("Venta de carro")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("case_type=digitacion"), expect.anything()));
    expect((screen.getByLabelText(/sección/i) as HTMLSelectElement).value).toBe("digitacion");
    expect(tab(/resueltos/i).getAttribute("aria-selected")).toBe("true");
  });

  it("a case that is gone says so", async () => {
    window.history.pushState({}, "", "/cases?case=77");
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string) => (/\/api\/cases\/77$/.test(url) ? { ok: false, status: 404, json: async () => ({}) } : base(url)));
    render(<Cases />);
    await waitFor(() => expect(dialogs.notify).toHaveBeenCalledWith(expect.stringMatching(/ya no está disponible/i)));
  });
});
