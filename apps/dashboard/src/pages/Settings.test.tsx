// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { auth, api, settingsAPI } = vi.hoisted(() => ({
  auth: { isAdmin: true, user: { id: 1, username: "admin", role: "admin" } },
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  settingsAPI: { getCurrentPercentage: vi.fn(), updateEmployeePercentage: vi.fn() },
}));
vi.mock("../services/api", () => ({ default: api, settingsAPI }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));

import Settings from "./Settings";

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  settingsAPI.getCurrentPercentage.mockReset().mockResolvedValue({ data: { percentage: 50 } });
  auth.isAdmin = true;
  api.get.mockResolvedValue({ data: { digitadores_aprueban_documentos: false } });
});
afterEach(cleanup);

describe("Configuración — aprobación de digitadores", () => {
  it("the admin sees the switch loaded from GET /settings/bot and saves with PUT", async () => {
    api.put.mockResolvedValue({ data: { digitadores_aprueban_documentos: true } });
    render(<Settings />);
    const sw = await screen.findByRole("switch", { name: /los digitadores pueden aprobar y enviar documentos/i });
    expect(api.get).toHaveBeenCalledWith("/settings/bot");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/settings/bot", { digitadores_aprueban_documentos: true }));
    await waitFor(() => expect(sw.getAttribute("aria-checked")).toBe("true"));
  });

  it("is hidden for non-admins", async () => {
    auth.isAdmin = false;
    render(<Settings />);
    await waitFor(() => expect(settingsAPI.getCurrentPercentage).toHaveBeenCalled());
    expect(screen.queryByRole("switch")).toBeNull();
    expect(api.get).not.toHaveBeenCalledWith("/settings/bot");
  });
});
