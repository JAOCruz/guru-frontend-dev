// @vitest-environment jsdom
// Chats ocultos: solo el admin puede ocultarlos, verlos y volver a mostrarlos.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { botAPI, auth, notify } = vi.hoisted(() => {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {};
  const botAPI = new Proxy(fns, {
    get: (t, k: string) => (t[k] ??= vi.fn().mockResolvedValue({ data: {} })),
  });
  return { botAPI, notify: vi.fn(), auth: { isAdmin: true, user: { id: 1, username: "leandro", role: "admin" } } };
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
const conv = (name: string) => ({ phone: PHONE, client_name: name, client_id: 1, client_assigned_to: 5, profile_pic_url: null, last_message: "Hola", last_message_at: "2026-10-05T15:00:00Z", message_count: "1", botActive: false });

beforeEach(() => {
  Object.values(botAPI as unknown as Record<string, ReturnType<typeof vi.fn>>).forEach((f) => f.mockClear());
  auth.isAdmin = true;
  notify.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  botAPI.getMessages.mockImplementation(async (hidden?: boolean) => ({ data: { conversations: [conv(hidden ? "Ana Oculta" : "Ana Gómez")] } }));
  botAPI.getStatus.mockResolvedValue({ data: {} });
  botAPI.getPhoneMessages.mockResolvedValue({ data: [{ id: 1, phone: PHONE, direction: "inbound", content: "Hola de Ana", created_at: "2026-10-05T15:00:00Z" }] });
  botAPI.hideChat.mockResolvedValue({ data: {} });
  botAPI.unhideChat.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

const abrir = async (name: string) => {
  fireEvent.click((await screen.findByText(name)).closest("button")!);
  await screen.findByText("Hola de Ana");
};
const pantalla = () => render(<MemoryRouter><BotMessages /></MemoryRouter>);

describe("Mensajes — chats ocultos", () => {
  it("un digitador no ve ninguna opción de ocultar", async () => {
    auth.isAdmin = false;
    pantalla();
    await abrir("Ana Gómez");
    expect(screen.queryByRole("button", { name: "Ocultar chat" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver ocultos" })).toBeNull();
  });

  it("el admin oculta un chat: se cierra y la lista se actualiza", async () => {
    pantalla();
    await abrir("Ana Gómez");
    const antes = botAPI.getMessages.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Ocultar chat" }));
    await waitFor(() => expect(botAPI.hideChat).toHaveBeenCalledWith(PHONE));
    await waitFor(() => expect(screen.queryByText("Hola de Ana")).toBeNull());
    await waitFor(() => expect(botAPI.getMessages.mock.calls.length).toBeGreaterThan(antes));
    // en el celular, la lista tiene que volver a verse
    expect(screen.getByRole("button", { name: "Ver ocultos" }).closest('[class*="hidden md:flex"]')).toBeNull();
  });

  it("Ver ocultos trae los ocultos, con todo su historial, y permite volver a mostrarlos", async () => {
    pantalla();
    await screen.findByText("Ana Gómez");
    fireEvent.click(screen.getByRole("button", { name: "Ver ocultos" }));
    await abrir("Ana Oculta");
    expect(botAPI.getPhoneMessages).toHaveBeenLastCalledWith(PHONE, true);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar chat" }));
    await waitFor(() => expect(botAPI.unhideChat).toHaveBeenCalledWith(PHONE));
    expect(botAPI.hideChat).not.toHaveBeenCalled();
  });

  it("si falla, avisa y el chat sigue abierto", async () => {
    botAPI.hideChat.mockRejectedValueOnce(new Error("no"));
    pantalla();
    await abrir("Ana Gómez");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar chat" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("No se pudo ocultar el chat. Inténtalo de nuevo."));
    expect(screen.getByText("Hola de Ana")).toBeTruthy();
  });
});
