// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import QuoteItemsList, { pendingCount } from "./QuoteItemsList";

const ITEMS = [
  { desc: "Copia certificada", cantidad: 1, precio: 700 },
  { desc: "Apostilla en Cancillería", cantidad: 2, precio: null, por_confirmar: true, rango: { min: 250, max: 300 }, precio_sugerido: null, nota: "Precio dentro del rango: lo confirma el digitador" },
  { desc: "Traducción - Acta Natal", cantidad: 1, precio: null, por_confirmar: true, rango: null, precio_sugerido: 700, nota: "Individual o en conjunto (una sola firma): lo confirma el digitador" },
];
afterEach(cleanup);

describe("QuoteItemsList", () => {
  it("counts the lines still to be priced", () => {
    expect(pendingCount(ITEMS)).toBe(2);
    expect(pendingCount([{ desc: "x", cantidad: 1, precio: 5 }])).toBe(0);
    expect(pendingCount(undefined)).toBe(0);
  });

  it("read-only: marks pending lines with their range and note, without inputs", () => {
    render(<QuoteItemsList items={ITEMS} />);
    expect(screen.getByText("2 precios por confirmar")).toBeTruthy();
    expect(screen.getByText(/RD\$\s?250 – RD\$\s?300/)).toBeTruthy();
    expect(screen.getByText("Precio dentro del rango: lo confirma el digitador")).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("editable: confirm the suggested price, warn outside the range, and save every line's price", () => {
    const onSave = vi.fn();
    render(<QuoteItemsList items={ITEMS} editable onSave={onSave} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs).toHaveLength(3);
    fireEvent.change(inputs[1], { target: { value: "400" } });
    expect(screen.getByText(/fuera del rango/i)).toBeTruthy();
    fireEvent.change(inputs[1], { target: { value: "280" } });
    expect(screen.queryByText(/fuera del rango/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /confirmar RD\$\s?700/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar precios/i }));
    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ desc: "Copia certificada", precio: 700 }),
      expect.objectContaining({ desc: "Apostilla en Cancillería", precio: 280, por_confirmar: true }),
      expect.objectContaining({ desc: "Traducción - Acta Natal", precio: 700 }),
    ]);
  });

  it("an empty price keeps the line pending (sent as null)", () => {
    const onSave = vi.fn();
    render(<QuoteItemsList items={ITEMS} editable onSave={onSave} />);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "650" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar precios/i }));
    const saved = onSave.mock.calls[0][0];
    expect(saved[0].precio).toBe(650);
    expect(saved[1].precio).toBeNull();
  });

  it("a line that already had a price keeps it if its field is emptied", () => {
    const onSave = vi.fn();
    render(<QuoteItemsList items={ITEMS} editable onSave={onSave} />);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "" } });
    fireEvent.change(screen.getAllByRole("spinbutton")[1], { target: { value: "260" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar precios/i }));
    expect(onSave.mock.calls[0][0][0].precio).toBe(700);
  });
});
