// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";

const { api, refresh } = vi.hoisted(() => ({
  api: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setTempPassword: vi.fn(),
    assignments: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
  },
  refresh: vi.fn(),
}));
vi.mock("../services/api", () => ({ adminUsersAPI: api }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, username: "admin", role: "admin" }, isAdmin: true }) }));
vi.mock("../context/UserColorsContext", () => ({ useUserColors: () => ({ refresh, users: [] }) }));

import Usuarios from "./Usuarios";

const base = { email: null, data_column: null, avatar: null, must_change_password: false, last_seen: null, created_at: "2026-01-01", deactivated_at: null };
const users = [
  { ...base, id: 1, name: "Admin", username: "admin", role: "admin", color: "teal", is_active: true, in_payroll: false },
  { ...base, id: 2, name: "Hengi", username: "hengi", role: "digitador", color: "green", is_active: true, in_payroll: true },
  { ...base, id: 3, name: "Marleni", username: "marleni", role: "digitador", color: "yellow", is_active: true, in_payroll: true },
];

const row = (name: string) => screen.getByText(name, { selector: "li *" }).closest("li") as HTMLElement;

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  refresh.mockReset();
  api.list.mockResolvedValue({ data: { users } });
  api.assignments.mockResolvedValue({ data: { clients: 12, cases: 3 } });
  api.deactivate.mockResolvedValue({ data: { user: { ...users[2], is_active: false } } });
});
afterEach(cleanup);

describe("Usuarios page", () => {
  it("lists users and hides 'Desactivar' on your own row", async () => {
    render(<Usuarios />);
    await screen.findByText("Marleni");
    expect(within(row("Marleni")).getByRole("button", { name: /desactivar/i })).toBeTruthy();
    expect(within(row("admin")).queryByRole("button", { name: /desactivar/i })).toBeNull();
  });

  it("deactivates Marleni passing her assignments to Hengi", async () => {
    render(<Usuarios />);
    await screen.findByText("Marleni");
    fireEvent.click(within(row("Marleni")).getByRole("button", { name: /desactivar/i }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/12 clientes\/chats y 3 casos/);
    fireEvent.change(within(dialog).getByLabelText(/pasarlos a/i), { target: { value: "2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^desactivar$/i }));
    await waitFor(() => expect(api.deactivate).toHaveBeenCalledWith(3, 2));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the backend error message", async () => {
    api.deactivate.mockRejectedValue({ response: { data: { error: "Debe quedar al menos un administrador activo" } } });
    render(<Usuarios />);
    await screen.findByText("Marleni");
    fireEvent.click(within(row("Marleni")).getByRole("button", { name: /desactivar/i }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/12 clientes/);
    fireEvent.click(within(dialog).getByRole("button", { name: /^desactivar$/i }));
    expect(await within(dialog).findByText("Debe quedar al menos un administrador activo")).toBeTruthy();
  });

  it("creates a user with a temporary password and shows it once", async () => {
    api.create.mockResolvedValue({ data: { user: { ...base, id: 9, name: "Pedro", username: "pedro", role: "digitador", color: "blue", is_active: true, in_payroll: true, must_change_password: true } } });
    render(<Usuarios />);
    await screen.findByText("Marleni");
    fireEvent.click(screen.getByRole("button", { name: /nuevo usuario/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^nombre/i), { target: { value: "Pedro" } });
    fireEvent.change(within(dialog).getByLabelText(/^usuario/i), { target: { value: "pedro" } });
    fireEvent.change(within(dialog).getByLabelText(/contraseña temporal/i), { target: { value: "temp1234" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /crear usuario/i }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({ name: "Pedro", username: "pedro", email: "", role: "digitador", in_payroll: true, temp_password: "temp1234" }),
    );
    expect(await within(dialog).findByText("temp1234")).toBeTruthy();
  });
});
