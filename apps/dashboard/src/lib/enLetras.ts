// Numbers in words, the way Dominican deeds write them ("NOVENTA Y DOS MILLONES … PESOS DOMINICANOS").

const UNIDADES = ["CERO", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ",
  "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE",
  "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS",
  "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function hasta999(n: number): string {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (c) parts.push(CENTENAS[c]);
  if (r) parts.push(r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` Y ${UNIDADES[r % 10]}` : ""));
  return parts.join(" ");
}

// "UNO" becomes "UN" / "VEINTIÚN" before MIL and MILLÓN(ES)
const apocope = (s: string) => s.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN");

export function numeroEnLetras(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (millones) parts.push(millones === 1 ? "UN MILLÓN" : `${apocope(numeroEnLetras(millones))} MILLONES`);
  if (miles) parts.push(miles === 1 ? "MIL" : `${apocope(hasta999(miles))} MIL`);
  if (resto) parts.push(hasta999(resto));
  return parts.join(" ");
}

// "RD$ 92,000,960.00" → words + "PESOS DOMINICANOS" (+ "CON 50/100" when there are cents)
export function montoEnLetras(raw: string): string | null {
  const clean = String(raw).replace(/[^\d.,]/g, "");
  if (!/\d/.test(clean)) return null;
  const [entero, dec = ""] = clean.replace(/,/g, "").split(".");
  const n = Number(entero || "0");
  if (!Number.isFinite(n)) return null;
  const palabras = numeroEnLetras(n);
  const de = n > 0 && n % 1_000_000 === 0 ? " DE" : "";
  const centavos = Number((dec + "00").slice(0, 2));
  return `${palabras}${de} PESOS DOMINICANOS${centavos ? ` CON ${String(centavos).padStart(2, "0")}/100` : ""}`;
}

// A tag ending in _LETRAS/_TEXTO can be written from its _NUMEROS/_NUMERO sibling when it has a value
export function letrasPara(key: string, values: Record<string, string>): string | null {
  const m = key.match(/^(.*)_(LETRAS|TEXTO)(.*)$/);
  if (!m) return null;
  const [, base, kind, rest] = m;
  const siblings = kind === "LETRAS" ? ["NUMEROS", "NUMERO"] : ["NUMERO", "NUMEROS"];
  for (const s of siblings) {
    const v = values[`${base}_${s}${rest}`];
    if (v && /\d/.test(v)) {
      const money = /PRECIO|MONTO|SUMA|VALOR|PAGO|CUOTA|RENTA|ALQUILER|PESOS|RD\$/i.test(base + v);
      return money ? montoEnLetras(v) : numeroEnLetras(Number(v.replace(/[^\d]/g, "")));
    }
  }
  return null;
}
