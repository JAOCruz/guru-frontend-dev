// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TIPS } from "../lib/advisorTips";

const { auth } = vi.hoisted(() => ({ auth: { isAdmin: false, user: { avatar: null as string | null } } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
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

describe("GuruAdvisor — your animal gives the tips", () => {
  it("shows the user's own animal instead of the owl", () => {
    auth.user.avatar = "panda";
    render(<MemoryRouter><GuruAdvisor isOpen={false} onOpenChange={() => {}} /></MemoryRouter>);
    expect(screen.getByText("🐼")).toBeTruthy();
    expect(screen.queryByText("🦉")).toBeNull();
  });

  it("falls back to the owl when the user has no animal", () => {
    auth.user.avatar = null;
    render(<MemoryRouter><GuruAdvisor isOpen={false} onOpenChange={() => {}} /></MemoryRouter>);
    expect(screen.getByText("🦉")).toBeTruthy();
  });
});
