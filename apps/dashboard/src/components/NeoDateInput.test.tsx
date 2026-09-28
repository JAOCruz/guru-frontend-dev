// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NeoDateInput } from "@guru/ui";

afterEach(cleanup);

describe("NeoDateInput", () => {
  it("the calendar icon and the field open the date picker", () => {
    const showPicker = vi.fn();
    (HTMLInputElement.prototype as any).showPicker = showPicker;
    render(<NeoDateInput aria-label="Desde" value="2026-09-28" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /abrir calendario/i }));
    expect(showPicker).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText("Desde"));
    expect(showPicker).toHaveBeenCalledTimes(2);
  });

  it("does not break where the browser can't open the picker", () => {
    (HTMLInputElement.prototype as any).showPicker = () => {
      throw new Error("NotAllowedError");
    };
    render(<NeoDateInput aria-label="Hasta" value="2026-09-28" onChange={() => {}} />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: /abrir calendario/i }))).not.toThrow();
  });
});
