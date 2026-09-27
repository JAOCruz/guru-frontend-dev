// @vitest-environment jsdom
import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getCurrentUser = vi.fn();
const loginApi = vi.fn();
const changePassword = vi.fn();
vi.mock("../services/api", () => ({
  authAPI: {
    getCurrentUser: () => getCurrentUser(),
    login: (...args: unknown[]) => loginApi(...args),
    logout: vi.fn(),
    changePassword: (...args: unknown[]) => changePassword(...args),
  },
}));
vi.mock("../components/LoadingScreen", () => ({ default: () => <div>loading</div> }));

import { AuthProvider, ProtectedRoute, useAuth } from "./AuthContext";
import { screen, fireEvent } from "@testing-library/react";

let mounts = 0;
const LoginForm = () => {
  useEffect(() => {
    mounts++;
  }, []);
  return <input aria-label="usuario" />;
};

const renderApp = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    </MemoryRouter>,
  );

// Simulates the network round-trip: the 401 arrives ~200ms after the request
// Advance fake time in small steps, letting React commit between them like a real browser
async function advance(ms: number, step = 100) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}

const reject401 = () =>
  new Promise((_, reject) => setTimeout(() => reject({ response: { status: 401 }, message: "401" }), 200));

beforeEach(() => {
  mounts = 0;
  getCurrentUser.mockReset();
  loginApi.mockReset();
  changePassword.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AuthProvider with a stale token", () => {
  it("does not remount the login form between 401 retries (typed text survives)", async () => {
    localStorage.setItem("token", "expired");
    localStorage.setItem("rememberMe", "true");
    getCurrentUser.mockImplementation(reject401);

    renderApp();
    await advance(120_000);

    expect(mounts).toBe(1);
  });

  it("gives up on a persistent 401 after a few quick retries and clears the token", async () => {
    localStorage.setItem("token", "expired");
    localStorage.setItem("rememberMe", "true");
    getCurrentUser.mockImplementation(reject401);

    renderApp();
    await advance(15_000);

    expect(getCurrentUser).toHaveBeenCalledTimes(4);
    expect(localStorage.getItem("token")).toBeNull();
    expect(mounts).toBe(1);
  });
});

// Backend unreachable: /auth/me keeps failing without a response, the stored token is kept
const rejectNetwork = () =>
  new Promise((_, reject) => setTimeout(() => reject({ message: "Network Error" }), 200));

const LoginTrigger = ({ remember }: { remember: boolean }) => {
  const { login } = useAuth();
  useEffect(() => {
    login("hengi", "secret1", remember).catch(() => {});
  }, []);
  return null;
};

const renderWithLogin = (remember: boolean) =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <LoginTrigger remember={remember} />
      </AuthProvider>
    </MemoryRouter>,
  );

const user = { id: 2, username: "hengi", role: "digitador", dataColumn: "HENGI" };

describe("login stores the session in exactly one place", () => {
  it("login without 'recuérdame' removes a stale remembered token", async () => {
    localStorage.setItem("token", "old");
    localStorage.setItem("rememberMe", "true");
    getCurrentUser.mockImplementation(rejectNetwork);
    loginApi.mockResolvedValue({ data: { token: "new", user } });

    renderWithLogin(false);
    await advance(150_000, 500);

    expect(localStorage.getItem("token")).toBeNull();
    expect(sessionStorage.getItem("token")).toBe("new");
  });

  it("login with 'recuérdame' removes a stale session token", async () => {
    sessionStorage.setItem("token", "old");
    getCurrentUser.mockImplementation(rejectNetwork);
    loginApi.mockResolvedValue({ data: { token: "new", user } });

    renderWithLogin(true);
    await advance(150_000, 500);

    expect(sessionStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("token")).toBe("new");
    expect(localStorage.getItem("rememberMe")).toBe("true");
  });
});

describe("sliding session", () => {
  it("a renewed token from /auth/me replaces the remembered token", async () => {
    localStorage.setItem("token", "old");
    localStorage.setItem("rememberMe", "true");
    getCurrentUser.mockResolvedValue({ data: { user, token: "renewed" } });

    renderApp();
    await advance(1_000);

    expect(localStorage.getItem("token")).toBe("renewed");
    expect(sessionStorage.getItem("token")).toBeNull();
  });

  it("a renewed token for a non-remembered session stays in sessionStorage", async () => {
    sessionStorage.setItem("token", "old");
    getCurrentUser.mockResolvedValue({ data: { user, token: "renewed" } });

    renderApp();
    await advance(1_000);

    expect(sessionStorage.getItem("token")).toBe("renewed");
    expect(localStorage.getItem("token")).toBeNull();
  });
});

describe("temporary password", () => {
  const tempUser = { ...user, mustChangePassword: true };
  const renderProtected = () =>
    render(
      <MemoryRouter>
        <AuthProvider>
          <ProtectedRoute>
            <div>panel</div>
          </ProtectedRoute>
        </AuthProvider>
      </MemoryRouter>,
    );

  it("shows only the 'Crea tu contraseña' screen", async () => {
    localStorage.setItem("token", "t");
    getCurrentUser.mockResolvedValue({ data: { user: tempUser } });
    renderProtected();
    await advance(500);
    expect(screen.getByText("Crea tu contraseña")).toBeTruthy();
    expect(screen.queryByText("panel")).toBeNull();
  });

  it("rejects a mismatched confirmation without calling the API", async () => {
    localStorage.setItem("token", "t");
    getCurrentUser.mockResolvedValue({ data: { user: tempUser } });
    renderProtected();
    await advance(500);
    fireEvent.change(screen.getByLabelText(/contraseña temporal/i), { target: { value: "temp123" } });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña/i), { target: { value: "nueva123" } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: "otra1234" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar y entrar/i }));
    await advance(200);
    expect(screen.getByText("La confirmación no coincide")).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("after saving, reloads the user and enters the dashboard", async () => {
    localStorage.setItem("token", "t");
    getCurrentUser.mockResolvedValueOnce({ data: { user: tempUser } }).mockResolvedValue({ data: { user } });
    changePassword.mockResolvedValue({ data: { ok: true } });
    renderProtected();
    await advance(500);
    fireEvent.change(screen.getByLabelText(/contraseña temporal/i), { target: { value: "temp123" } });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña/i), { target: { value: "nueva123" } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: "nueva123" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar y entrar/i }));
    await advance(500);
    expect(changePassword).toHaveBeenCalledWith("temp123", "nueva123");
    expect(screen.getByText("panel")).toBeTruthy();
  });
});

describe("password rules on the 'Crea tu contraseña' screen", () => {
  it("asks for at least 8 characters before calling the API", async () => {
    localStorage.setItem("token", "t");
    getCurrentUser.mockResolvedValue({ data: { user: { ...user, mustChangePassword: true } } });
    render(
      <MemoryRouter>
        <AuthProvider>
          <ProtectedRoute>
            <div>panel</div>
          </ProtectedRoute>
        </AuthProvider>
      </MemoryRouter>,
    );
    await advance(500);
    fireEvent.change(screen.getByLabelText(/contraseña temporal/i), { target: { value: "temp123" } });
    fireEvent.change(screen.getByLabelText(/^nueva contraseña/i), { target: { value: "abc1234" } });
    fireEvent.change(screen.getByLabelText(/confirmar/i), { target: { value: "abc1234" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar y entrar/i }));
    await advance(200);
    expect(screen.getByText("La nueva contraseña debe tener al menos 8 caracteres")).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });
});
