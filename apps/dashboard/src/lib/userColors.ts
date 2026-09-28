export type ColorKey =
  | "green" | "yellow" | "red" | "purple" | "orange" | "pink"
  | "teal" | "cyan" | "blue" | "indigo" | "lime" | "brown";

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

// Animal catalog: faces first (the original 24), then full-body animals, then the owl.
// Keys must match guruweb-backend src/config/appearance.js. The owl is the admin's.
export const AVATARS = {
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
  // mammals (full body)
  monkey_full: { emoji: "🐒", label: "Mono (cuerpo)" },
  gorilla: { emoji: "🦍", label: "Gorila" },
  orangutan: { emoji: "🦧", label: "Orangután" },
  dog_full: { emoji: "🐕", label: "Perro (cuerpo)" },
  poodle: { emoji: "🐩", label: "Caniche" },
  guide_dog: { emoji: "🦮", label: "Perro guía" },
  cat_full: { emoji: "🐈", label: "Gato (cuerpo)" },
  tiger_full: { emoji: "🐅", label: "Tigre (cuerpo)" },
  leopard: { emoji: "🐆", label: "Leopardo" },
  horse_full: { emoji: "🐎", label: "Caballo (cuerpo)" },
  deer: { emoji: "🦌", label: "Venado" },
  ox: { emoji: "🐂", label: "Buey" },
  water_buffalo: { emoji: "🐃", label: "Búfalo" },
  cow_full: { emoji: "🐄", label: "Vaca (cuerpo)" },
  pig_full: { emoji: "🐖", label: "Cerdo (cuerpo)" },
  ram: { emoji: "🐏", label: "Carnero" },
  sheep: { emoji: "🐑", label: "Oveja" },
  goat: { emoji: "🐐", label: "Cabra" },
  camel: { emoji: "🐪", label: "Camello" },
  two_hump_camel: { emoji: "🐫", label: "Camello bactriano" },
  llama: { emoji: "🦙", label: "Llama" },
  kangaroo: { emoji: "🦘", label: "Canguro" },
  sloth: { emoji: "🦥", label: "Perezoso" },
  otter: { emoji: "🦦", label: "Nutria" },
  skunk: { emoji: "🦨", label: "Zorrillo" },
  badger: { emoji: "🦡", label: "Tejón" },
  elephant: { emoji: "🐘", label: "Elefante" },
  rhino: { emoji: "🦏", label: "Rinoceronte" },
  hippo: { emoji: "🦛", label: "Hipopótamo" },
  mouse_full: { emoji: "🐁", label: "Ratón (cuerpo)" },
  rat: { emoji: "🐀", label: "Rata" },
  rabbit_full: { emoji: "🐇", label: "Conejo (cuerpo)" },
  chipmunk: { emoji: "🐿️", label: "Ardilla" },
  hedgehog: { emoji: "🦔", label: "Erizo" },
  bat: { emoji: "🦇", label: "Murciélago" },
  // birds
  turkey: { emoji: "🦃", label: "Pavo" },
  chicken_full: { emoji: "🐓", label: "Gallo" },
  hatching_chick: { emoji: "🐣", label: "Pollito naciendo" },
  baby_chick: { emoji: "🐤", label: "Pollito" },
  front_chick: { emoji: "🐥", label: "Pollito (frente)" },
  bird: { emoji: "🐦", label: "Pájaro" },
  penguin: { emoji: "🐧", label: "Pingüino" },
  dove: { emoji: "🕊️", label: "Paloma" },
  eagle: { emoji: "🦅", label: "Águila" },
  duck: { emoji: "🦆", label: "Pato" },
  swan: { emoji: "🦢", label: "Cisne" },
  flamingo: { emoji: "🦩", label: "Flamenco" },
  peacock: { emoji: "🦚", label: "Pavo real" },
  parrot: { emoji: "🦜", label: "Loro" },
  // reptiles
  crocodile: { emoji: "🐊", label: "Cocodrilo" },
  turtle: { emoji: "🐢", label: "Tortuga" },
  lizard: { emoji: "🦎", label: "Lagarto" },
  snake: { emoji: "🐍", label: "Serpiente" },
  dragon_full: { emoji: "🐉", label: "Dragón (cuerpo)" },
  sauropod: { emoji: "🦕", label: "Dinosaurio" },
  t_rex: { emoji: "🦖", label: "T-Rex" },
  // sea
  spouting_whale: { emoji: "🐳", label: "Ballena" },
  whale: { emoji: "🐋", label: "Ballena azul" },
  dolphin: { emoji: "🐬", label: "Delfín" },
  fish: { emoji: "🐟", label: "Pez" },
  tropical_fish: { emoji: "🐠", label: "Pez tropical" },
  blowfish: { emoji: "🐡", label: "Pez globo" },
  shark: { emoji: "🦈", label: "Tiburón" },
  octopus: { emoji: "🐙", label: "Pulpo" },
  crab: { emoji: "🦀", label: "Cangrejo" },
  lobster: { emoji: "🦞", label: "Langosta" },
  shrimp: { emoji: "🦐", label: "Camarón" },
  squid: { emoji: "🦑", label: "Calamar" },
  // bugs
  snail: { emoji: "🐌", label: "Caracol" },
  butterfly: { emoji: "🦋", label: "Mariposa" },
  caterpillar: { emoji: "🐛", label: "Oruga" },
  ant: { emoji: "🐜", label: "Hormiga" },
  bee: { emoji: "🐝", label: "Abeja" },
  ladybug: { emoji: "🐞", label: "Mariquita" },
  cricket: { emoji: "🦗", label: "Grillo" },
  spider: { emoji: "🕷️", label: "Araña" },
  scorpion: { emoji: "🦂", label: "Escorpión" },
  mosquito: { emoji: "🦟", label: "Mosquito" },
  owl: { emoji: "🦉", label: "Búho" },
} as const satisfies Record<string, { emoji: string; label: string }>;

export type AvatarKey = keyof typeof AVATARS;

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

// Sidebar and top bar in the employee's own color (identity and diversity). The admin,
// people who picked blue, and anyone without a color keep the Gurú blue.
export function themeFor({ isAdmin, color }: { isAdmin: boolean; color?: string | null }): { main: string; mainForeground: string } | null {
  if (isAdmin || !color || color === "blue" || !(color in COLOR_PALETTE)) return null;
  const c = COLOR_PALETTE[color as ColorKey];
  return { main: c.bg, mainForeground: c.text };
}

const THEME_VARS = ["--main", "--main-foreground", "--main-dark", "--primary", "--primary-hover"] as const;

// Applies the employee's color to every place that uses the Gurú blue (buttons, cards,
// charts, sidebar…). null restores the Gurú blue. Idempotent.
export function applyRootTheme(theme: ReturnType<typeof themeFor>, root: HTMLElement = document.documentElement) {
  if (!theme) {
    THEME_VARS.forEach((v) => root.style.removeProperty(v));
    return;
  }
  const dark = `color-mix(in srgb, ${theme.main} 80%, black)`;
  root.style.setProperty("--main", theme.main);
  root.style.setProperty("--main-foreground", theme.mainForeground);
  root.style.setProperty("--main-dark", dark);
  root.style.setProperty("--primary", theme.main);
  root.style.setProperty("--primary-hover", dark);
}
