// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { auth, serviceCatalogAPI } = vi.hoisted(() => ({
  auth: { isAdmin: true, user: { id: 1, username: "admin", role: "admin" } },
  serviceCatalogAPI: {
    getAll: vi.fn(), getCategories: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  },
}));
vi.mock("../services/api", () => ({ default: {}, serviceCatalogAPI }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));

import ServicesCatalog from "./ServicesCatalog";

const fojaService = {
  id: 7, name: "Carta legal", description: null,
  category_id: 2, category_name: "Redactar o digitar un documento",
  digitacion_price: 100, notarizacion_price: 0, price_tiers: [], unit_type: "por documento",
  active: true, foja_tipo: "legal_simple", fojas: 2,
};

beforeEach(() => {
  Object.values(serviceCatalogAPI).forEach((f) => f.mockReset());
  serviceCatalogAPI.getAll.mockResolvedValue({ data: { services: [fojaService] } });
  serviceCatalogAPI.getCategories.mockResolvedValue({ data: { categories: [{ id: 2, name: "Redactar o digitar un documento" }] } });
  serviceCatalogAPI.update.mockResolvedValue({ data: {} });
  auth.isAdmin = true;
});
afterEach(cleanup);

async function openGroup() {
  render(<ServicesCatalog />);
  fireEvent.click(await screen.findByRole("button", { name: /Digitación/ }));
}

describe("Catálogo — precio por foja", () => {
  it("muestra el precio por foja en la tarjeta", async () => {
    await openGroup();
    expect(await screen.findByText(/RD\$250 × 2 fojas = RD\$500/)).toBeTruthy();
  });

  it("editar y guardar manda foja_tipo y fojas", async () => {
    await openGroup();
    fireEvent.click(await screen.findByRole("button", { name: /Editar/ }));
    fireEvent.change(await screen.findByLabelText(/Precio por foja/), { target: { value: "carta_motivada" } });
    expect(screen.getByText(/Con precio por foja se ignora la digitación fija/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Fojas estimadas/), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar|Actualizar/ }));
    await waitFor(() => expect(serviceCatalogAPI.update).toHaveBeenCalled());
    expect(serviceCatalogAPI.update).toHaveBeenCalledWith(7, expect.objectContaining({ foja_tipo: "carta_motivada", fojas: 3 }));
  });

  it("No va por foja manda null en ambos", async () => {
    await openGroup();
    fireEvent.click(await screen.findByRole("button", { name: /Editar/ }));
    fireEvent.change(await screen.findByLabelText(/Precio por foja/), { target: { value: "" } });
    expect(screen.queryByLabelText(/Fojas estimadas/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Guardar|Actualizar/ }));
    await waitFor(() => expect(serviceCatalogAPI.update).toHaveBeenCalled());
    expect(serviceCatalogAPI.update).toHaveBeenCalledWith(7, expect.objectContaining({ foja_tipo: null, fojas: null }));
  });
});
