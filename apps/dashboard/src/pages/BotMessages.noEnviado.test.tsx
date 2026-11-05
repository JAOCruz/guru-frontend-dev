// @vitest-environment jsdom
// Chat en modo manual: si un mensaje del digitador no sale (24 h de WhatsApp u otro fallo), tiene que verlo.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
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
  return { useUserColors: () => ({ users: [], refresh: vi.fn(), appearanceOf: () => toAppearance(undefined), appearanceOfColumn: () => toAppearance(undefined) }) };
});

import BotMessages from "./BotMessages";

const WINDOW_TEXT = "No se envió: pasaron más de 24 h desde el último mensaje del cliente. WhatsApp solo deja escribirle cuando el cliente vuelva a escribir.";
const history = (outbound: Record<string, unknown> = {}) => [
  { id: 2, phone: "18095550101", direction: "outbound", content: "¿Le llegó el poder?", created_at: "2026-10-05T15:01:00Z", ...outbound },
  { id: 1, phone: "18095550101", direction: "inbound", content: "Hola", created_at: "2026-10-05T15:00:00Z" },
];

beforeEach(() => {
  notify.mockReset();
  Element.prototype.scrollIntoView = vi.fn(); // jsdom no lo trae
  botAPI.getMessages.mockResolvedValue({ data: { conversations: [{
    phone: "18095550101", client_name: "Ana Gómez", client_id: 1, client_assigned_to: 5, profile_pic_url: null,
    last_message: "Hola", last_message_at: "2026-10-05T15:00:00Z", message_count: "2", botActive: false,
  }] } });
  botAPI.getStatus.mockResolvedValue({ data: {} });
  botAPI.getPhoneMessages.mockResolvedValue({ data: history() });
});
afterEach(cleanup);

const openChat = async () => {
  render(<MemoryRouter><BotMessages /></MemoryRouter>);
  fireEvent.click((await screen.findByText("Ana Gómez")).closest("button")!);
  await screen.findByText("¿Le llegó el poder?");
};

describe("Mensajes — mensajes que no salieron", () => {
  it("fuera de las 24 h: avisa, quita la burbuja y devuelve el texto a la caja", async () => {
    botAPI.sendMessage.mockRejectedValueOnce({ response: { status: 409, data: { code: "WINDOW_CLOSED", error: WINDOW_TEXT } } });
    await openChat();
    const box = screen.getByPlaceholderText("Escribe un mensaje...") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "Ya está listo su documento" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(notify).toHaveBeenCalledWith(WINDOW_TEXT));
    expect(screen.queryByText("Ya está listo su documento")).toBeNull();
    expect(box.value).toBe("Ya está listo su documento");
  });

  it("sin respuesta del servidor: aviso genérico de no enviado", async () => {
    botAPI.sendMessage.mockRejectedValueOnce(new Error("Network Error"));
    await openChat();
    const box = screen.getByPlaceholderText("Escribe un mensaje...") as HTMLInputElement;
    fireEvent.change(box, { target: { value: "Hola" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringMatching(/^no se envió/i)));
    expect(box.value).toBe("Hola");
  });

  it("un archivo que no salió muestra el motivo del servidor", async () => {
    botAPI.sendMedia.mockRejectedValueOnce({ response: { status: 409, data: { code: "WINDOW_CLOSED", error: WINDOW_TEXT } } });
    await openChat();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "poder.pdf", { type: "application/pdf" })] } });
    const send = await screen.findByRole("button", { name: /enviar archivo/i });
    fireEvent.click(send);
    await waitFor(() => expect(notify).toHaveBeenCalledWith(WINDOW_TEXT));
  });

  it("Meta avisó después que no lo entregó: la burbuja dice No enviado y por qué", async () => {
    botAPI.getPhoneMessages.mockResolvedValue({ data: history({ status: "failed_window" }) });
    await openChat();
    expect(screen.getByText(/no enviado: pasaron más de 24 h/i)).toBeTruthy();
  });

  it("otro fallo de entrega: No enviado, sin hablar de las 24 h", async () => {
    botAPI.getPhoneMessages.mockResolvedValue({ data: history({ status: "failed" }) });
    await openChat();
    const note = screen.getByText(/no enviado/i);
    expect(note.textContent).not.toMatch(/24 h/);
  });

  it("un mensaje enviado no muestra aviso", async () => {
    botAPI.getPhoneMessages.mockResolvedValue({ data: history({ status: "sent" }) });
    await openChat();
    expect(screen.queryByText(/no enviado/i)).toBeNull();
  });
});
