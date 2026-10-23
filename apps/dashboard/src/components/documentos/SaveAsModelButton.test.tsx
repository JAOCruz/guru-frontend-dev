// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const { tags, dialogs } = vi.hoisted(() => ({
  tags: { fromDocument: vi.fn() },
  dialogs: { confirmDialog: vi.fn((_message: string, _opts?: object) => Promise.resolve(true)), notify: vi.fn() },
}));
vi.mock("../../services/etiquetasApi", async (orig) => ({ ...(await orig<object>()), etiquetasAPI: tags }));
vi.mock("../../lib/dialogs", () => dialogs);

import SaveAsModelButton from "./SaveAsModelButton";

beforeEach(() => {
  tags.fromDocument.mockReset();
  dialogs.confirmDialog.mockClear();
  dialogs.confirmDialog.mockImplementation((_m: string) => Promise.resolve(true));
  dialogs.notify.mockClear();
});
afterEach(cleanup);

const click = () => fireEvent.click(screen.getByRole("button", { name: /Guardar como nueva versión del modelo/ }));

describe("Guardar como nueva versión del modelo", () => {
  it("asks first, saves the document's text as the model's next version and says the admin must approve it", async () => {
    tags.fromDocument.mockResolvedValue({ data: { version: { id: 9, version_number: 2 }, model_name: "PODER ESPECIAL", client_data_left: [] } });
    render(<SaveAsModelButton documentId={30} />);
    click();
    await waitFor(() => expect(tags.fromDocument).toHaveBeenCalledWith(30));
    expect(dialogs.confirmDialog.mock.calls[0][0]).toMatch(/datos del cliente/);
    await waitFor(() => expect(dialogs.notify).toHaveBeenCalledWith(expect.stringMatching(/v2 de «PODER ESPECIAL».*aprobar/), "success"));
  });

  it("warns when the client's data is still in some paragraphs", async () => {
    tags.fromDocument.mockResolvedValue({ data: { version: { id: 9, version_number: 2 }, model_name: "PODER ESPECIAL", client_data_left: [2, 5] } });
    render(<SaveAsModelButton documentId={30} />);
    click();
    await waitFor(() => expect(dialogs.notify).toHaveBeenCalledWith(expect.stringMatching(/párrafo 2, 5/), "error"));
  });

  it("does nothing when cancelled, and shows the server's error", async () => {
    dialogs.confirmDialog.mockImplementation((_m: string) => Promise.resolve(false));
    render(<SaveAsModelButton documentId={30} />);
    click();
    await waitFor(() => expect(dialogs.confirmDialog).toHaveBeenCalled());
    expect(tags.fromDocument).not.toHaveBeenCalled();

    dialogs.confirmDialog.mockImplementation((_m: string) => Promise.resolve(true));
    tags.fromDocument.mockRejectedValue({ response: { data: { error: "Este documento no tiene un Word (.docx) para guardarlo como modelo" } } });
    click();
    await waitFor(() => expect(dialogs.notify).toHaveBeenCalledWith("Este documento no tiene un Word (.docx) para guardarlo como modelo"));
  });
});
