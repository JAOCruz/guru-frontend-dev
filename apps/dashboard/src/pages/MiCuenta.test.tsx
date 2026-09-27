// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { authAPI, refreshUser } = vi.hoisted(() => ({
  authAPI: { updateAppearance: vi.fn(), changePassword: vi.fn(), updateProfile: vi.fn() },
  refreshUser: vi.fn(),
}));
vi.mock("../services/api", () => ({ authAPI }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: 2, username: "hengi", name: "Hengi", role: "digitador", color: "green", avatar: null, birthDate: "1990-05-12" }, refreshUser, isAdmin: false }),
}));
vi.mock("../context/UserColorsContext", () => ({ useUserColors: () => ({ refresh: vi.fn(), users: [] }) }));

import MiCuenta from "./MiCuenta";

beforeEach(() => {
  Object.values(authAPI).forEach((f) => f.mockReset());
  refreshUser.mockReset();
  authAPI.updateProfile.mockResolvedValue({ data: {} });
});
afterEach(cleanup);

describe("Mi cuenta — fecha de nacimiento", () => {
  it("shows the current birth date and saves a new one", async () => {
    render(<MiCuenta />);
    const input = screen.getByLabelText(/fecha de nacimiento/i) as HTMLInputElement;
    expect(input.value).toBe("1990-05-12");
    fireEvent.change(input, { target: { value: "1990-06-01" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar fecha/i }));
    await waitFor(() => expect(authAPI.updateProfile).toHaveBeenCalledWith({ birthDate: "1990-06-01" }));
    expect(refreshUser).toHaveBeenCalled();
    expect(await screen.findByText(/fecha guardada/i)).toBeTruthy();
  });
});
