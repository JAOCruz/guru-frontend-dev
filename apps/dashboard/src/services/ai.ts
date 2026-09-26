import api from "./api";

// Short AI analysis through the backend proxy (/api/ai/generate keeps the Gemini key server-side)
export async function generateInsight(prompt: string): Promise<string> {
  try {
    const { data } = await api.post("/ai/generate", { prompt });
    return data.text || "No se pudo generar análisis.";
  } catch (err: any) {
    if (err?.response?.status === 503) return "La IA no está configurada en el servidor.";
    return "Error conectando con la IA.";
  }
}
