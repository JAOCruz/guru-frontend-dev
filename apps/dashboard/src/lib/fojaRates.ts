// Tarifas por foja. Mirrors src/models/fojaRates.js in the backend (guruweb-backend). Keep in sync.
export const FOJA_RATES: Record<string, { label: string; rate: number }> = {
  carta_simple: { label: "Carta simple", rate: 150 },
  carta_motivada: { label: "Carta motivada", rate: 300 },
  legal_simple: { label: "Legal simple", rate: 250 },
  legal_motivada: { label: "Legal motivada", rate: 350 },
  modificacion: { label: "Modificación", rate: 150 }, // de 3 fojas en adelante el backend lo deja como rango 100–150
};

/** Precio de un servicio por foja: tarifa × fojas (1 si no se sabe); null si foja_tipo no es válido. */
export function fojaUnitPrice(fojaTipo: unknown, fojas: unknown): number | null {
  const r = typeof fojaTipo === "string" && Object.prototype.hasOwnProperty.call(FOJA_RATES, fojaTipo) ? FOJA_RATES[fojaTipo] : undefined;
  if (!r) return null;
  return r.rate * (Number(fojas) || 1);
}
