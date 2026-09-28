// Today's local date as 'YYYY-MM-DD' (toISOString would give tomorrow on RD evenings)
export function todayISO(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// 'YYYY-MM-DD' shown as a local date (new Date('YYYY-MM-DD') is UTC midnight = the day before in RD)
export function formatISODate(iso: string, locale = "es-ES"): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(locale);
}
