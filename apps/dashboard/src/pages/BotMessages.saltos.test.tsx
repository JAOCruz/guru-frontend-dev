// @vitest-environment jsdom
// Leandro, 2026-11-25: los mensajes con lista (1-, 2-, …) llegaban al cliente en un solo párrafo: la caja era de una línea.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { botAPI, auth, notify } = vi.hoisted(() => {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {};
  const botAPI = new Proxy(fns, {
    get: (t, k: string) => (t[k] ??= vi.fn().mockResolvedValue({ data: {} })),
  });
  return { botAPI, notify: vi.fn(), auth: { isAdmin: false, user: { id: 5, username: "hengi", role: "digitador" } } };
});
vi.mock("../services/botApi", () => ({ botAPI, getBotApiBaseURL: () => "http://api", catalogUnitPrice: () => 0 }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../lib/dialogs", async (orig) => ({ ...(await orig<typeof import("../lib/dialogs")>()), notify }));
vi.mock("../context/UserColorsContext", async () => {
  const { toAppearance } = await import("../lib/userColors");
  return { useUserColors: () => ({ users: [], refresh: vi.fn(), appearanceOf: () => toAppearance(undefined), appearanceOfName: () => toAppearance(undefined) }) };
});

import BotMessages from "./BotMessages";

const PHONE = "18095550101";
beforeEach(() => {
  notify.mockReset();
  botAPI.sendMedia.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
  botAPI.getMessages.mockResolvedValue({ data: { conversations: [{ phone: PHONE, client_name: "Ana Gómez", client_id: 1, client_assigned_to: 5, profile_pic_url: null, last_message: "Hola", last_message_at: "2026-11-10T15:00:00Z", message_count: "1", botActive: false }] } });
  botAPI.getStatus.mockResolvedValue({ data: {} });
  botAPI.getPhoneMessages.mockResolvedValue({ data: [{ id: 1, phone: PHONE, direction: "inbound", content: "Hola de Ana", created_at: "2026-11-10T15:00:00Z" }] });
});
afterEach(cleanup);

const abrir = async () => {
  render(<MemoryRouter><BotMessages /></MemoryRouter>);
  fireEvent.click((await screen.findByText("Ana Gómez")).closest("button")!);
  await screen.findByText("Hola de Ana");
  return screen.getByPlaceholderText("Escribe un mensaje...").closest("[data-chat-drop]") as HTMLElement;
};

describe("Mensajes — saltos de línea", () => {
  it("la caja de texto admite varias líneas", async () => {
    await abrir();
    expect(screen.getByPlaceholderText("Escribe un mensaje...").tagName).toBe("TEXTAREA");
  });

  it("Shift+Enter no envía, y el mensaje sale con sus saltos de línea", async () => {
    botAPI.sendMessage.mockClear();
    await abrir();
    const caja = screen.getByPlaceholderText("Escribe un mensaje...");
    const texto = "Requiere:\n1- Declaración jurada = RD$1,500\n2- Compulsa = RD$1,000";
    fireEvent.change(caja, { target: { value: texto } });
    fireEvent.keyDown(caja, { key: "Enter", shiftKey: true });
    expect(botAPI.sendMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(caja, { key: "Enter" });
    expect(botAPI.sendMessage).toHaveBeenCalledWith(PHONE, texto);
  });
});
