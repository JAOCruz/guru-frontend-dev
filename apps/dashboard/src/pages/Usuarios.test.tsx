// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render as rtlRender, screen, fireEvent, within, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

const render = (ui: ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const { api, refresh } = vi.hoisted(() => ({
  api: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setTempPassword: vi.fn(),
    assignments: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    setAvatar: vi.fn(),
  },
  refresh: vi.fn(),
}));
const { avatarsAPI } = vi.hoisted(() => ({ avatarsAPI: { getEnabled: vi.fn(), setEnabled: vi.fn() } }));
vi.mock("../services/api", () => ({ adminUsersAPI: api, avatarsAPI }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, username: "admin", role: "admin" }, isAdmin: true }) }));
vi.mock("../context/UserColorsContext", () => ({
  useUserColors: () => ({ refresh, users: [{ id: 2, name: "Hengi", username: "hengi", avatar: "dog", color: "green" }] }),
}));

import Usuarios from "./Usuarios";
import DialogHost from "../components/DialogHost";

const base = { email: null, data_column: null, avatar: null, must_change_password: false, last_seen: null, created_at: "2026-01-01", deactivated_at: null };
const users = [
  { ...base, id: 1, name: "Admin", username: "admin", role: "admin", color: "teal", is_active: true, in_payroll: false },
  { ...base, id: 2, name: "Hengi", username: "hengi", role: "digitador", color: "green", is_active: true, in_payroll: true },
  { ...base, id: 3, name: "Marleni", username: "marleni", role: "digitador", color: "yellow", is_active: true, in_payroll: true },
];

const row = (name: string) => screen.getByText(name, { selector: "li *" }).closest("li") as HTMLElement;

beforeEach(() => {
  avatarsAPI.getEnabled.mockReset().mockResolvedValue({ data: { enabled: ["cow"] } });
  avatarsAPI.setEnabled.mockReset().mockResolvedValue({ data: { enabled: ["cow", "sheep"] } });
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
      expect(api.create).toHaveBeenCalledWith({ name: "Pedro", username: "pedro", email: "", role: "digitador", in_payroll: true, birth_date: "", temp_password: "temp1234" }),
    );
    expect(await within(dialog).findByText("temp1234")).toBeTruthy();
  });
});

describe("Fecha de nacimiento", () => {
  it("shows the saved birth date and sends the edited one", async () => {
    api.list.mockResolvedValue({ data: { users: users.map((u) => (u.id === 2 ? { ...u, birth_date: "1990-05-12" } : u)) } });
    api.update.mockResolvedValue({ data: { user: users[1] } });
    render(<Usuarios />);
    await screen.findByText("Hengi");
    fireEvent.click(within(row("Hengi")).getByRole("button", { name: /editar/i }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(/fecha de nacimiento/i) as HTMLInputElement;
    expect(input.value).toBe("1990-05-12");
    fireEvent.change(input, { target: { value: "1991-01-02" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith(2, expect.objectContaining({ birth_date: "1991-01-02" })));
  });
});

describe("Ver actividad", () => {
  it("links each user to their activity", async () => {
    render(<Usuarios />);
    await screen.findByText("Marleni");
    const link = within(row("Marleni")).getByRole("link", { name: /ver actividad/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/actividad?actor_id=3");
  });
});

describe("Animales disponibles", () => {
  it("the admin enables an animal with one tap and sees who uses each one", async () => {
    render(<Usuarios />);
    await screen.findByText("Marleni");
    fireEvent.click(screen.getByRole("button", { name: /animales disponibles/i }));
    const sheep = await screen.findByRole("button", { name: /oveja/i });
    expect(sheep.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(sheep);
    await waitFor(() => expect(avatarsAPI.setEnabled).toHaveBeenCalledWith("sheep", true, "Oveja"));
    await waitFor(() => expect(screen.getByRole("button", { name: /oveja/i }).getAttribute("aria-pressed")).toBe("true"));
    expect(screen.queryByRole("button", { name: /búho/i })).toBeNull(); // the owl is always the admin's
  });
});

describe("Cambiar el animal de un empleado", () => {
  it("the admin gives Marleni Hengi's dog after confirming", async () => {
    api.update.mockResolvedValue({ data: { user: users[2] } });
    api.setAvatar.mockResolvedValue({ data: { user: { ...users[2], avatar: "dog" } } });
    render(<Usuarios />);
    await screen.findByText("Marleni");
    fireEvent.click(within(row("Marleni")).getByRole("button", { name: /editar/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByTitle(/Perro · lo tiene Hengi/));
    fireEvent.click(await screen.findByRole("button", { name: /sí, quitárselo/i }));
    fireEvent.click(within(dialog).getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(api.setAvatar).toHaveBeenCalledWith(3, "dog", { force: true, label: "Perro" }));
  });
});

describe("Reactivar usuario", () => {
  it("asks with the page's own dialog (not the browser's) before reactivating", async () => {
    api.list.mockResolvedValue({ data: { users: [...users, { ...base, id: 4, name: "Israel", username: "israel", role: "digitador", color: null, is_active: false, in_payroll: true }] } });
    api.reactivate.mockResolvedValue({ data: { user: {} } });
    render(<><Usuarios /><DialogHost /></>);
    await screen.findByText("Israel");
    fireEvent.click(within(row("Israel")).getByRole("button", { name: /reactivar/i }));
    const dialog = await screen.findByRole("dialog", { name: /¿Reactivar a Israel\?/ });
    fireEvent.click(within(dialog).getByRole("button", { name: /^reactivar$/i }));
    await waitFor(() => expect(api.reactivate).toHaveBeenCalledWith(4));
  });
});
