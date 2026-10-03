// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { admin, refresh } = vi.hoisted(() => ({
  admin: { update: vi.fn(), setAvatar: vi.fn(), setColor: vi.fn(), create: vi.fn() },
  refresh: vi.fn(() => Promise.resolve()),
}));
vi.mock("../../services/api", () => ({ adminUsersAPI: admin }));
vi.mock("../../context/UserColorsContext", () => ({
  useUserColors: () => ({
    users: [
      { id: 2, name: "Marleni", username: "marleni", color: "green", avatar: "cat" },
      { id: 3, name: "Hengi", username: "hengi", color: "red", avatar: "cow" },
    ],
    refresh,
  }),
}));

import UserFormModal from "./UserFormModal";

const MARLENI = {
  id: 2, name: "Marleni", username: "marleni", email: null, role: "digitador" as const, data_column: "MARLENI", color: "green", avatar: "cat",
  is_active: true, in_payroll: true, birth_date: null, must_change_password: false, last_seen: null, created_at: "", deactivated_at: null,
};

beforeEach(() => {
  Object.values(admin).forEach((f) => f.mockReset().mockResolvedValue({ data: {} }));
  refresh.mockClear();
});
afterEach(cleanup);

describe("Editar usuario · color (admin)", () => {
  it("a free color is saved with the user", async () => {
    const onSaved = vi.fn();
    render(<UserFormModal user={MARLENI} onClose={() => {}} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Morado" }));
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(admin.setColor).toHaveBeenCalledWith(2, "purple", { force: false, label: "Morado" }));
    expect(onSaved).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("a color someone has asks first, and says who gets the replaced color", async () => {
    render(<UserFormModal user={MARLENI} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Rojo (lo tiene Hengi)" }));
    expect(screen.getByText(/este color ya tiene dueño/i)).toBeTruthy();
    expect(screen.getByText(/hengi se quedará con el color que tenía marleni/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /sí, quitárselo/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(admin.setColor).toHaveBeenCalledWith(2, "red", { force: true, label: "Rojo" }));
  });

  it("cancelling keeps the current color and nothing is sent", async () => {
    render(<UserFormModal user={MARLENI} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Rojo (lo tiene Hengi)" }));
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(admin.update).toHaveBeenCalled());
    expect(admin.setColor).not.toHaveBeenCalled();
  });

  it("creating a user has no color picker (they get a free one)", () => {
    render(<UserFormModal onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByRole("group", { name: "Color" })).toBeNull();
  });
});
