// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TIPS } from "../lib/advisorTips";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ isAdmin: false }) }));
import GuruAdvisor from "./GuruAdvisor";

afterEach(cleanup);

describe("GuruAdvisor", () => {
  it("choosing a topic shows a tip of that topic and remembers it", () => {
    render(<MemoryRouter initialEntries={["/cotizaciones"]}><GuruAdvisor isOpen onOpenChange={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Leyes RD" }));
    expect(screen.getByRole("button", { name: "Leyes RD" }).getAttribute("aria-pressed")).toBe("true");
    const shown = TIPS.filter((t) => t.category === "leyes").map((t) => t.text);
    expect(shown.some((text) => screen.queryByText(text))).toBe(true);
    expect(localStorage.getItem("guru-advisor-topic")).toBe("leyes");
  });
});
