import { describe, it, expect } from "vitest";
import {
  COLOR_KEYS, AVATAR_KEYS, FALLBACK_COLOR, resolveColor, resolveAvatar,
  initialOf, findUserByColumn, toAppearance, type DirectoryUser,
} from "./userColors";

const users: DirectoryUser[] = [
  { id: 1, name: "Admin", username: "admin", data_column: null, role: "admin", color: "teal", avatar: "owl", is_active: true, in_payroll: false },
  { id: 2, name: "Hengi", username: "hengi", data_column: "HENGI", role: "digitador", color: "green", avatar: "cow", is_active: true, in_payroll: true },
  { id: 3, name: null, username: "israel", data_column: "israel", role: "digitador", color: null, avatar: null, is_active: true, in_payroll: true },
];

describe("catalog", () => {
  it("has 12 colors and 25 avatars", () => {
    expect(COLOR_KEYS).toHaveLength(12);
    expect(AVATAR_KEYS).toHaveLength(25);
  });
});

describe("resolveColor", () => {
  it("returns palette entry", () => expect(resolveColor("yellow")).toEqual({ label: "Amarillo", bg: "#facc15", text: "#000000" }));
  it("falls back for unknown/null", () => {
    expect(resolveColor("magenta")).toBe(FALLBACK_COLOR);
    expect(resolveColor(null)).toBe(FALLBACK_COLOR);
  });
});

describe("resolveAvatar", () => {
  it("maps key to emoji", () => expect(resolveAvatar("owl")).toBe("🦉"));
  it("null for unknown", () => expect(resolveAvatar("dinosaur")).toBeNull());
});

describe("initialOf", () => {
  it("uppercases first letter", () => expect(initialOf(" hengi")).toBe("H"));
  it("? for empty", () => expect(initialOf("")).toBe("?"));
});

describe("findUserByColumn", () => {
  it("is case-insensitive", () => {
    expect(findUserByColumn(users, "hengi")?.id).toBe(2);
    expect(findUserByColumn(users, "ISRAEL")?.id).toBe(3);
  });
  it("undefined for missing", () => expect(findUserByColumn(users, null)).toBeUndefined());
});

describe("toAppearance", () => {
  it("full user", () => {
    expect(toAppearance(users[1])).toEqual({ color: resolveColor("green"), emoji: "🐮", name: "Hengi", initial: "H" });
  });
  it("no name falls back to username; no avatar → null emoji", () => {
    const a = toAppearance(users[2]);
    expect(a.name).toBe("israel");
    expect(a.emoji).toBeNull();
    expect(a.color).toBe(FALLBACK_COLOR);
  });
  it("unknown user uses fallback name", () => {
    expect(toAppearance(undefined, "AUXILIAR_I")).toEqual({ color: FALLBACK_COLOR, emoji: null, name: "AUXILIAR_I", initial: "A" });
  });
});

describe("animal faces", () => {
  it("uses face emojis", () => {
    expect(resolveAvatar("cat")).toBe("🐱");
    expect(resolveAvatar("dog")).toBe("🐶");
    expect(resolveAvatar("koala")).toBe("🐨");
  });
  it("no longer offers full-body animals without a face emoji", () => {
    expect(resolveAvatar("turtle")).toBeNull();
    expect(resolveAvatar("elephant")).toBeNull();
  });
});
