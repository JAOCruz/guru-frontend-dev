// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import DialogHost from "./DialogHost";
import { confirmDialog, notify } from "../lib/dialogs";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("styled dialogs", () => {
  it("confirmDialog resolves true when confirmed", async () => {
    render(<DialogHost />);
    let answer: Promise<boolean>;
    act(() => {
      answer = confirmDialog("¿Reactivar a Hengi?", { title: "Reactivar usuario", confirmLabel: "Reactivar" });
    });
    expect(screen.getByRole("dialog", { name: "Reactivar usuario" }).textContent).toMatch(/Reactivar a Hengi/);
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    await expect(answer!).resolves.toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("confirmDialog resolves false on cancel or Escape", async () => {
    render(<DialogHost />);
    let a: Promise<boolean>, b: Promise<boolean>;
    act(() => { a = confirmDialog("¿Eliminar?"); });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await expect(a!).resolves.toBe(false);
    act(() => { b = confirmDialog("¿Eliminar?"); });
    fireEvent.keyDown(document, { key: "Escape" });
    await expect(b!).resolves.toBe(false);
  });

  it("notify shows a styled message that goes away by itself", () => {
    vi.useFakeTimers();
    render(<DialogHost />);
    act(() => notify("Documento enviado", "success"));
    expect(screen.getByText("Documento enviado")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(6000); });
    expect(screen.queryByText("Documento enviado")).toBeNull();
  });
});

// Guard: nobody should use the browser's native popups again
describe("no native browser popups", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(p);
    }
  };
  walk(join(__dirname, ".."));

  it("does not call alert(), confirm() or prompt()", () => {
    const offenders = files.filter((f) => /(^|[^\w.])(window\.)?(alert|confirm|prompt)\(/m.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => f.split("/src/")[1])).toEqual([]);
  });
});
