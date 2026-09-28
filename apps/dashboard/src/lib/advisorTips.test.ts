import { describe, it, expect } from "vitest";
import { TIPS, CATEGORIES, eligibleTips, createTipPicker } from "./advisorTips";

describe("advisor tips", () => {
  it("every category has enough tips", () => {
    for (const c of CATEGORIES) {
      expect(TIPS.filter((t) => t.category === c.key).length, c.key).toBeGreaterThanOrEqual(6);
    }
  });

  it("filters by category, page and role", () => {
    const leyes = eligibleTips({ category: "leyes", path: "/", isAdmin: false });
    expect(leyes.length).toBeGreaterThan(0);
    expect(leyes.every((t) => t.category === "leyes")).toBe(true);

    // page tips only show on their page
    const onQuotes = eligibleTips({ category: "dashboard", path: "/cotizaciones", isAdmin: false });
    const onHome = eligibleTips({ category: "dashboard", path: "/", isAdmin: false });
    expect(onQuotes.some((t) => t.pages?.includes("/cotizaciones"))).toBe(true);
    expect(onHome.some((t) => t.pages?.includes("/cotizaciones"))).toBe(false);

    // admin-only tips never reach employees
    const all = eligibleTips({ category: "all", path: "/cotizaciones", isAdmin: false });
    expect(all.every((t) => t.role !== "admin")).toBe(true);
    const admin = eligibleTips({ category: "all", path: "/cotizaciones", isAdmin: true });
    expect(admin.every((t) => t.role !== "employee")).toBe(true);
  });

  it("the picker goes through every tip in random order before repeating", () => {
    const pool = eligibleTips({ category: "digitacion", path: "/", isAdmin: false });
    const next = createTipPicker(() => 0.42);
    const seen = new Set<string>();
    for (let i = 0; i < pool.length; i++) seen.add(next(pool).id);
    expect(seen.size).toBe(pool.length);
    // and never shows the same tip twice in a row across cycles
    let prev = next(pool).id;
    for (let i = 0; i < pool.length * 3; i++) {
      const cur = next(pool).id;
      expect(cur).not.toBe(prev);
      prev = cur;
    }
  });

  it("order is random: two pickers with different randomness disagree", () => {
    const pool = eligibleTips({ category: "all", path: "/", isAdmin: true });
    let seedA = 1, seedB = 7;
    const rng = (s: { v: number }) => () => ((s.v = (s.v * 16807) % 2147483647) / 2147483647);
    const a = createTipPicker(rng({ v: seedA }));
    const b = createTipPicker(rng({ v: seedB }));
    const seqA = Array.from({ length: 8 }, () => a(pool).id).join();
    const seqB = Array.from({ length: 8 }, () => b(pool).id).join();
    expect(seqA).not.toBe(seqB);
  });
});
