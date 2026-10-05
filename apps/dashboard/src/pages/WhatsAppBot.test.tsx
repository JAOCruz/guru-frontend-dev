// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { botAPI } = vi.hoisted(() => ({
  botAPI: {
    getStatus: vi.fn(), getQR: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), toggleBot: vi.fn(),
    resync: vi.fn(), reconnect: vi.fn(), setBotMode: vi.fn(), setAssignmentMode: vi.fn(),
  },
}));
vi.mock("../services/botApi", () => ({ default: { defaults: { baseURL: "" } }, botAPI }));
vi.mock("../lib/dialogs", () => ({ confirmDialog: vi.fn() }));

import WhatsAppBot from "./WhatsAppBot";

const status = (extra: object) =>
  botAPI.getStatus.mockResolvedValue({ data: { connected: true, botActive: true, botMode: "selected", assignmentMode: "manual", ...extra } });

beforeEach(() => {
  Object.values(botAPI).forEach((f) => f.mockReset());
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
