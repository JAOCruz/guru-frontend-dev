// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { api, navigate } = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn() }, navigate: vi.fn() }));
vi.mock("../../services/api", () => ({ default: api }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));

import NotificationAlarm from "./NotificationAlarm";

type N = { id: number; title: string; message: string; read: boolean; created_at: string; link?: string };
const n = (id: number, extra: Partial<N> = {}): N => ({ id, title: `Aviso ${id}`, message: `Mensaje ${id}`, read: false, created_at: "2026-10-17T12:00:00Z", ...extra });
let responses: N[][];
const reply = () => {
  const list = responses.length > 1 ? responses.shift()! : responses[0];
  return Promise.resolve({ data: { notifications: list, unreadCount: list.length } });
};

beforeEach(() => {
  api.get.mockReset().mockImplementation(reply);
  api.post.mockReset().mockResolvedValue({ data: {} });
  navigate.mockReset();
  document.title = "Gurú Dashboard";
});
afterEach(cleanup);

const setup = (props = {}) => {
  const onUnreadCountChange = vi.fn();
  const onOpenList = vi.fn();
  render(<NotificationAlarm pollMs={30} onUnreadCountChange={onUnreadCountChange} onOpenList={onOpenList} {...props} />);
  return { onUnreadCountChange, onOpenList };
};

describe("NotificationAlarm", () => {
  it("asks only for unread notifications", async () => {
    responses = [[]];
    setup();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/notifications", { params: { unread: "true", limit: 20 } }));
  });

  it("on first load shows one summary of the pending ones, not each one", async () => {
    responses = [[n(1), n(2), n(3)]];
    const { onOpenList } = setup();
    const dlg = await screen.findByRole("alertdialog");
    expect(dlg.textContent).toMatch(/3 notificaciones sin leer/);
    expect(screen.queryByText("Aviso 1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^ver notificaciones$/i }));
    expect(onOpenList).toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("a new notification opens the window by itself", async () => {
    responses = [[], [n(7, { title: "📝 Cotización por aprobar" })]];
    setup();
    expect(await screen.findByText("📝 Cotización por aprobar")).toBeTruthy();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("does not close with Escape or a click outside", async () => {
    responses = [[], [n(7)]];
    setup();
    const dlg = await screen.findByRole("alertdialog");
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.keyDown(dlg, { key: "Escape" });
    fireEvent.mouseDown(document.body);
    fireEvent.click(screen.getByTestId("notification-alarm-backdrop"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("Entendido marks it read and closes; it does not come back on the next poll", async () => {
    responses = [[], [n(7)]];
    setup();
    await screen.findByText("Aviso 7");
    fireEvent.click(screen.getByRole("button", { name: /entendido/i }));
    expect(api.post).toHaveBeenCalledWith("/notifications/7/read");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await new Promise((r) => setTimeout(r, 100)); // varios sondeos que siguen trayendo la 7
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Ver marks it read and goes to its page", async () => {
    responses = [[], [n(8, { link: "/documentos" })]];
    setup();
    await screen.findByText("Aviso 8");
    fireEvent.click(screen.getByRole("button", { name: /^ver$/i }));
    expect(api.post).toHaveBeenCalledWith("/notifications/8/read");
    expect(navigate).toHaveBeenCalledWith("/documents");
  });

  it("several new ones stack in the same window and can all be marked read", async () => {
    responses = [[], [n(9), n(10)]];
    const { onUnreadCountChange } = setup();
    await screen.findByText("Aviso 9");
    expect(screen.getByText("Aviso 10")).toBeTruthy();
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /marcar todas como leídas/i }));
    expect(api.post).toHaveBeenCalledWith("/notifications/read-all");
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onUnreadCountChange).toHaveBeenLastCalledWith(0);
  });

  it("puts the unread count in the tab title", async () => {
    responses = [[n(1), n(2)]];
    const { onUnreadCountChange } = setup();
    await waitFor(() => expect(document.title).toBe("(2) Gurú Dashboard"));
    expect(onUnreadCountChange).toHaveBeenCalledWith(2);
  });
});
