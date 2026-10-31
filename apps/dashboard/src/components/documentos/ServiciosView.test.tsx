// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import ServiciosView from "./ServiciosView";
import { serviciosData, tramitesData } from "./serviciosData";

afterEach(cleanup);

describe("Servicios — guía interna", () => {
  it("shows the 9 service tiles; one opens its detail (qué entregamos + reglas de oro) and «Volver» returns", () => {
    render(<ServiciosView />);
    expect(screen.getByText(/guía interna para digitadores/i)).toBeTruthy();
    const grid = screen.getByLabelText("Servicios");
    expect(within(grid).getAllByRole("button")).toHaveLength(9);
    fireEvent.click(within(grid).getByRole("button", { name: /digitación/i }));
    const detail = screen.getByRole("region", { name: /digitación/i });
    expect(within(detail).getByText(serviciosData[0].desc)).toBeTruthy();
    expect(within(detail).getByText(/¿qué entregamos\?/i)).toBeTruthy();
    expect(within(detail).getByText(serviciosData[0].incluye[0])).toBeTruthy();
    expect(within(detail).getByText(/reglas de oro/i)).toBeTruthy();
    expect(within(detail).getByText(serviciosData[0].reglas[1])).toBeTruthy();
    fireEvent.click(within(detail).getByRole("button", { name: /volver a servicios/i }));
    expect(screen.queryByRole("region", { name: /digitación/i })).toBeNull();
    expect(within(screen.getByLabelText("Servicios")).getAllByRole("button")).toHaveLength(9);
  });

  it("Trámites: sidebar + Fases / Dinero / Filtro", () => {
    render(<ServiciosView />);
    fireEvent.click(screen.getByRole("tab", { name: /trámites/i }));
    const side = screen.getByRole("list", { name: /trámites/i });
    expect(within(side).getAllByRole("button")).toHaveLength(tramitesData.length);
    expect(within(side).getByRole("button", { name: /traspaso vehículo/i }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("heading", { name: /traspaso vehículo/i })).toBeTruthy();
    // fases: numbered, without the "1. " prefix of the data
    expect(screen.getByText(/ACTO DE VENTA de vehículo debidamente notarizado\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /dinero/i }));
    expect(screen.getByText(/tabla oficial de costos/i)).toBeTruthy();
    expect(screen.getByText("RD$ 1,000+")).toBeTruthy();
    expect(screen.getByText("2% Tabla")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /filtro/i }));
    expect(screen.getByText(/preguntas obligatorias al cliente/i)).toBeTruthy();
    expect(screen.getByText(/¿Tachas, deudas u oposiciones\?/)).toBeTruthy();
    // another trámite resets to Fases
    fireEvent.click(within(side).getByRole("button", { name: /salida de menor/i }));
    expect(screen.getByRole("heading", { name: /salida de menor/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /fases/i }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/PODER ESPECIAL de autorización notarizado\./)).toBeTruthy();
  });
});
