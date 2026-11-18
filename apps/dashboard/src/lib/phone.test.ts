import { describe, it, expect } from "vitest";
import { formatPhone } from "./phone";

describe("formatPhone", () => {
  it("un número de RD se ve como (809) 555-0101", () => {
    expect(formatPhone("18095550101")).toBe("(809) 555-0101");
  });
  it("alguien que esconde su número (usuario de WhatsApp) no sale como un montón de dígitos", () => {
    expect(formatPhone("DO.13491208655302741918")).toBe("Sin número · usuario de WhatsApp");
    expect(formatPhone("US.ENT.11815799212886844830")).toBe("Sin número · usuario de WhatsApp");
  });
});
