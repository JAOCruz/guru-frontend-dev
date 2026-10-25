// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { username: "hengi", dataColumn: "HENGI" } }) }));

import EmployeeDataTable from "./EmployeeDataTable";

const S = (id: number, service_name: string) => ({ id, service_name, client: "Juan Pérez", time: "10:00 AM", earnings: 1500, date: "2026-10-25" });
afterEach(cleanup);

describe("EmployeeDataTable", () => {
  it("highlights the service a notification points to and scrolls to it", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<EmployeeDataTable services={[S(1, "Copia"), S(2, "Poder notarial")]} highlightId={2} />);
    const marked = screen.getAllByText("Poder notarial").map((el) => el.closest("[aria-current]"));
    expect(marked.every((el) => el?.getAttribute("aria-current") === "true")).toBe(true);
    expect(screen.getAllByText("Copia").every((el) => !el.closest("[aria-current]"))).toBe(true);
    expect(scroll).toHaveBeenCalled();
  });

  it("without a notification nothing is highlighted", () => {
    render(<EmployeeDataTable services={[S(1, "Copia")]} />);
    expect(document.querySelector("[aria-current]")).toBeNull();
  });
});
