// @vitest-environment jsdom
import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getCurrentUser = vi.fn();
vi.mock("../services/api", () => ({
  authAPI: {
    getCurrentUser: () => getCurrentUser(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));
vi.mock("../components/LoadingScreen", () => ({ default: () => <div>loading</div> }));

import { AuthProvider } from "./AuthContext";

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
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
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
