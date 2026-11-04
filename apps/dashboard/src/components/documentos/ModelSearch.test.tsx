// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { docs, tags, dialogs, auth, fetchFile } = vi.hoisted(() => ({
  fetchFile: vi.fn(),
  docs: { models: vi.fn(), aiSearch: vi.fn() },
  tags: { requestPublish: vi.fn(), remove: vi.fn(), aiTag: vi.fn() },
  dialogs: { confirmDialog: vi.fn(() => Promise.resolve(true)), notify: vi.fn() },
  auth: { isAdmin: false },
}));
vi.mock("../../services/documentosApi", async (orig) => ({ ...(await orig<object>()), documentosAPI: docs, fetchFile }));
vi.mock("../../services/etiquetasApi", async (orig) => ({ ...(await orig<object>()), etiquetasAPI: tags }));
vi.mock("../../lib/dialogs", () => dialogs);
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("./TagEditor", () => ({ default: ({ mode }: { mode: string }) => <div>editor {mode}</div> }));
vi.mock("./UploadModelDialog", () => ({ default: () => <div>diálogo de subida</div> }));
vi.mock("./PdfPreview", () => ({ default: ({ title }: { title: string }) => <div>vista previa de {title}</div> }));
vi.mock("./PersonalizeDialog", () => ({ default: () => null }));

import ModelSearch from "./ModelSearch";
import { clearThumbnailCache } from "./ModelThumb";

const base = { file_name: "x.docx", category: "Poderes" };
const MINE = { ...base, id: 1, name: "Mi poder", is_private: true, can_manage: true, tag_status: "pending", publish_requested_at: null };
const UNTAGGED = { ...base, id: 2, name: "Sin etiquetas", is_private: true, can_manage: true, tag_status: "untagged", publish_requested_at: null };
const OFFICIAL = { ...base, id: 3, name: "Oficial", is_private: false, can_manage: false, tag_status: "approved" };
const row = async (name: string) => (await screen.findByText(name)).closest("li") as HTMLElement;
const showCards = () => render(<MemoryRouter><ModelSearch /></MemoryRouter>);
// searching by name turns the cards into the list with every action in view
const show = () => {
  showCards();
  fireEvent.change(screen.getByLabelText("Buscar modelo"), { target: { value: "modelo" } });
};
const card = async (name: string) => (await screen.findByRole("heading", { name })).closest("li") as HTMLElement;

beforeEach(() => {
  auth.isAdmin = false;
  clearThumbnailCache();
  fetchFile.mockReset();
  fetchFile.mockResolvedValue("blob:miniatura");
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

describe("Biblioteca: cuadros", () => {
  it("sin búsqueda muestra un cuadro por modelo, con nombre, categoría y descripción", async () => {
    docs.models.mockResolvedValue({ data: { models: [{ ...OFFICIAL, description: "Para vender un vehículo" }] } });
    showCards();
    const c = within(await card("Oficial"));
    expect(c.getByText("Poderes")).toBeTruthy();
    expect(c.getByText("Para vender un vehículo")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Modelos" })).toBeTruthy();
  });

  it("no repite la descripción automática que solo copia el nombre del archivo", async () => {
    docs.models.mockResolvedValue({ data: { models: [{ ...OFFICIAL, description: "Plantilla: OFICIAL.docx" }] } });
    showCards();
    expect(within(await card("Oficial")).queryByText(/Plantilla:/)).toBeNull();
  });

  it("marca el modelo más usado, el privado y, solo al admin, el que falta por publicar", async () => {
    auth.isAdmin = true;
    docs.models.mockResolvedValue({
      data: {
        models: [
          { ...OFFICIAL, most_used: true },
          { ...MINE, owner_name: "Hengi" },
          { ...OFFICIAL, id: 4, name: "Pendiente", tag_status: "pending" },
        ],
      },
    });
    showCards();
    expect(within(await card("Oficial")).getByText("Más usado")).toBeTruthy();
    expect(within(await card("Mi poder")).getByText(/Privado de Hengi/)).toBeTruthy();
    expect(within(await card("Pendiente")).getByText("Por publicar")).toBeTruthy();
  });

  it("un digitador no ve la marca «Por publicar»", async () => {
    docs.models.mockResolvedValue({ data: { models: [{ ...OFFICIAL, tag_status: "pending" }] } });
    showCards();
    expect(within(await card("Oficial")).queryByText("Por publicar")).toBeNull();
  });

  it("deja a la vista la acción principal y guarda las demás en «Más»", async () => {
    showCards();
    const c = within(await card("Mi poder"));
    expect(c.getByRole("button", { name: /Llenar/ })).toBeTruthy();
    expect(c.queryByRole("button", { name: /Pedir que se publique/ })).toBeNull();
    fireEvent.click(c.getByRole("button", { name: /Más acciones de Mi poder/ }));
    tags.requestPublish.mockResolvedValue({ data: {} });
    fireEvent.click(c.getByRole("menuitem", { name: /Pedir que se publique/ }));
    await waitFor(() => expect(tags.requestPublish).toHaveBeenCalledWith(1));
    expect(c.queryByRole("menu")).toBeNull();
  });

  it("un modelo sin etiquetas ofrece personalizar como acción principal", async () => {
    showCards();
    const c = within(await card("Sin etiquetas"));
    expect(c.getByRole("button", { name: /Personalizar/ })).toBeTruthy();
    expect(c.queryByRole("button", { name: /Llenar/ })).toBeNull();
  });

  it("al tocar la miniatura se abre la vista previa", async () => {
    showCards();
    fireEvent.click(within(await card("Oficial")).getByRole("button", { name: "Ver Oficial" }));
    expect(screen.getByText("vista previa de Oficial")).toBeTruthy();
  });

  it("muestra la primera página y, si no se puede generar, un cuadro sin imagen", async () => {
    fetchFile.mockImplementation((url: string) => (url.includes("/models/3/thumbnail") ? Promise.resolve("blob:oficial") : Promise.reject(new Error("no"))));
    showCards();
    const img = await within(await card("Oficial")).findByRole("img", { name: "Primera página de Oficial" });
    expect(img.getAttribute("src")).toBe("blob:oficial");
    await waitFor(() => expect(fetchFile).toHaveBeenCalledWith(expect.stringContaining("/models/1/thumbnail")));
    await waitFor(() => expect(within(screen.getByRole("heading", { name: "Mi poder" }).closest("li") as HTMLElement).queryByRole("img", { name: /Primera página/ })).toBeNull());
  });

  it("no pide la miniatura de un cuadro hasta que se ve en pantalla", async () => {
    const seen: IntersectionObserverCallback[] = [];
    vi.stubGlobal("IntersectionObserver", class {
      constructor(cb: IntersectionObserverCallback) { seen.push(cb); }
      observe() {}
      disconnect() {}
    });
    try {
      docs.models.mockResolvedValue({ data: { models: [OFFICIAL] } });
      showCards();
      await card("Oficial");
      expect(fetchFile).not.toHaveBeenCalled();
      seen[0]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      await waitFor(() => expect(fetchFile).toHaveBeenCalledTimes(1));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("al buscar por nombre pasa a la lista, y al borrar la búsqueda vuelven los cuadros", async () => {
    showCards();
    await card("Oficial");
    const input = screen.getByLabelText("Buscar modelo");
    fireEvent.change(input, { target: { value: "oficial" } });
    expect(screen.queryByRole("list", { name: "Modelos" })).toBeNull();
    expect(within(await row("Oficial")).getByRole("button", { name: /Corregir/ })).toBeTruthy();
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByRole("list", { name: "Modelos" })).toBeTruthy();
  });
});
