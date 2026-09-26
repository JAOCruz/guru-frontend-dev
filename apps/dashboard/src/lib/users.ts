const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

// Easy to read aloud / type: no 0/O, 1/l/I
export function generateTempPassword(length = 8): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join("");
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
