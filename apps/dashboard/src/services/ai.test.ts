import { describe, it, expect, vi, beforeEach } from "vitest";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("./api", () => ({ default: { post } }));

import { generateInsight } from "./ai";

beforeEach(() => {
  post.mockReset();
});

describe("generateInsight", () => {
  it("asks the backend proxy (the API key never reaches the browser)", async () => {
    post.mockResolvedValue({ data: { text: "📈 Buen día" } });
    expect(await generateInsight("analiza")).toBe("📈 Buen día");
    expect(post).toHaveBeenCalledWith("/ai/generate", { prompt: "analiza" });
  });

  it("returns a friendly message when the AI is not configured", async () => {
    post.mockRejectedValue({ response: { status: 503 } });
    expect(await generateInsight("analiza")).toBe("La IA no está configurada en el servidor.");
  });

  it("returns a friendly message on other errors", async () => {
    post.mockRejectedValue(new Error("boom"));
    expect(await generateInsight("analiza")).toBe("Error conectando con la IA.");
  });
});
