import { describe, it, expect } from "vitest";
import { payrollColumns } from "./payroll";
import type { DirectoryUser } from "./userColors";

const u = (id: number, data_column: string | null, in_payroll: boolean, is_active = true): DirectoryUser => ({
  id, name: null, username: `u${id}`, data_column, role: "digitador", color: null, avatar: null, in_payroll, is_active,
});

describe("payrollColumns", () => {
  it("lists active payroll users by id, uppercased", () => {
    const r = payrollColumns([u(5, "israel", true), u(2, "Hengi", true)], []);
    expect(r.columns).toEqual(["HENGI", "ISRAEL"]);
    expect(r.inactive.size).toBe(0);
  });

  it("skips users not in payroll or without a column", () => {
    const r = payrollColumns([u(1, null, true), u(2, "HENGI", true), u(3, "ADMIN", false)], []);
    expect(r.columns).toEqual(["HENGI"]);
  });

  it("includes a deactivated user only when they have services in the list", () => {
    const users = [u(2, "HENGI", true), u(3, "MARLENI", true, false)];
    expect(payrollColumns(users, []).columns).toEqual(["HENGI"]);
    const r = payrollColumns(users, [{ data_column: "marleni" }]);
    expect(r.columns).toEqual(["HENGI", "MARLENI"]);
    expect(r.inactive.has("MARLENI")).toBe(true);
  });

  it("falls back to the legacy six while the directory is loading", () => {
    expect(payrollColumns([], []).columns).toEqual(["HENGI", "MARLENI", "ISRAEL", "THAICAR", "AUXILIAR_I", "AUXILIAR_II"]);
  });
});
