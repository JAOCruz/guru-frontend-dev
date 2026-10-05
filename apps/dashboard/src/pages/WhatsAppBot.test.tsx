// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const { botAPI } = vi.hoisted(() => ({
  botAPI: {
    getStatus: vi.fn(), getQR: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), toggleBot: vi.fn(),
    resync: vi.fn(), reconnect: vi.fn(), setBotMode: vi.fn(), setAssignmentMode: vi.fn(), archiveChats: vi.fn(),
  },
}));
vi.mock("../services/botApi", () => ({ default: { defaults: { baseURL: "" } }, botAPI }));
const { confirmDialog } = vi.hoisted(() => ({ confirmDialog: vi.fn() }));
vi.mock("../lib/dialogs", () => ({ confirmDialog }));

import WhatsAppBot from "./WhatsAppBot";

const status = (extra: object) =>
  botAPI.getStatus.mockResolvedValue({ data: { connected: true, botActive: true, botMode: "selected", assignmentMode: "manual", ...extra } });

beforeEach(() => {
  Object.values(botAPI).forEach((f) => f.mockReset());
  confirmDialog.mockReset();
  botAPI.getQR.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe("WhatsApp Bot — Meta official API", () => {
  it("shows the Meta connection, without QR or reconnect buttons", async () => {
    status({ provider: "meta" });
    render(<WhatsAppBot />);
    expect(await screen.findByText(/API oficial de Meta/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /iniciar conexión/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /reconectar forzado/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /refrescar conexión/i })).toBeNull();
    expect(screen.getByRole("button", { name: /pausar bot/i })).toBeTruthy();
  });

  it("in Seleccionados it says where to turn the bot on per chat", async () => {
    status({ provider: "meta" });
    render(<WhatsAppBot />);
    expect(await screen.findByText(/botón 🤖 de cada chat/i)).toBeTruthy();
  });

  it("with Baileys the QR tools are still there", async () => {
    status({ provider: "baileys" });
    render(<WhatsAppBot />);
    expect(await screen.findByRole("button", { name: /reconectar forzado/i })).toBeTruthy();
    expect(screen.queryByText(/API oficial de Meta/i)).toBeNull();
  });
});

describe("WhatsApp Bot — archivar chats", () => {
  it("without a cutoff it says every chat shows", async () => {
    status({ provider: "meta", chatsSince: null });
    render(<WhatsAppBot />);
    expect(await screen.findByText(/se ven todos los chats/i)).toBeTruthy();
  });

  it("archives after confirming and shows the date it starts from", async () => {
    status({ provider: "meta", chatsSince: null });
    confirmDialog.mockResolvedValue(true);
    botAPI.archiveChats.mockResolvedValue({ data: { chatsSince: "2026-10-05T20:00:00.000Z", manualCleared: 113 } });
    render(<WhatsAppBot />);
    fireEvent.click(await screen.findByRole("button", { name: /archivar chats anteriores/i }));
    await waitFor(() => expect(botAPI.archiveChats).toHaveBeenCalled());
    expect(confirmDialog.mock.calls[0][0]).toMatch(/no se borra nada/i);
    expect(await screen.findByText(/se ven los chats desde/i)).toBeTruthy();
  });

  it("cancelling the confirmation archives nothing", async () => {
    status({ provider: "meta", chatsSince: null });
    confirmDialog.mockResolvedValue(false);
    render(<WhatsAppBot />);
    fireEvent.click(await screen.findByRole("button", { name: /archivar chats anteriores/i }));
    await waitFor(() => expect(confirmDialog).toHaveBeenCalled());
    expect(botAPI.archiveChats).not.toHaveBeenCalled();
  });
});
