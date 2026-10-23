// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { botAPI, api, auth } = vi.hoisted(() => {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {};
  const botAPI = new Proxy(fns, { get: (t, k: string) => (t[k] ??= vi.fn().mockResolvedValue({ data: {} })) });
  return { botAPI, api: { get: vi.fn(), put: vi.fn() }, auth: { isAdmin: true, user: { id: 1, username: "admin", role: "admin" } } };
});
vi.mock("../services/botApi", () => ({ botAPI }));
vi.mock("../services/api", () => ({ default: api }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/UserColorsContext", async () => {
  const { toAppearance } = await import("../lib/userColors");
  return { useUserColors: () => ({ users: [], refresh: vi.fn(), appearanceOf: () => toAppearance(undefined), appearanceOfColumn: () => toAppearance(undefined) }) };
});

import BotClients from "./BotClients";

beforeEach(() => {
  botAPI.getClients.mockResolvedValue({ data: { clients: [
    { id: "1", name: "Ana Gómez", phone: "18095550101", assigned_to: 5, messageCount: 24, joinedAt: "2026-09-01T10:00:00Z" },
    { id: "2", name: "Luis Peña", phone: "18295550202", assigned_to: null, messageCount: 3, joinedAt: "2026-09-20T10:00:00Z" },
    { id: "3", name: null, phone: "18495550303", assigned_to: 6, messageCount: 0, joinedAt: "2026-10-01T10:00:00Z" },
  ] } });
  api.get.mockResolvedValue({ data: { users: [
    { id: 5, name: "Marleni", role: "digitador", username: "marleni" },
    { id: 6, name: "Hengi", role: "digitador", username: "hengi" },
  ] } });
});
afterEach(cleanup);

const render_ = () => render(<MemoryRouter><BotClients /></MemoryRouter>);
const tab = (name: RegExp) => screen.getByRole("tab", { name });

describe("Clientes — list", () => {
  it("rows show the formatted phone and how many messages", async () => {
    render_();
    expect(await screen.findByText("(809) 555-0101")).toBeTruthy();
    expect(screen.getByText(/24 mensajes/)).toBeTruthy();
  });

  it("tabs count assigned and unassigned clients and narrow the list", async () => {
    render_();
    await screen.findByText("Ana Gómez");
    expect(tab(/todos/i).textContent).toMatch(/3/);
    expect(tab(/^asignados/i).textContent).toMatch(/2/);
    expect(tab(/sin asignar/i).textContent).toMatch(/1/);
    fireEvent.click(tab(/sin asignar/i));
    expect(screen.queryByText("Ana Gómez")).toBeNull();
    expect(screen.getByText("Luis Peña")).toBeTruthy();
  });

  it("the folded filter picks one digitador and shows a removable chip", async () => {
    render_();
    await screen.findByText("Ana Gómez");
    fireEvent.click(screen.getByRole("button", { name: /^filtros/i }));
    fireEvent.change(await screen.findByLabelText(/digitador/i), { target: { value: "6" } });
    expect(screen.queryByText("Ana Gómez")).toBeNull();
    expect(screen.getByText("(849) 555-0303")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /quitar filtro: hengi/i }));
    expect(screen.getByText("Ana Gómez")).toBeTruthy();
  });

  it("an employee sees no assignment tabs or filters", async () => {
    auth.isAdmin = false;
    render_();
    await screen.findByText("Ana Gómez");
    expect(screen.queryByRole("tab", { name: /sin asignar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^filtros/i })).toBeNull();
    auth.isAdmin = true;
  });
});
