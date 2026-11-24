// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const { auth, serviceCatalogAPI, notify } = vi.hoisted(() => ({
  auth: { isAdmin: true },
  serviceCatalogAPI: { getRates: vi.fn(), saveRates: vi.fn() },
  notify: vi.fn(),
}));
vi.mock("../../services/api", () => ({ default: {}, serviceCatalogAPI }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../lib/dialogs", () => ({ notify }));

import TarifasPanel from "./TarifasPanel";
import { DEFAULT_RATES, applyRates } from "../../lib/tarifas";

const fresh = () => JSON.parse(JSON.stringify(DEFAULT_RATES));
beforeEach(() => {
  applyRates(fresh());
  serviceCatalogAPI.getRates.mockReset().mockResolvedValue({ data: { rates: fresh() } });
  serviceCatalogAPI.saveRates.mockReset().mockImplementation(async (r) => ({ data: { rates: r } }));
  notify.mockReset();
  auth.isAdmin = true;
});
afterEach(cleanup);

describe("Tarifas", () => {
  it("muestra los totales calculados de cada caso", async () => {
    render(<TarifasPanel />);
    const denso = await screen.findByRole("row", { name: /Carta extensivo o denso/ });
    // 3 páginas a 800 = 2,400; 10 páginas a 700 = 7,000
    expect(within(denso).getByText("RD$2,400")).toBeTruthy();
    expect(within(denso).getByText("RD$7,000")).toBeTruthy();
    const legal = screen.getByRole("row", { name: /Legal simple/ });
    expect(within(legal).getByText("RD$500")).toBeTruthy(); // 2 fojas × 250
  });

  it("el admin cambia una tarifa, ve el total nuevo y la guarda", async () => {
    render(<TarifasPanel />);
    const input = await screen.findByLabelText("Tarifa por foja Legal simple");
    fireEvent.change(input, { target: { value: "275" } });
    const legal = screen.getByRole("row", { name: /Legal simple/ });
    expect(within(legal).getByText("RD$550")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Guardar tarifas/ }));
    await waitFor(() => expect(serviceCatalogAPI.saveRates).toHaveBeenCalled());
    expect(serviceCatalogAPI.saveRates.mock.calls[0][0].foja.legal_simple).toBe(275);
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/guardad/i), "success");
  });

  it("cambia el precio de un tramo de traducción", async () => {
    render(<TarifasPanel />);
    const input = await screen.findByLabelText("Carta sencillo: precio por página desde 3 páginas");
    fireEvent.change(input, { target: { value: "650" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar tarifas/ }));
    await waitFor(() => expect(serviceCatalogAPI.saveRates).toHaveBeenCalled());
    const sent = serviceCatalogAPI.saveRates.mock.calls[0][0];
    expect(sent.traduccion.tipos[0].tramos[1]).toEqual({ desde: 3, precio: 650 });
  });

  it("si el servidor rechaza, muestra su motivo", async () => {
    serviceCatalogAPI.saveRates.mockRejectedValue({ response: { data: { error: "Los tramos deben ir de menos a más páginas" } } });
    render(<TarifasPanel />);
    fireEvent.click(await screen.findByRole("button", { name: /Guardar tarifas/ }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Los tramos deben ir de menos a más páginas", "error"));
  });

  it("un digitador ve las tarifas pero no las puede cambiar", async () => {
    auth.isAdmin = false;
    render(<TarifasPanel />);
    await screen.findByRole("row", { name: /Legal simple/ });
    expect(screen.queryByLabelText("Tarifa por foja Legal simple")).toBeNull();
    expect(screen.queryByRole("button", { name: /Guardar tarifas/ })).toBeNull();
  });
});
