// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { approveInvoice } = vi.hoisted(() => ({ approveInvoice: vi.fn() }));
vi.mock("../../services/botApi", () => ({ botAPI: { approveInvoice } }));

import QuickApprove, { isQuoteApproval } from "./QuickApprove";

beforeEach(() => { approveInvoice.mockReset(); });
afterEach(cleanup);

const meta = { invoice_id: 42 };

describe("isQuoteApproval", () => {
  it("sí en los avisos de cotización por aprobar", () => {
    for (const title of ["📝 Cotización por aprobar", "Cotización por aprobar (bot de WhatsApp)", "✅ Cotización lista para aprobar"])
      expect(isQuoteApproval({ title, metadata: meta })).toBe(true);
  });
  it("no en facturas, precios por confirmar, decisiones ni avisos sin cotización", () => {
    for (const title of ["📝 Factura por aprobar", "💲 Cotización con precios por confirmar", "✅ Cotización aprobada"])
      expect(isQuoteApproval({ title, metadata: meta })).toBe(false);
    expect(isQuoteApproval({ title: "📝 Cotización por aprobar" })).toBe(false);
    expect(isQuoteApproval({ title: "📝 Cotización por aprobar", metadata: {} })).toBe(false);
  });
});

describe("QuickApprove", () => {
  const setup = () => {
    const parent = vi.fn();
    const onDone = vi.fn();
    render(<div onClick={parent}><QuickApprove invoiceId={42} onDone={onDone} /></div>);
    return { parent, onDone };
  };

  it("aprueba sin abrir el aviso y dice Aprobada", async () => {
    approveInvoice.mockResolvedValue({ data: { invoice: { id: 42, status: "approved" } } });
    const { parent, onDone } = setup();
    fireEvent.click(screen.getByRole("button", { name: /aprobar/i }));
    expect(await screen.findByText("Aprobada ✓")).toBeTruthy();
    expect(approveInvoice).toHaveBeenCalledWith(42);
    expect(onDone).toHaveBeenCalled();
    expect(parent).not.toHaveBeenCalled();
  });

  const fails = (data: object, text: string) => async () => {
    approveInvoice.mockRejectedValue({ response: { status: 400, data } });
    const { parent } = setup();
    fireEvent.click(screen.getByRole("button", { name: /aprobar/i }));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(parent).not.toHaveBeenCalled();
  };
  it("si ya se aprobó o envió, lo dice", fails({ code: "NOT_PENDING", status: "sent" }, "Ya estaba aprobada"));
  it("si se rechazó, lo dice", fails({ code: "NOT_PENDING", status: "rejected" }, "Fue rechazada"));
  it("si faltan precios, pide abrirla", fails({ code: "PRICES_PENDING" }, "Tiene precios por confirmar, ábrela"));
  it("cualquier otro error", async () => {
    approveInvoice.mockRejectedValue(new Error("Network Error"));
    setup();
    fireEvent.click(screen.getByRole("button", { name: /aprobar/i }));
    await waitFor(() => expect(screen.getByText("No se pudo aprobar")).toBeTruthy());
  });
});
