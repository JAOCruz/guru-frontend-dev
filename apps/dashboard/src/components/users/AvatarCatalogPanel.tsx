import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { avatarsAPI } from "../../services/api";
import { useUserColors } from "../../context/UserColorsContext";
import { ADMIN_ONLY_AVATAR, AVATARS, AVATAR_KEYS } from "../../lib/userColors";
import { apiError } from "../../lib/users";

// Admin: which animals employees may pick. One tap turns an animal on or off.
export default function AvatarCatalogPanel() {
  const { users } = useUserColors();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    avatarsAPI
      .getEnabled()
      .then(({ data }) => setEnabled(new Set(data.enabled)))
      .catch((err) => setError(apiError(err)));
  }, []);

  const owners = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => u.avatar && m.set(u.avatar, u.name || u.username || ""));
    return m;
  }, [users]);

  const keys = AVATAR_KEYS.filter((k) => k !== ADMIN_ONLY_AVATAR);

  const toggle = async (key: (typeof keys)[number]) => {
    const next = !enabled.has(key);
    setBusy(key);
    setError(null);
    try {
      const { data } = await avatarsAPI.setEnabled(key, next, AVATARS[key].label);
      setEnabled(new Set(data.enabled));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-8 rounded-base border-2 border-border bg-background shadow-shadow">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block font-heading text-lg font-black">Animales disponibles</span>
          <span className="text-sm text-foreground/70">
            {enabled.size} de {keys.length} activos para los empleados · el 🦉 es solo del admin
          </span>
        </span>
        <ChevronDown size={20} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t-2 border-border p-4">
          <p className="mb-3 text-sm text-foreground/70">
            Toca un animal para activarlo o desactivarlo. Si desactivas uno que alguien ya usa, lo conserva, pero nadie más
            podrá elegirlo.
          </p>
          {error && <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
            {keys.map((key) => {
              const on = enabled.has(key);
              const owner = owners.get(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  disabled={busy === key}
                  aria-pressed={on}
                  aria-label={AVATARS[key].label}
                  title={`${AVATARS[key].label}${owner ? ` · lo usa ${owner}` : ""}`}
                  className={`flex flex-col items-center gap-0.5 rounded-base border-2 px-1 py-2 text-center transition-all ${
                    on ? "border-border bg-main/15 shadow-button" : "border-border/30 bg-secondary-background opacity-50 grayscale"
                  } ${busy === key ? "animate-pulse" : "hover:-translate-y-0.5"}`}
                >
                  <span className="text-2xl leading-none">{AVATARS[key].emoji}</span>
                  <span className="w-full truncate text-[10px] font-bold">{AVATARS[key].label}</span>
                  {owner && <span className="w-full truncate text-[9px] text-foreground/60">{owner}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
