const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

const LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";

// Easy to read aloud / type (no 0/O, 1/l/I) and always valid for the backend
// policy: at least one letter and one number.
export function generateTempPassword(length = 8): string {
  const bytes = new Uint32Array(length + length);
  crypto.getRandomValues(bytes);
  const pick = (set: string, i: number) => set[bytes[i] % set.length];
  const chars = [pick(LETTERS, 0), pick(DIGITS, 1)];
  for (let i = 2; i < length; i++) chars.push(pick(PASSWORD_ALPHABET, i));
  // Shuffle so the letter/number are not always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[length + i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function roleLabel(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "auxiliar") return "Auxiliar";
  return "Digitador";
}

export function lastSeenLabel(lastSeen: string | null, now = Date.now()): string {
  if (!lastSeen) return "—";
  const minutes = Math.floor((now - new Date(lastSeen).getTime()) / 60_000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function apiError(err: any, fallback = "No se pudo completar la operación"): string {
  return err?.response?.data?.error || fallback;
}
