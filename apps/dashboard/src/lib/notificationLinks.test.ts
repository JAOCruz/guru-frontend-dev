import { describe, it, expect } from "vitest";
import { notificationPath } from "./notificationLinks";

describe("notificationPath", () => {
  it("keeps valid dashboard paths with their query", () => {
    expect(notificationPath("/cotizaciones?invoice=12")).toBe("/cotizaciones?invoice=12");
    expect(notificationPath("/bot-messages?phone=1809")).toBe("/bot-messages?phone=1809");
  });
  it("maps the old Spanish documents path to the real route", () => {
    expect(notificationPath("/documentos")).toBe("/documents");
  });
  it("opens the case from old case detail links", () => {
    expect(notificationPath("/cases/45")).toBe("/cases?case=45");
    expect(notificationPath("/cases?case=45")).toBe("/cases?case=45");
  });
  it("drops a /dashboard prefix and adds the leading slash", () => {
    expect(notificationPath("/dashboard/cases")).toBe("/cases");
    expect(notificationPath("cotizaciones")).toBe("/cotizaciones");
  });
  it("returns null without a link", () => {
    expect(notificationPath(undefined)).toBeNull();
    expect(notificationPath("")).toBeNull();
  });
});
