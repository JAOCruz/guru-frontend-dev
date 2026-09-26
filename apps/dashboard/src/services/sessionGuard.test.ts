// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleInactiveSession } from "./sessionGuard";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("handleInactiveSession", () => {
  it("clears the session and redirects when the backend says USER_INACTIVE", () => {
    localStorage.setItem("token", "a");
    localStorage.setItem("rememberMe", "true");
    sessionStorage.setItem("token", "b");
    const redirect = vi.fn();
    const handled = handleInactiveSession({ response: { data: { code: "USER_INACTIVE" } } }, redirect, "/cotizaciones");
    expect(handled).toBe(true);
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("rememberMe")).toBeNull();
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(redirect).toHaveBeenCalledWith("/login?inactive=1");
  });

  it("ignores other errors", () => {
    localStorage.setItem("token", "a");
    const redirect = vi.fn();
    expect(handleInactiveSession({ response: { status: 401, data: {} } }, redirect, "/")).toBe(false);
    expect(localStorage.getItem("token")).toBe("a");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not redirect again when already on the login page", () => {
    const redirect = vi.fn();
    handleInactiveSession({ response: { data: { code: "USER_INACTIVE" } } }, redirect, "/login");
    expect(redirect).not.toHaveBeenCalled();
  });
});

import { handlePasswordChangeRequired, resetSessionGuard } from "./sessionGuard";

describe("handlePasswordChangeRequired", () => {
  beforeEach(() => resetSessionGuard());
  it("reloads so the app shows 'Crea tu contraseña'", () => {
    const reload = vi.fn();
    expect(handlePasswordChangeRequired({ response: { data: { code: "PASSWORD_CHANGE_REQUIRED" } } }, reload)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads at most once in a burst of failing requests", () => {
    const reload = vi.fn();
    const err = { response: { data: { code: "PASSWORD_CHANGE_REQUIRED" } } };
    handlePasswordChangeRequired(err, reload);
    handlePasswordChangeRequired(err, reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ignores other errors", () => {
    const reload = vi.fn();
    expect(handlePasswordChangeRequired({ response: { status: 403, data: {} } }, reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
