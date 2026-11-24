// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const login = vi.fn();
const auth: { user: unknown } = { user: null };
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ login, user: auth.user }) }));

import LoginPage from "./Login";

// Login lives under the router (it redirects when the session is already open)
const Login = () => (
  <MemoryRouter initialEntries={["/login"]}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>Panel principal</p>} />
    </Routes>
  </MemoryRouter>
);

const checkbox = () => screen.getByRole("checkbox", { name: /recuérdame/i }) as HTMLInputElement;

beforeEach(() => {
  auth.user = null;
  localStorage.clear();
  login.mockReset();
  login.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete (window as any).turnstile;
});

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
    expect(login).toHaveBeenCalledWith("hengi", "secret1", false, undefined);
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

describe("Login human check (Cloudflare Turnstile)", () => {
  const fillAndSubmit = () => {
    fireEvent.change(screen.getByLabelText(/usuario/i), { target: { value: "hengi" } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: "secret1" } });
    fireEvent.submit(screen.getByLabelText(/usuario/i).closest("form")!);
  };

  it("sends the Turnstile token with the login", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "0xTEST");
    const render_ = vi.fn((_el: HTMLElement, opts: any) => {
      opts.callback("tok-123");
      return "w1";
    });
    (window as any).turnstile = { render: render_, remove: vi.fn(), reset: vi.fn() };
    render(<Login />);
    await screen.findByRole("button", { name: /iniciar|entrar|ingresar/i });
    fillAndSubmit();
    expect(render_).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ sitekey: "0xTEST" }));
    expect(login).toHaveBeenCalledWith("hengi", "secret1", true, "tok-123");
  });

  it("keeps the button disabled until the check finishes", () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "0xTEST");
    (window as any).turnstile = { render: vi.fn(() => "w1"), remove: vi.fn(), reset: vi.fn() };
    render(<Login />);
    const button = screen.getByRole("button", { name: /iniciar|entrar|ingresar|verificando/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

describe("Login con la sesión ya abierta", () => {
  it("con «Recuérdame» la sesión sigue viva: abrir /login lleva directo al panel, sin pedir la contraseña", () => {
    auth.user = { id: 1, username: "leandro", role: "admin" };
    render(<Login />);
    expect(screen.getByText("Panel principal")).toBeTruthy();
    expect(screen.queryByLabelText(/contraseña/i)).toBeNull();
  });
});
