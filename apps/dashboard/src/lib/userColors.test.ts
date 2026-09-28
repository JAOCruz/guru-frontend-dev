import { describe, it, expect } from "vitest";
import {
  COLOR_KEYS, AVATAR_KEYS, FALLBACK_COLOR, resolveColor, resolveAvatar, themeFor, applyRootTheme,
  initialOf, findUserByColumn, toAppearance, type DirectoryUser,
} from "./userColors";

const users: DirectoryUser[] = [
  { id: 1, name: "Admin", username: "admin", data_column: null, role: "admin", color: "teal", avatar: "owl", is_active: true, in_payroll: false },
  { id: 2, name: "Hengi", username: "hengi", data_column: "HENGI", role: "digitador", color: "green", avatar: "cow", is_active: true, in_payroll: true },
  { id: 3, name: null, username: "israel", data_column: "israel", role: "digitador", color: null, avatar: null, is_active: true, in_payroll: true },
];

describe("catalog", () => {
  it("has 12 colors and the full animal catalog, in sync with the backend", () => {
    expect(COLOR_KEYS).toHaveLength(12);
    // Same keys, same order as guruweb-backend src/config/appearance.js (AVATAR_KEYS)
    expect(AVATAR_KEYS).toEqual([
      "cow", "cat", "dog", "horse", "pig", "rabbit", "rooster", "lion", "tiger", "bear", "panda", "fox",
      "frog", "giraffe", "koala", "monkey", "hamster", "mouse", "wolf", "boar", "unicorn", "dragon", "raccoon", "zebra",
      "monkey_full", "gorilla", "orangutan", "dog_full", "poodle", "guide_dog", "cat_full", "tiger_full", "leopard",
      "horse_full", "deer", "ox", "water_buffalo", "cow_full", "pig_full", "ram", "sheep", "goat", "camel",
      "two_hump_camel", "llama", "kangaroo", "sloth", "otter", "skunk", "badger", "elephant", "rhino", "hippo",
      "mouse_full", "rat", "rabbit_full", "chipmunk", "hedgehog", "bat",
      "turkey", "chicken_full", "hatching_chick", "baby_chick", "front_chick", "bird", "penguin", "dove", "eagle",
      "duck", "swan", "flamingo", "peacock", "parrot",
      "crocodile", "turtle", "lizard", "snake", "dragon_full", "sauropod", "t_rex",
      "spouting_whale", "whale", "dolphin", "fish", "tropical_fish", "blowfish", "shark", "octopus", "crab",
      "lobster", "shrimp", "squid",
      "snail", "butterfly", "caterpillar", "ant", "bee", "ladybug", "cricket", "spider", "scorpion", "mosquito",
      "owl",
    ]);
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
  it("also offers full-body animals (the admin decides which ones employees can pick)", () => {
    expect(resolveAvatar("turtle")).toBe("🐢");
    expect(resolveAvatar("elephant")).toBe("🐘");
    expect(resolveAvatar("dinosaurio")).toBeNull();
  });
});

describe("themeFor (sidebar and top bar in the user's color)", () => {
  it("employees get their own color; readable text on light colors", () => {
    expect(themeFor({ isAdmin: false, color: "green" })).toEqual({ main: "#22c55e", mainForeground: "#ffffff" });
    expect(themeFor({ isAdmin: false, color: "yellow" })).toEqual({ main: "#facc15", mainForeground: "#000000" });
  });

  it("admin, blue or no color keep the Gurú blue", () => {
    expect(themeFor({ isAdmin: true, color: "teal" })).toBeNull();
    expect(themeFor({ isAdmin: false, color: "blue" })).toBeNull();
    expect(themeFor({ isAdmin: false, color: null })).toBeNull();
    expect(themeFor({ isAdmin: false, color: "fucsia" })).toBeNull();
  });
});

describe("applyRootTheme", () => {
  it("sets the employee's color on the whole page and restores the Gurú blue", () => {
    const root = { style: new Map<string, string>() } as any;
    root.style.setProperty = (k: string, v: string) => root.style.set(k, v);
    root.style.removeProperty = (k: string) => root.style.delete(k);
    applyRootTheme({ main: "#22c55e", mainForeground: "#ffffff" }, root);
    expect(root.style.get("--main")).toBe("#22c55e");
    expect(root.style.get("--primary")).toBe("#22c55e");
    expect(root.style.get("--main-foreground")).toBe("#ffffff");
    applyRootTheme(null, root);
    expect(root.style.size).toBe(0);
  });
});
