// @vitest-environment jsdom
// Al abrir un chat se ve desde el último mensaje, aunque antes se haya abierto otro chat.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { botAPI, auth } = vi.hoisted(() => {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {};
  const botAPI = new Proxy(fns, {
    get: (t, k: string) => (t[k] ??= vi.fn().mockResolvedValue({ data: {} })),
  });
  return { botAPI, auth: { isAdmin: true, user: { id: 1, username: "leandro", role: "admin" } } };
});
vi.mock("../services/botApi", () => ({ botAPI, getBotApiBaseURL: () => "http://api", catalogUnitPrice: () => 0 }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/UserColorsContext", async () => {
  const { toAppearance } = await import("../lib/userColors");
  return { useUserColors: () => ({ users: [], refresh: vi.fn(), appearanceOf: () => toAppearance(undefined), appearanceOfName: () => toAppearance(undefined) }) };
});

import BotMessages from "./BotMessages";

const conv = (phone: string, name: string) => ({ phone, client_name: name, client_id: null, client_assigned_to: null, profile_pic_url: null, last_message: "x", last_message_at: "2026-11-10T15:00:00Z", message_count: "3", botActive: false });
const chat = (phone: string, n: number, tag: string) =>
  Array.from({ length: n }, (_, i) => ({ id: Number(phone.slice(-2)) * 100 + i, phone, direction: "inbound", content: `${tag} ${i + 1}`, created_at: new Date(Date.UTC(2026, 10, 10, 15, i)).toISOString() })).reverse();

let scrolls: string[] = [];
beforeEach(() => {
  scrolls = [];
  Element.prototype.scrollIntoView = vi.fn(function () {
    // qué último mensaje estaba en pantalla cuando se bajó al final
    scrolls.push(document.body.textContent?.includes("Último de Beto") ? "beto" : document.body.textContent?.includes("Ana 30") ? "ana" : "vacío");
  });
  botAPI.getMessages.mockResolvedValue({ data: { conversations: [conv("18095550101", "Ana"), conv("18095550102", "Beto")] } });
  botAPI.getStatus.mockResolvedValue({ data: {} });
  // como en la red de verdad, el chat nuevo tarda un poco en llegar
  botAPI.getPhoneMessages.mockImplementation(async (phone: string) => (await new Promise((r) => setTimeout(r, phone.endsWith("01") ? 0 : 200)), {
    data: phone.endsWith("01") ? chat(phone, 30, "Ana") : [...chat(phone, 2, "Beto"), { id: 999, phone, direction: "inbound", content: "Último de Beto", created_at: "2026-11-10T16:00:00Z" }],
  }));
});
afterEach(cleanup);

describe("Mensajes — se abre en el último mensaje", () => {
  it("al cambiar de un chat largo a otro, baja al final del nuevo chat", async () => {
    render(<MemoryRouter><BotMessages /></MemoryRouter>);
    fireEvent.click((await screen.findByText("Ana")).closest("button")!);
    await screen.findByText("Ana 30");
    await waitFor(() => expect(scrolls).toContain("ana"));
    fireEvent.click(screen.getByText("Beto").closest("button")!);
    await screen.findByText("Último de Beto");
    await waitFor(() => expect(scrolls[scrolls.length - 1]).toBe("beto"));
  });

  it("aunque en el chat anterior se haya subido a leer", async () => {
    render(<MemoryRouter><BotMessages /></MemoryRouter>);
    fireEvent.click((await screen.findByText("Ana")).closest("button")!);
    await screen.findByText("Ana 30");
    const box = screen.getByText("Ana 1").closest('[class*="overflow-y"]') as HTMLElement;
    Object.defineProperty(box, "scrollHeight", { value: 5000, configurable: true });
    Object.defineProperty(box, "clientHeight", { value: 500, configurable: true });
    box.scrollTop = 0;
    fireEvent.scroll(box);
    fireEvent.click(screen.getByText("Beto").closest("button")!);
    await screen.findByText("Último de Beto");
    await waitFor(() => expect(scrolls[scrolls.length - 1]).toBe("beto"));
  });
});
