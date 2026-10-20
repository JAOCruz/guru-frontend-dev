// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import api from "./api";

// A file upload has to go as multipart (the browser sets the boundary), never as JSON.
describe("api", () => {
  it("does not send a FormData body as JSON", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["PK\x03\x04"]), "a.docx");
    fd.append("title", "Prueba");
    let sent: any = null;
    await api.post("/x", fd, {
      adapter: async (config) => {
        sent = config;
        return { data: {}, status: 200, statusText: "OK", headers: {}, config };
      },
    });
    expect(sent.data).toBeInstanceOf(FormData);
    expect(String(sent.headers.get("Content-Type") || "")).not.toMatch(/json/);
  });

  it("keeps JSON for plain bodies", async () => {
    let sent: any = null;
    await api.post("/x", { a: 1 }, {
      adapter: async (config) => {
        sent = config;
        return { data: {}, status: 200, statusText: "OK", headers: {}, config };
      },
    });
    expect(sent.data).toBe('{"a":1}');
    expect(String(sent.headers.get("Content-Type"))).toMatch(/application\/json/);
  });
});
