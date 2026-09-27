import { describe, it, expect } from "vitest";
import { generateTempPassword, roleLabel, lastSeenLabel } from "./users";

describe("users helpers", () => {
  it("generates 8-char passwords without ambiguous characters", () => {
    const p = generateTempPassword();
    expect(p).toHaveLength(8);
    expect(p).not.toMatch(/[0O1lI]/);
  });
  it("labels roles", () => {
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("employee")).toBe("Digitador");
    expect(roleLabel("auxiliar")).toBe("Auxiliar");
  });
  it("formats last connection", () => {
    const now = new Date("2026-09-26T12:00:00Z").getTime();
    expect(lastSeenLabel(null, now)).toBe("—");
    expect(lastSeenLabel("2026-09-26T11:59:30Z", now)).toBe("Ahora");
    expect(lastSeenLabel("2026-09-26T11:45:00Z", now)).toBe("Hace 15 min");
    expect(lastSeenLabel("2026-09-26T09:00:00Z", now)).toBe("Hace 3 h");
    expect(lastSeenLabel("2026-09-23T12:00:00Z", now)).toBe("Hace 3 días");
  });
});

describe("generated temporary passwords meet the password policy", () => {
  it("always contain at least one letter and one number (8 chars)", () => {
    for (let i = 0; i < 300; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(8);
      expect(p).toMatch(/[A-Za-z]/);
      expect(p).toMatch(/\d/);
    }
  });
});
