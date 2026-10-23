import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { NeoButton } from "@guru/ui";
import { activityAPI, type ActivityCategory, type ActivityItem } from "../services/api";
import { useUserColors } from "../context/UserColorsContext";
import UserAvatar from "../components/UserAvatar";
import { toAppearance } from "../lib/userColors";
import { apiError, lastSeenLabel } from "../lib/users";

const PAGE_SIZE = 50;

const CATEGORIES: { key: ActivityCategory; label: string; cls: string }[] = [
  { key: "usuarios", label: "Usuarios", cls: "bg-blue-100" },
  { key: "facturas", label: "Facturas", cls: "bg-amber-100" },
  { key: "asignaciones", label: "Asignaciones", cls: "bg-purple-100" },
  { key: "servicios", label: "Servicios", cls: "bg-green-100" },
  { key: "seguridad", label: "Seguridad", cls: "bg-red-100" },
  { key: "documentos", label: "Documentos", cls: "bg-teal-100" },
  { key: "whatsapp", label: "WhatsApp", cls: "bg-emerald-100" },
];
const categoryInfo = (key: string) => CATEGORIES.find((c) => c.key === key) ?? { key, label: key, cls: "bg-gray-100" };

const fieldCls = "mt-1 w-full rounded-base border-2 border-border bg-white px-3 py-2 text-sm focus:outline-none";

// Admin "Actividad" page: who did what and when (kept for 1 year)
export default function Actividad() {
  const { users } = useUserColors();
  const [searchParams] = useSearchParams();
  const [actorId, setActorId] = useState(searchParams.get("actor_id") ?? "");
  const [category, setCategory] = useState<ActivityCategory | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const requestId = useRef(0);

  // Debounce the free-text search
  useEffect(() => {
    const t = setTimeout(() => setAppliedQ(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (nextPage: number) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const { data } = await activityAPI.list({
          category,
          actor_id: actorId,
          from: from ? new Date(`${from}T00:00:00`).toISOString() : "",
          to: to ? new Date(`${to}T23:59:59`).toISOString() : "",
          q: appliedQ,
          page: nextPage,
          page_size: PAGE_SIZE,
        });
        if (id !== requestId.current) return; // a newer filter change won
        // New activity can shift pages between loads: skip entries already shown
        setItems((prev) => {
          if (nextPage === 1) return data.items;
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...data.items.filter((i) => !seen.has(i.id))];
        });
        setTotal(data.total);
        setPage(nextPage);
      } catch (err) {
        if (id === requestId.current) setError(apiError(err, "No se pudo cargar la actividad"));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [category, actorId, from, to, appliedQ],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const people = [...users].sort((a, b) => (a.name || a.username || "").localeCompare(b.name || b.username || ""));

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-8">
      <div>
        <h1 className="font-heading text-2xl font-black md:text-3xl">Actividad</h1>
        <p className="text-sm text-foreground/70">Quién hizo qué y cuándo. Se guarda durante 1 año.</p>
      </div>

      <div className="grid gap-3 rounded-base border-2 border-border bg-background p-4 shadow-shadow sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-sm font-bold">
          Persona
          <select className={fieldCls} value={actorId} onChange={(e) => setActorId(e.target.value)}>
            <option value="">Todas</option>
            {people.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.name || u.username}
                {u.is_active ? "" : " (desactivado)"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Tipo
          <select className={fieldCls} value={category} onChange={(e) => setCategory(e.target.value as ActivityCategory | "")}>
            <option value="">Todos</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Desde
          <input type="date" className={fieldCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block text-sm font-bold">
          Hasta
          <input type="date" className={fieldCls} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="block text-sm font-bold">
          Buscar
          <input className={fieldCls} placeholder="FAC-0388, Marleni…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {error && <p className="rounded-base border-2 border-red-500 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      <p className="text-sm text-foreground/60">{loading && items.length === 0 ? "Cargando…" : `${total} ${total === 1 ? "registro" : "registros"}`}</p>

      <ul className="space-y-2">
        {items.map((it) => {
          const cat = categoryInfo(it.category);
          const open = openId === it.id;
          const who = it.actor_display_name || it.actor_name || "Sistema";
          return (
            <li key={it.id} className="rounded-base border-2 border-border bg-background shadow-shadow">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : it.id)}
                className="flex w-full items-start gap-3 p-3 text-left"
                aria-expanded={open}
              >
                <UserAvatar appearance={toAppearance({ name: who, color: it.actor_color, avatar: it.actor_avatar })} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{it.summary}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/60">
                    <span className="font-bold text-foreground/80">{who}</span>
                    <span className={`rounded-full border border-border px-2 py-0.5 font-bold text-foreground ${cat.cls}`}>{cat.label}</span>
                    <span title={new Date(it.created_at).toLocaleString("es-DO")}>
                      {lastSeenLabel(it.created_at)} · {new Date(it.created_at).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </p>
                </div>
              </button>
              {open && (
                <div className="border-t-2 border-border bg-secondary-background p-3 text-xs">
                  <p className="mb-2 text-foreground/70">
                    Acción: <b>{it.action}</b>
                    {it.ip ? <> · IP: {it.ip}</> : null}
                  </p>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-base border border-border bg-white p-2 font-mono">
                    {JSON.stringify(it.details ?? {}, null, 2)}
                  </pre>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {!loading && items.length === 0 && !error && (
        <p className="py-6 text-center text-foreground/60">No hay actividad con estos filtros.</p>
      )}

      {items.length < total && (
        <div className="flex justify-center">
          <NeoButton type="button" variant="neutral" disabled={loading} onClick={() => load(page + 1)}>
            {loading ? "Cargando…" : "Cargar más"}
          </NeoButton>
        </div>
      )}
    </div>
  );
}
