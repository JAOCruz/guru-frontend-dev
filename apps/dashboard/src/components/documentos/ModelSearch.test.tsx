// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { docs, tags, dialogs, auth } = vi.hoisted(() => ({
  docs: { models: vi.fn(), aiSearch: vi.fn() },
  tags: { requestPublish: vi.fn(), remove: vi.fn(), aiTag: vi.fn() },
  dialogs: { confirmDialog: vi.fn(() => Promise.resolve(true)), notify: vi.fn() },
  auth: { isAdmin: false },
}));
vi.mock("../../services/documentosApi", async (orig) => ({ ...(await orig<object>()), documentosAPI: docs }));
vi.mock("../../services/etiquetasApi", async (orig) => ({ ...(await orig<object>()), etiquetasAPI: tags }));
vi.mock("../../lib/dialogs", () => dialogs);
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("./TagEditor", () => ({ default: ({ mode }: { mode: string }) => <div>editor {mode}</div> }));
vi.mock("./UploadModelDialog", () => ({ default: () => <div>diálogo de subida</div> }));
vi.mock("./PdfPreview", () => ({ default: () => null }));
vi.mock("./PersonalizeDialog", () => ({ default: () => null }));

import ModelSearch from "./ModelSearch";

const base = { file_name: "x.docx", category: "Poderes" };
const MINE = { ...base, id: 1, name: "Mi poder", is_private: true, can_manage: true, tag_status: "pending", publish_requested_at: null };
const UNTAGGED = { ...base, id: 2, name: "Sin etiquetas", is_private: true, can_manage: true, tag_status: "untagged", publish_requested_at: null };
const OFFICIAL = { ...base, id: 3, name: "Oficial", is_private: false, can_manage: false, tag_status: "approved" };
const row = async (name: string) => (await screen.findByText(name)).closest("li") as HTMLElement;
const show = () => render(<MemoryRouter><ModelSearch /></MemoryRouter>);

beforeEach(() => {
  auth.isAdmin = false;
  docs.models.mockReset();
  Object.values(tags).forEach((m) => m.mockReset());
  docs.models.mockResolvedValue({ data: { models: [MINE, UNTAGGED, OFFICIAL] } });
});
afterEach(cleanup);

describe("Biblioteca: modelos privados", () => {
  it("el dueño ve su modelo privado, listo para llenar, y lo gestiona; no reporta correcciones", async () => {
    show();
    const r = within(await row("Mi poder"));
    expect(r.getByText(/Privado/)).toBeTruthy();
    expect(r.getByText(/Listo para llenar/)).toBeTruthy();
    expect(r.getByRole("button", { name: /Llenar/ })).toBeTruthy();
    expect(r.getByRole("button", { name: /Editar etiquetas/ })).toBeTruthy();
    expect(r.getByRole("button", { name: /Pedir que se publique/ })).toBeTruthy();
    expect(r.queryByRole("button", { name: /Corregir/ })).toBeNull();
  });

  it("un modelo sin etiquetas ofrece etiquetar y no llenar ni publicar", async () => {
    show();
    const r = within(await row("Sin etiquetas"));
    expect(r.getByRole("button", { name: /Etiquetar con IA/ })).toBeTruthy();
    expect(r.queryByRole("button", { name: /Llenar/ })).toBeNull();
    expect(r.queryByRole("button", { name: /Pedir que se publique/ })).toBeNull();
  });

  it("un modelo publicado no se gestiona desde aquí", async () => {
    show();
    const r = within(await row("Oficial"));
    expect(r.queryByText(/Privado/)).toBeNull();
    expect(r.queryByRole("button", { name: /Editar etiquetas/ })).toBeNull();
    expect(r.queryByRole("button", { name: /Eliminar/ })).toBeNull();
    expect(r.getByRole("button", { name: /Corregir/ })).toBeTruthy();
  });

  it("pedir que se publique avisa y vuelve a cargar la lista", async () => {
    tags.requestPublish.mockResolvedValue({ data: {} });
    show();
    const r = within(await row("Mi poder"));
    fireEvent.click(r.getByRole("button", { name: /Pedir que se publique/ }));
    await waitFor(() => expect(tags.requestPublish).toHaveBeenCalledWith(1));
    await waitFor(() => expect(docs.models).toHaveBeenCalledTimes(2));
  });

  it("si ya lo pidió, lo dice en vez de ofrecerlo otra vez", async () => {
    docs.models.mockResolvedValue({ data: { models: [{ ...MINE, publish_requested_at: "2026-11-04" }] } });
    show();
    const r = within(await row("Mi poder"));
    expect(r.getByText(/Publicación pedida/)).toBeTruthy();
    expect(r.queryByRole("button", { name: /Pedir que se publique/ })).toBeNull();
  });

  it("el admin ve de quién es el modelo privado", async () => {
    auth.isAdmin = true;
    docs.models.mockResolvedValue({ data: { models: [{ ...MINE, owner_name: "Hengi" }] } });
    show();
    expect(within(await row("Mi poder")).getByText(/Privado de Hengi/)).toBeTruthy();
  });

  it("borrar pide confirmación y vuelve a cargar", async () => {
    tags.remove.mockResolvedValue({ data: {} });
    show();
    fireEvent.click(within(await row("Mi poder")).getByRole("button", { name: /Eliminar Mi poder/ }));
    await waitFor(() => expect(tags.remove).toHaveBeenCalledWith(1));
    expect(dialogs.confirmDialog).toHaveBeenCalled();
    await waitFor(() => expect(docs.models).toHaveBeenCalledTimes(2));
  });

  it("subir abre el diálogo", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Subir mi modelo/ }));
    expect(screen.getByText("diálogo de subida")).toBeTruthy();
  });
});
