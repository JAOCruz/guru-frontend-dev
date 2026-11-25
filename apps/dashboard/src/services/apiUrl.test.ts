// @vitest-environment jsdom
// Un dashboard de prueba (otro sitio de Netlify) se construye con VITE_API_URL apuntando al backend de prueba:
// ninguna llamada puede irse al backend de producción solo porque el sitio está en netlify.app.
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("dirección del backend", () => {
  it("con VITE_API_URL, todo usa ese backend aunque el sitio esté en netlify.app", async () => {
    vi.stubEnv("VITE_API_URL", "https://backend-prueba.up.railway.app/api");
    Object.defineProperty(window, "location", { value: { hostname: "guru-prueba.netlify.app" }, configurable: true });
    const { getAPIUrl } = await import("./api");
    const { getBotApiBaseURL } = await import("./botApi");
    expect(getAPIUrl()).toBe("https://backend-prueba.up.railway.app");
    expect(getBotApiBaseURL()).toBe("https://backend-prueba.up.railway.app/api");
  });

  it("sin VITE_API_URL, netlify.app sigue yendo a producción", async () => {
    vi.stubEnv("VITE_API_URL", "");
    Object.defineProperty(window, "location", { value: { hostname: "guruweb-dashboard-prod.netlify.app" }, configurable: true });
    const { getAPIUrl } = await import("./api");
    const { getBotApiBaseURL } = await import("./botApi");
    expect(getAPIUrl()).toBe("https://guruweb-backend-production.up.railway.app");
    expect(getBotApiBaseURL()).toBe("https://guruweb-backend-production.up.railway.app/api");
  });
});
