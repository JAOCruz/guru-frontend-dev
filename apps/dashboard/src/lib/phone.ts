// A WhatsApp number as people read it: (809) 555-0101
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1"))
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  // WhatsApp @lid privacy ID — real number hidden by WA; show the full identifier,
  // grouped for readability (e.g. "233 891 151 499 341" instead of one long blob).
  if (d.length > 12) return d.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  return phone;
}
