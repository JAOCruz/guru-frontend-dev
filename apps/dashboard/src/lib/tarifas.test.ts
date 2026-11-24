import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_RATES, applyRates, traduccionTotal, modeloPrecioTexto, type Rates } from "./tarifas";
import { FOJA_RATES } from "./fojaRates";

const clone = (r: Rates): Rates => JSON.parse(JSON.stringify(r));
beforeEach(() => applyRates(clone(DEFAULTS)));
const DEFAULTS = clone(DEFAULT_RATES);

describe("traduccionTotal", () => {
  it("el precio por página baja por tramos y el total es tramo × páginas", () => {
    const denso = DEFAULTS.traduccion.tipos.find((t) => t.key === "carta_denso")!;
    expect([1, 2, 3, 9, 10, 15].map((p) => traduccionTotal(denso, p).total)).toEqual([1000, 2000, 2400, 7200, 7000, 10500]);
    expect(traduccionTotal(denso, 3).porPagina).toBe(800);
  });
  it("usa los tramos aunque vengan desordenados", () => {
    const t = { key: "x", label: "X", tramos: [{ desde: 3, precio: 600 }, { desde: 1, precio: 700 }] };
    expect(traduccionTotal(t, 4).total).toBe(2400);
  });
});

describe("applyRates", () => {
  it("cambia las tarifas por foja que usa todo el dashboard", () => {
    const r = clone(DEFAULTS);
    r.foja.legal_simple = 275;
    applyRates(r);
    expect(FOJA_RATES.legal_simple.rate).toBe(275);
  });
});

describe("modeloPrecioTexto", () => {
  it("dice fojas, tamaño, si es motivada y el precio", () => {
    expect(modeloPrecioTexto({ fojas: 2, foja_tipo: "legal_simple", precio: 500 })).toBe("2 fojas legales · RD$500");
    expect(modeloPrecioTexto({ fojas: 1, foja_tipo: "carta_motivada", precio: 300 })).toBe("1 foja carta motivada · RD$300");
    expect(modeloPrecioTexto({ fojas: 2, foja_tipo: "legal_motivada", precio: 700 })).toBe("2 fojas legales motivadas · RD$700");
    expect(modeloPrecioTexto({ fojas: null, foja_tipo: null, precio: null })).toBeNull();
  });
});
