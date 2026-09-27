// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { list, users } = vi.hoisted(() => ({
  list: vi.fn(),
  users: [
    { id: 1, name: "Administrador", username: "admin", data_column: null, role: "admin", color: "teal", avatar: "owl", is_active: true, in_payroll: false },
    { id: 2, name: "Hengi", username: "hengi", data_column: "HENGI", role: "digitador", color: "green", avatar: "cow", is_active: true, in_payroll: true },
  ],
}));
vi.mock("../services/api", () => ({ activityAPI: { list } }));
vi.mock("../context/UserColorsContext", () => ({ useUserColors: () => ({ users }) }));

import Actividad from "./Actividad";

const item = (id: number, summary: string, extra = {}) => ({
  id, created_at: new Date().toISOString(), actor_id: 1, actor_name: "admin", actor_display_name: "Administrador",
  actor_color: "teal", actor_avatar: "owl", category: "facturas", action: "invoice.approve", entity_type: "invoice",
  entity_id: "5", summary, details: { doc_number: "FAC-0388", total: 12000 }, ip: "1.2.3.4", ...extra,
});

const renderAt = (url = "/actividad") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Actividad />
    </MemoryRouter>,
  );

beforeEach(() => {
  list.mockReset();
  list.mockResolvedValue({ data: { items: [item(2, "Aprobó la factura FAC-0388 por RD$ 12,000.00")], total: 1, page: 1, page_size: 50 } });
});
afterEach(cleanup);

describe("Actividad page", () => {
  it("lists activity, newest first", async () => {
    renderAt();
    expect(await screen.findByText("Aprobó la factura FAC-0388 por RD$ 12,000.00")).toBeTruthy();
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
  });

  it("filters by category", async () => {
    renderAt();
    await screen.findByText(/Aprobó la factura/);
    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: "usuarios" } });
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ category: "usuarios", page: 1 })));
  });

  it("preselects the person from ?actor_id=", async () => {
    renderAt("/actividad?actor_id=2");
    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ actor_id: "2" })));
    expect((screen.getByLabelText(/persona/i) as HTMLSelectElement).value).toBe("2");
  });

  it("shows details when an entry is clicked", async () => {
    renderAt();
    fireEvent.click(await screen.findByText(/Aprobó la factura/));
    expect(await screen.findByText(/FAC-0388/, { selector: "pre, pre *" })).toBeTruthy();
  });

  it("loads the next page", async () => {
    list.mockResolvedValueOnce({ data: { items: [item(3, "Uno")], total: 2, page: 1, page_size: 1 } })
        .mockResolvedValueOnce({ data: { items: [item(2, "Dos")], total: 2, page: 2, page_size: 1 } });
    renderAt();
    await screen.findByText("Uno");
    fireEvent.click(screen.getByRole("button", { name: /cargar más/i }));
    expect(await screen.findByText("Dos")).toBeTruthy();
    expect(screen.getByText("Uno")).toBeTruthy();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });
});

describe("Cargar más with new activity in between", () => {
  it("does not show the same entry twice", async () => {
    list.mockResolvedValueOnce({ data: { items: [item(10, "Diez"), item(9, "Nueve")], total: 4, page: 1, page_size: 2 } })
        .mockResolvedValueOnce({ data: { items: [item(9, "Nueve"), item(8, "Ocho")], total: 5, page: 2, page_size: 2 } });
    renderAt();
    await screen.findByText("Diez");
    fireEvent.click(screen.getByRole("button", { name: /cargar más/i }));
    await screen.findByText("Ocho");
    expect(screen.getAllByText("Nueve")).toHaveLength(1);
  });
});
