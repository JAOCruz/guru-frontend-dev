import { describe, it, expect } from "vitest";
import { todayISO, formatISODate } from "./dates";

describe("local dates", () => {
  it("todayISO keeps the local day late in the evening (UTC would already be tomorrow)", () => {
    expect(todayISO(new Date(2026, 8, 28, 21, 30))).toBe("2026-09-28");
    expect(todayISO(new Date(2026, 8, 28, 0, 5))).toBe("2026-09-28");
  });

  it("formatISODate shows the same day that was picked", () => {
    expect(formatISODate("2026-09-28")).toBe(new Date(2026, 8, 28).toLocaleDateString("es-ES"));
  });
});
