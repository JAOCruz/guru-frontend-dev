export type ColorKey =
  | "green" | "yellow" | "red" | "purple" | "orange" | "pink"
  | "teal" | "cyan" | "blue" | "indigo" | "lime" | "brown";

export type AvatarKey =
  | "cow" | "cat" | "dog" | "horse" | "pig" | "rabbit" | "rooster" | "lion"
  | "tiger" | "bear" | "panda" | "fox" | "frog" | "giraffe" | "koala" | "monkey"
  | "hamster" | "mouse" | "wolf" | "boar" | "unicorn" | "dragon" | "raccoon" | "zebra"
  | "owl";

export interface PaletteColor {
  label: string;
  bg: string;
  text: string;
}

export interface DirectoryUser {
  id: number;
  name: string | null;
  username: string | null;
  data_column: string | null;
  role: string;
  color: string | null;
  avatar: string | null;
  is_active: boolean;
  in_payroll: boolean;
}

export interface Appearance {
  color: PaletteColor;
  emoji: string | null;
  name: string;
  initial: string;
}

// Must match guruweb-backend src/config/appearance.js (keys + order)
export const COLOR_PALETTE: Record<ColorKey, PaletteColor> = {
  green: { label: "Verde", bg: "#22c55e", text: "#ffffff" },
  yellow: { label: "Amarillo", bg: "#facc15", text: "#000000" },
  red: { label: "Rojo", bg: "#ef4444", text: "#ffffff" },
  purple: { label: "Morado", bg: "#9333ea", text: "#ffffff" },
  orange: { label: "Naranja", bg: "#f97316", text: "#ffffff" },
  pink: { label: "Rosado", bg: "#ec4899", text: "#ffffff" },
  teal: { label: "Teal", bg: "#14b8a6", text: "#ffffff" },
  cyan: { label: "Cyan", bg: "#06b6d4", text: "#000000" },
  blue: { label: "Azul", bg: "#3b82f6", text: "#ffffff" },
  indigo: { label: "Índigo", bg: "#6366f1", text: "#ffffff" },
  lime: { label: "Lima", bg: "#84cc16", text: "#000000" },
  brown: { label: "Marrón", bg: "#92400e", text: "#ffffff" },
};

export const COLOR_KEYS = Object.keys(COLOR_PALETTE) as ColorKey[];

// Animal faces (must match guruweb-backend src/config/appearance.js). The owl has
// no face emoji and is reserved for the admin.
export const AVATARS: Record<AvatarKey, { emoji: string; label: string }> = {
  cow: { emoji: "🐮", label: "Vaca" },
  cat: { emoji: "🐱", label: "Gato" },
  dog: { emoji: "🐶", label: "Perro" },
  horse: { emoji: "🐴", label: "Caballo" },
  pig: { emoji: "🐷", label: "Cerdo" },
  rabbit: { emoji: "🐰", label: "Conejo" },
  rooster: { emoji: "🐔", label: "Gallina" },
  lion: { emoji: "🦁", label: "León" },
  tiger: { emoji: "🐯", label: "Tigre" },
  bear: { emoji: "🐻", label: "Oso" },
  panda: { emoji: "🐼", label: "Panda" },
  fox: { emoji: "🦊", label: "Zorro" },
  frog: { emoji: "🐸", label: "Rana" },
  giraffe: { emoji: "🦒", label: "Jirafa" },
  koala: { emoji: "🐨", label: "Koala" },
  monkey: { emoji: "🐵", label: "Mono" },
  hamster: { emoji: "🐹", label: "Hámster" },
  mouse: { emoji: "🐭", label: "Ratón" },
  wolf: { emoji: "🐺", label: "Lobo" },
  boar: { emoji: "🐗", label: "Jabalí" },
  unicorn: { emoji: "🦄", label: "Unicornio" },
  dragon: { emoji: "🐲", label: "Dragón" },
  raccoon: { emoji: "🦝", label: "Mapache" },
  zebra: { emoji: "🦓", label: "Cebra" },
  owl: { emoji: "🦉", label: "Búho" },
};

export const AVATAR_KEYS = Object.keys(AVATARS) as AvatarKey[];

export const ADMIN_ONLY_AVATAR: AvatarKey = "owl";

export const FALLBACK_COLOR: PaletteColor = { label: "Sin color", bg: "#9ca3af", text: "#ffffff" };

export function resolveColor(key?: string | null): PaletteColor {
  return key && key in COLOR_PALETTE ? COLOR_PALETTE[key as ColorKey] : FALLBACK_COLOR;
}

export function resolveAvatar(key?: string | null): string | null {
  return key && key in AVATARS ? AVATARS[key as AvatarKey].emoji : null;
}

export function initialOf(name?: string | null): string {
  return (name || "").trim().charAt(0).toUpperCase() || "?";
}

export function findUserByColumn(users: DirectoryUser[], column?: string | null): DirectoryUser | undefined {
  if (!column) return undefined;
  const target = column.toUpperCase();
  return users.find((u) => (u.data_column || "").toUpperCase() === target);
}

export function toAppearance(
  user: { name?: string | null; username?: string | null; color?: string | null; avatar?: string | null } | undefined,
  fallbackName = "?",
): Appearance {
  const name = user?.name || user?.username || fallbackName;
  return {
    color: resolveColor(user?.color),
    emoji: resolveAvatar(user?.avatar),
    name,
    initial: initialOf(name),
  };
}
