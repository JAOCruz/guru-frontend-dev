// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { tags } = vi.hoisted(() => ({ tags: { categories: vi.fn(), uploadModel: vi.fn(), aiTag: vi.fn() } }));
vi.mock("../../services/etiquetasApi", async (orig) => ({ ...(await orig<object>()), etiquetasAPI: tags }));

import UploadModelDialog from "./UploadModelDialog";

const word = (name = "mi poder.docx", size = 10) => {
  const f = new File(["x"], name);
  Object.defineProperty(f, "size", { value: size });
  return f;
};
const choose = (f: File) => fireEvent.change(screen.getByLabelText(/Archivo Word/), { target: { files: [f] } });
const fillForm = async () => {
  await screen.findByRole("option", { name: "Poderes" });
  choose(word());
  fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "1" } });
};

beforeEach(() => {
  Object.values(tags).forEach((m) => m.mockReset());
  tags.categories.mockResolvedValue({ data: { categories: [{ id: 1, name: "Poderes" }] } });
});
afterEach(cleanup);

describe("Subir mi modelo", () => {
  it("rechaza lo que no es Word y lo que pasa de 20 MB", async () => {
    render(<UploadModelDialog onClose={() => {}} onDone={() => {}} />);
    choose(word("contrato.pdf"));
    expect(screen.getByRole("alert").textContent).toMatch(/Solo documentos Word/);
    choose(word("grande.docx", 21 * 1024 * 1024));
    expect(screen.getByRole("alert").textContent).toMatch(/pasa de 20 MB/);
    fireEvent.click(screen.getByRole("button", { name: /^Subir$/ }));
    expect(tags.uploadModel).not.toHaveBeenCalled();
  });

  it("toma el nombre del archivo, sube, etiqueta y entrega el modelo", async () => {
    const onDone = vi.fn();
    tags.uploadModel.mockResolvedValue({ data: { model: { id: 5 } } });
    tags.aiTag.mockResolvedValue({ data: { model: { id: 5, status: "pending" } } });
    render(<UploadModelDialog onClose={() => {}} onDone={onDone} />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /^Subir$/ }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ id: 5, status: "pending" }));
    expect(tags.uploadModel.mock.calls[0][0]).toMatchObject({ name: "mi poder", category_id: 1 });
  });

  it("si la IA falla, dice que quedó guardado y deja reintentar", async () => {
    const onDone = vi.fn();
    const onSaved = vi.fn();
    tags.uploadModel.mockResolvedValue({ data: { model: { id: 5 } } });
    tags.aiTag.mockRejectedValueOnce({ response: { data: { error: "La IA no respondió" } } });
    tags.aiTag.mockResolvedValueOnce({ data: { model: { id: 5, status: "pending" } } });
    render(<UploadModelDialog onClose={() => {}} onDone={onDone} onSaved={onSaved} />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /^Subir$/ }));
    const retry = await screen.findByRole("button", { name: /Reintentar con IA/ });
    expect(screen.getByRole("alert").textContent).toMatch(/quedó guardado/);
    expect(onSaved).toHaveBeenCalled();
    fireEvent.click(retry);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(tags.uploadModel).toHaveBeenCalledTimes(1);
  });

  it("muestra el error del servidor y no etiqueta", async () => {
    tags.uploadModel.mockRejectedValue({ response: { data: { error: "Ese archivo no es un Word válido" } } });
    render(<UploadModelDialog onClose={() => {}} onDone={() => {}} />);
    await fillForm();
    fireEvent.click(screen.getByRole("button", { name: /^Subir$/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/no es un Word válido/);
    expect(tags.aiTag).not.toHaveBeenCalled();
  });
});
