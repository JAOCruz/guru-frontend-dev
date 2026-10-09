import { describe, it, expect } from "vitest";
import { FOJA_RATES, fojaUnitPrice } from "./fojaRates";
import { catalogUnitPrice } from "../services/botApi";

describe("FOJA_RATES", () => {
  it("mirrors the backend rates", () => {
    expect(Object.fromEntries(Object.entries(FOJA_RATES).map(([k, r]) => [k, r.rate]))).toEqual({
      carta_simple: 150, carta_motivada: 300, legal_simple: 250, legal_motivada: 350,
    });
  });
});

describe("fojaUnitPrice", () => {
  it("is rate × fojas, with 1 foja when unknown, and null without a valid foja_tipo", () => {
    expect(fojaUnitPrice("legal_simple", 3)).toBe(750);
    expect(fojaUnitPrice("carta_simple", null)).toBe(150);
    expect(fojaUnitPrice("otro", 2)).toBeNull();
    expect(fojaUnitPrice(null, 2)).toBeNull();
  });
});

describe("catalogUnitPrice", () => {
  it("prices a foja service by rate × fojas, ignoring digitacion_price", () => {
    expect(catalogUnitPrice({ id: 1, name: "Poder", digitacion_price: "500", foja_tipo: "legal_simple", fojas: 3 })).toBe(750);
    expect(catalogUnitPrice({ id: 2, name: "Carta", digitacion_price: null, foja_tipo: "carta_motivada", fojas: null })).toBe(300);
  });
  it("never prices a range-only service by foja (like the backend)", () => {
    expect(catalogUnitPrice({ id: 7, name: "Antiplagio", digitacion_price: null, precio_rango: { min: 800, max: 1000 }, foja_tipo: "legal_simple", fojas: 1 })).toBeNull();
  });
  it("keeps the old order for services without foja", () => {
    expect(catalogUnitPrice({ id: 3, name: "Copia", digitacion_price: "50" })).toBe(50);
    expect(catalogUnitPrice({ id: 4, name: "Notaría", digitacion_price: 0, notarizacion_price: "800" })).toBe(800);
    expect(catalogUnitPrice({ id: 5, name: "Venta", price_tiers: [{ min: 0, max: null, price: 500 }] })).toBe(500);
    expect(catalogUnitPrice({ id: 6, name: "Nada" })).toBeNull();
  });
});
