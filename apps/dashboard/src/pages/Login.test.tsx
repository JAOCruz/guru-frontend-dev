// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const login = vi.fn();
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ login }) }));

import Login from "./Login";

const checkbox = () => screen.getByRole("checkbox", { name: /recuérdame/i }) as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
  login.mockReset();
  login.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("Login 'Recuérdame'", () => {
  it("is checked by default", () => {
    render(<Login />);
    expect(checkbox().checked).toBe(true);
  });

  it("restores the last choice made on this browser", () => {
    localStorage.setItem("rememberMePref", "false");
    render(<Login />);
    expect(checkbox().checked).toBe(false);
  });

  it("saves the choice on submit and passes it to login", () => {
    render(<Login />);
    fireEvent.click(checkbox());
    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: "hengi" } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "secret1" } });
    fireEvent.submit(checkbox().closest("form")!);
    expect(login).toHaveBeenCalledWith("hengi", "secret1", false);
    expect(localStorage.getItem("rememberMePref")).toBe("false");
  });
});

describe("Login after deactivation", () => {
  it("explains that the user was deactivated", () => {
    window.history.pushState({}, "", "/login?inactive=1");
    render(<Login />);
    expect(screen.getByText("Usuario desactivado. Contacta al administrador.")).toBeTruthy();
    window.history.pushState({}, "", "/");
  });
});
