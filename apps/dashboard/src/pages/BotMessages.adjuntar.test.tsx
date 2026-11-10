// @vitest-environment jsdom
// Adjuntar al chat arrastrando un archivo o pegándolo: queda listo para enviar, nunca se envía solo.
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
const archivo = (name: string, type: string, size?: number) => {
  const f = new File(["x"], name, { type });
  if (size) Object.defineProperty(f, "size", { value: size });
  return f;
};
const soltar = (zona: HTMLElement, files: File[]) => {
  const dataTransfer = { files, types: ["Files"] };
  fireEvent.dragEnter(zona, { dataTransfer });
  fireEvent.drop(zona, { dataTransfer });
};

describe("Mensajes — arrastrar y pegar archivos", () => {
  it("al arrastrar se ve dónde soltar, y al soltar queda adjunto sin enviarse", async () => {
    const zona = await abrir();
    fireEvent.dragEnter(zona, { dataTransfer: { files: [], types: ["Files"] } });
    expect(screen.getByText("Suelta para adjuntar")).toBeTruthy();
    fireEvent.drop(zona, { dataTransfer: { files: [archivo("poder.pdf", "application/pdf")], types: ["Files"] } });
    expect(await screen.findByText("poder.pdf")).toBeTruthy();
    expect(screen.queryByText("Suelta para adjuntar")).toBeNull();
    expect(botAPI.sendMedia).not.toHaveBeenCalled();
  });

  it("varios archivos: adjunta el primero y avisa", async () => {
    soltar(await abrir(), [archivo("uno.pdf", "application/pdf"), archivo("dos.pdf", "application/pdf")]);
    expect(await screen.findByText("uno.pdf")).toBeTruthy();
    expect(screen.queryByText("dos.pdf")).toBeNull();
    expect(notify).toHaveBeenCalledWith("Se adjuntó solo el primero: los archivos se envían de uno en uno.");
  });

  it("un archivo de más de 16 MB no se adjunta", async () => {
    soltar(await abrir(), [archivo("grande.pdf", "application/pdf", 17 * 1024 * 1024)]);
    expect(notify).toHaveBeenCalledWith("El archivo es muy grande (máximo 16MB).");
    expect(screen.queryByText("grande.pdf")).toBeNull();
  });

  it("un tipo que WhatsApp no acepta no se adjunta", async () => {
    soltar(await abrir(), [archivo("programa.exe", "application/x-msdownload")]);
    expect(notify).toHaveBeenCalledWith("Ese tipo de archivo no se puede enviar por el chat.");
    expect(screen.queryByText("programa.exe")).toBeNull();
  });

  it("pegar un archivo en la caja de texto lo adjunta", async () => {
    await abrir();
    const f = archivo("captura.pdf", "application/pdf");
    fireEvent.paste(screen.getByPlaceholderText("Escribe un mensaje..."), { clipboardData: { files: [f], items: [{ kind: "file", getAsFile: () => f }] } });
    expect(await screen.findByText("captura.pdf")).toBeTruthy();
  });

  it("pegar texto sigue escribiendo normal", async () => {
    await abrir();
    fireEvent.paste(screen.getByPlaceholderText("Escribe un mensaje..."), { clipboardData: { files: [], items: [{ kind: "string" }] } });
    expect(notify).not.toHaveBeenCalled();
  });
});
