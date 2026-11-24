// Tarifas editables (Catálogo de Precios › Tarifas). Son las mismas del backend (GET/PUT /service-catalog/rates).
//   foja:       tarifa por foja de cada tipo.
//   traduccion: tipos con precio por página que baja por tramos de páginas; total = precio del tramo × páginas.
import { useEffect, useState } from "react";
import { serviceCatalogAPI } from "../services/api";
import { FOJA_RATES } from "./fojaRates";

export interface Tramo { desde: number; precio: number }
export interface TipoTraduccion { key: string; label: string; tramos: Tramo[] }
export interface Rates {
  foja: Record<string, number>;
  traduccion: { tipos: TipoTraduccion[] };
}

export const DEFAULT_RATES: Rates = {
  foja: Object.fromEntries(Object.entries(FOJA_RATES).map(([k, r]) => [k, r.rate])),
  traduccion: {
    tipos: [
      { key: "carta_sencillo", label: "Carta sencillo", tramos: [{ desde: 1, precio: 700 }, { desde: 3, precio: 600 }, { desde: 10, precio: 500 }] },
      { key: "carta_denso", label: "Carta extensivo o denso", tramos: [{ desde: 1, precio: 1000 }, { desde: 3, precio: 800 }, { desde: 10, precio: 700 }] },
      { key: "legal_denso", label: "Legal extensivo o denso", tramos: [{ desde: 1, precio: 1000 }, { desde: 3, precio: 800 }, { desde: 10, precio: 700 }] },
    ],
  },
};

/** Las tarifas por foja que usa todo el dashboard (FOJA_RATES) pasan a ser estas. */
export function applyRates(r: Rates) {
  for (const [k, v] of Object.entries(r.foja)) if (FOJA_RATES[k] && Number(v) > 0) FOJA_RATES[k].rate = Number(v);
}

/** Precio de `paginas` páginas de una traducción de este tipo. */
export function traduccionTotal(t: TipoTraduccion, paginas: number) {
  const n = Math.max(1, Math.floor(paginas) || 1);
  const tramos = [...t.tramos].sort((a, b) => a.desde - b.desde);
  let tramo = tramos[0];
  for (const x of tramos) if (n >= x.desde) tramo = x;
  const porPagina = Number(tramo?.precio) || 0;
  return { porPagina, total: porPagina * n, paginas: n };
}

export const fmtRD = (n: number) => `RD$${Math.round(n).toLocaleString("en-US")}`;

/** «2 fojas legales · RD$500» para la tarjeta de un modelo; null si aún no tiene precio. */
export function modeloPrecioTexto(m: { fojas?: number | null; foja_tipo?: string | null; precio?: number | null }) {
  if (!m.fojas || !m.foja_tipo || !m.precio) return null;
  const [size, kind] = m.foja_tipo.split("_");
  const plural = m.fojas !== 1;
  const tam = size === "legal" ? (plural ? "legales" : "legal") : "carta";
  const mot = kind === "motivada" ? (plural && size === "legal" ? " motivadas" : " motivada") : "";
  return `${m.fojas} ${plural ? "fojas" : "foja"} ${tam}${mot} · ${fmtRD(m.precio)}`;
}

/** Carga las tarifas vigentes una vez (y las aplica). Mientras carga, o si falla, quedan las de siempre. */
export function useTarifas() {
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    serviceCatalogAPI.getRates?.()
      .then((res: { data: { rates: Rates } }) => {
        if (!alive || !res?.data?.rates) return;
        applyRates(res.data.rates);
        setRates(res.data.rates);
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => { alive = false; };
  }, []);
  const replace = (r: Rates) => { applyRates(r); setRates(r); };
  return { rates, loaded, replace };
}
