// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
vi.mock("./ModelThumb", () => ({ default: () => null }));
import ModelCard from "./ModelCard";

afterEach(cleanup);
const base = { id: 1, name: "Contrato de alquiler", file_name: "x.docx", category: "ACUERDOS" };
const props = { badge: null, status: null, actions: [{ key: "use", label: "Usar", icon: null, onClick: () => {} }], onPreview: () => {} };

describe("ModelCard — precio por foja", () => {
  it("muestra fojas, tamaño y precio", () => {
    render(<ModelCard {...props} model={{ ...base, fojas: 2, foja_tipo: "legal_simple", precio: 500 }} />);
    expect(screen.getByText("2 fojas legales · RD$500")).toBeTruthy();
  });
  it("sin precio calculado no muestra nada", () => {
    render(<ModelCard {...props} model={base} />);
    expect(screen.queryByText(/RD\$/)).toBeNull();
  });
});
