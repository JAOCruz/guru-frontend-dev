// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { botAPI, auth } = vi.hoisted(() => {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {};
  const botAPI = new Proxy(fns, {
    get: (t, k: string) => (t[k] ??= vi.fn().mockResolvedValue({ data: {} })),
  });
  return { botAPI, auth: { isAdmin: true, user: { id: 1, username: "admin", role: "admin" } } };
});
vi.mock("../services/botApi", () => ({ botAPI, getBotApiBaseURL: () => "http://api", catalogUnitPrice: () => 0 }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/UserColorsContext", async () => {
  const { toAppearance } = await import("../lib/userColors");
  return { useUserColors: () => ({ users: [], refresh: vi.fn(), appearanceOf: () => toAppearance(undefined), appearanceOfColumn: () => toAppearance(undefined) }) };
});

import BotMessages from "./BotMessages";

const conv = (phone: string, name: string | null, botActive: boolean, assigned: number | null = null) => ({
  phone, client_name: name, client_id: name ? 1 : null, client_assigned_to: assigned, profile_pic_url: null,
  last_message: `último de ${name || phone}`, last_message_at: "2026-10-05T15:00:00Z", message_count: "3", botActive,
});

beforeEach(() => {
  botAPI.getMessages.mockResolvedValue({ data: { conversations: [
    conv("18095550101", "Ana Gómez", true, 5),
    conv("18095550202", "Luis Peña", false),
    conv("18095550303", null, true),
  ] } });
  botAPI.getAdminUsers.mockResolvedValue({ data: { users: [{ id: 5, name: "Marleni", role: "digitador", username: "marleni" }] } });
  botAPI.getStatus.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

const render_ = () => render(<MemoryRouter><BotMessages /></MemoryRouter>);
const tab = (name: RegExp) => screen.getByRole("tab", { name });

describe("Mensajes — conversation list", () => {
  it("tabs show how many chats are in each state", async () => {
    render_();
    await screen.findByText("Ana Gómez");
    expect(tab(/todos/i).textContent).toMatch(/3/);
    expect(tab(/bot/i).textContent).toMatch(/2/);
    expect(tab(/manual/i).textContent).toMatch(/1/);
  });

  it("a tab narrows the list", async () => {
    render_();
    await screen.findByText("Ana Gómez");
    fireEvent.click(tab(/manual/i));
    expect(screen.queryByText("Ana Gómez")).toBeNull();
    expect(screen.getByText("Luis Peña")).toBeTruthy();
  });

  it("filters are folded; picking one shows a chip that removes it", async () => {
    render_();
    await screen.findByText("Ana Gómez");
    expect(screen.queryByLabelText(/asignado a/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^filtros/i }));
    fireEvent.change(screen.getByLabelText(/asignado a/i), { target: { value: "5" } });
    expect(screen.queryByText("Luis Peña")).toBeNull();
    expect(screen.getByText("Ana Gómez")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /quitar filtro: marleni/i }));
    expect(screen.getByText("Luis Peña")).toBeTruthy();
  });

  it("'Sin cliente' shows only chats not registered as clients", async () => {
    render_();
    await screen.findByText("Ana Gómez");
    fireEvent.click(screen.getByRole("button", { name: /^filtros/i }));
    fireEvent.change(screen.getByLabelText(/^contacto/i), { target: { value: "non_clients" } });
    expect(screen.queryByText("Ana Gómez")).toBeNull();
    expect(screen.getByText("(809) 555-0303")).toBeTruthy();
  });

  it("each row has a bot switch labelled with its state", async () => {
    render_();
    const row = (await screen.findByText("Luis Peña")).closest("li")!;
    expect(within(row).getByRole("button", { name: /activar bot en este chat/i })).toBeTruthy();
  });
});

describe("Mensajes — chat window", () => {
  it("the header always shows who it is, with the bot switch and tools labelled", async () => {
    botAPI.getPhoneMessages.mockResolvedValue({ data: [
      { id: 2, phone: "18095550101", direction: "outbound", content: "1️⃣ Contratos\n2️⃣ Poderes", created_at: "2026-10-05T15:01:00Z", ai_generated: true },
      { id: 1, phone: "18095550101", direction: "inbound", content: "Hola", created_at: "2026-10-05T15:00:00Z" },
    ] });
    render_();
    fireEvent.click((await screen.findByText("Ana Gómez")).closest("button")!);
    const header = await screen.findByRole("heading", { name: /ana gómez/i });
    expect(header).toBeTruthy();
    // besides the one in the list rows, the chat header has its own switch
    const switches = screen.getAllByRole("button", { name: /bot activo en este chat/i });
    expect(switches.filter((b) => !b.closest("li"))).toHaveLength(1);
    for (const name of [/generar cotización/i, /ver media del chat/i, /buscar en mensajes/i]) {
      // one set for desktop (top row), one for phones (second row); CSS shows one
      expect(screen.getAllByRole("button", { name })).toHaveLength(2);
    }
    // the bot's menu keeps its line breaks and says it was the bot
    const menu = await screen.findByText(/1️⃣ Contratos/);
    expect(menu.className).toMatch(/whitespace-pre-line/);
    expect(screen.getByText(/🤖 Bot/)).toBeTruthy();
  });
});
