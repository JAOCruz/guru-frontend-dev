import { describe, it, expect } from "vitest";
import { numeroEnLetras, montoEnLetras, letrasPara } from "./enLetras";

describe("números en letras (actos legales)", () => {
  it("writes numbers the way the deeds do", () => {
    expect(numeroEnLetras(0)).toBe("CERO");
    expect(numeroEnLetras(1)).toBe("UNO");
    expect(numeroEnLetras(15)).toBe("QUINCE");
    expect(numeroEnLetras(21)).toBe("VEINTIUNO");
    expect(numeroEnLetras(35)).toBe("TREINTA Y CINCO");
    expect(numeroEnLetras(100)).toBe("CIEN");
    expect(numeroEnLetras(101)).toBe("CIENTO UNO");
    expect(numeroEnLetras(500)).toBe("QUINIENTOS");
    expect(numeroEnLetras(1000)).toBe("MIL");
    expect(numeroEnLetras(2026)).toBe("DOS MIL VEINTISÉIS");
    expect(numeroEnLetras(21000)).toBe("VEINTIÚN MIL");
    expect(numeroEnLetras(1_000_000)).toBe("UN MILLÓN");
    expect(numeroEnLetras(92_000_960)).toBe("NOVENTA Y DOS MILLONES NOVECIENTOS SESENTA");
  });

  it("money: pesos dominicanos with cents", () => {
    expect(montoEnLetras("RD$ 92,000,960.00")).toBe("NOVENTA Y DOS MILLONES NOVECIENTOS SESENTA PESOS DOMINICANOS");
    expect(montoEnLetras("1,000,000")).toBe("UN MILLÓN DE PESOS DOMINICANOS");
    expect(montoEnLetras("250.50")).toBe("DOSCIENTOS CINCUENTA PESOS DOMINICANOS CON 50/100");
    expect(montoEnLetras("abc")).toBeNull();
  });

  it("short form before the currency, dollars, singular", () => {
    expect(montoEnLetras("RD$ 21")).toBe("VEINTIÚN PESOS DOMINICANOS");
    expect(montoEnLetras("101")).toBe("CIENTO UN PESOS DOMINICANOS");
    expect(montoEnLetras("1.00")).toBe("UN PESO DOMINICANO");
    expect(montoEnLetras("US$ 15,000.00")).toBe("QUINCE MIL DÓLARES ESTADOUNIDENSES");
    expect(montoEnLetras("USD 1,000,000")).toBe("UN MILLÓN DE DÓLARES ESTADOUNIDENSES");
  });

  it("decimals that are not money keep their decimals", () => {
    expect(letrasPara("AREA_LETRAS", { AREA_NUMEROS: "350.75" })).toBe("TRESCIENTOS CINCUENTA PUNTO SETENTA Y CINCO");
    expect(letrasPara("AREA_LETRAS", { AREA_NUMEROS: "1,250" })).toBe("MIL DOSCIENTOS CINCUENTA");
  });

  it("finds the number a _LETRAS/_TEXTO tag can be written from", () => {
    const values = { PRECIO_VENTA_NUMEROS: "RD$100,000.00", DIA_NUMERO: "5", AÑO_NUMERO: "" };
    expect(letrasPara("PRECIO_VENTA_LETRAS", values)).toBe("CIEN MIL PESOS DOMINICANOS");
    expect(letrasPara("DIA_TEXTO", values)).toBe("CINCO");
    expect(letrasPara("AÑO_TEXTO", values)).toBeNull();
    expect(letrasPara("NOMBRE_VENDEDOR", values)).toBeNull();
  });
});
