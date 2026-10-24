// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("../../services/api", () => ({ servicesAPI: {} }));
vi.mock("../../services/ai", () => ({ generateInsight: vi.fn() }));
vi.mock("../../context/UserColorsContext", () => ({
  useUserColors: () => ({ appearanceOfColumn: () => ({ color: { bg: "#000", text: "#fff" }, emoji: null }) }),
}));

import AdminDataTable from "./AdminDataTable";

afterEach(cleanup);

const data = [
  { DETALLE: "SERVICIO", ANA: "Poder especial", ANA_id: 1, LUIS: "Acto de venta", LUIS_id: 2 },
  { DETALLE: "CLIENTE", ANA: "Cliente A", LUIS: "Cliente B" },
  { DETALLE: "HORA", ANA: "10:00", LUIS: "11:00" },
  { DETALLE: "GANANCIA", ANA: 1000, LUIS: 2000 },
  { DETALLE: "NOTA", ANA: "", LUIS: "" },
];
const table = (focus: { worker: string; at: number } | null) => (
  <AdminDataTable data={data as any} onSort={() => {}} employeePercentage={50} workers={["ANA", "LUIS"]} focus={focus} />
);

describe("AdminDataTable focus from the dashboard cards", () => {
  it("shows only the tapped digitador's services, and everyone's again from the totals", () => {
    const { rerender } = render(table(null));
    expect(screen.getAllByText("Poder especial").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Acto de venta").length).toBeGreaterThan(0);

    rerender(table({ worker: "LUIS", at: 1 }));
    expect(screen.queryAllByText("Poder especial")).toHaveLength(0);
    expect(screen.getAllByText("Acto de venta").length).toBeGreaterThan(0);

    rerender(table({ worker: "all", at: 2 }));
    expect(screen.getAllByText("Poder especial").length).toBeGreaterThan(0);
  });
});
