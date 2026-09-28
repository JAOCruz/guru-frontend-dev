import { describe, it, expect } from "vitest";
import { whatsappAction, canViewDocument } from "./quoteActions";

describe("whatsappAction", () => {
  it("employees ask for approval on drafts and wait while pending", () => {
    expect(whatsappAction({ isAdmin: false, isOwner: true, status: "draft" })).toBe("request");
    expect(whatsappAction({ isAdmin: false, isOwner: true, status: "pending_approval" })).toBe("wait");
  });

  it("employees send their own quote only once approved", () => {
    for (const status of ["approved", "sent", "paid"]) {
      expect(whatsappAction({ isAdmin: false, isOwner: true, status })).toBe("send");
    }
    expect(whatsappAction({ isAdmin: false, isOwner: false, status: "approved" })).toBe("none");
  });

  it("the admin can send anything except a rejected quote", () => {
    for (const status of ["draft", "pending_approval", "approved", "sent", "paid"]) {
      expect(whatsappAction({ isAdmin: true, isOwner: false, status })).toBe("send");
    }
    expect(whatsappAction({ isAdmin: true, isOwner: true, status: "rejected" })).toBe("none");
    expect(whatsappAction({ isAdmin: false, isOwner: true, status: "rejected" })).toBe("none");
  });
});

describe("canViewDocument", () => {
  it("employees see the document only once approved; the admin always", () => {
    for (const status of ["draft", "pending_approval", "rejected"]) {
      expect(canViewDocument({ isAdmin: false, status })).toBe(false);
      expect(canViewDocument({ isAdmin: true, status })).toBe(true);
    }
    for (const status of ["approved", "sent", "paid"]) {
      expect(canViewDocument({ isAdmin: false, status })).toBe(true);
    }
  });
});
