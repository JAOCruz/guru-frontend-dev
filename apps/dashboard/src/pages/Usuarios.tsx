import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { adminUsersAPI, type AdminUser } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useUserColors } from "../context/UserColorsContext";
import UserAvatar from "../components/UserAvatar";
import AvatarCatalogPanel from "../components/users/AvatarCatalogPanel";
import UserFormModal from "../components/users/UserFormModal";
import TempPasswordModal from "../components/users/TempPasswordModal";
import DeactivateModal from "../components/users/DeactivateModal";
import { toAppearance } from "../lib/userColors";
import { apiError, lastSeenLabel, roleLabel } from "../lib/users";
import { confirmDialog } from "../lib/dialogs";

type Filter = "active" | "inactive" | "all";
type Dialog =
  | { kind: "create" }
  | { kind: "edit"; user: AdminUser }
  | { kind: "password"; user: AdminUser }
  | { kind: "deactivate"; user: AdminUser }
  | null;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "active", label: "Activos" },
  { key: "inactive", label: "Desactivados" },
  { key: "all", label: "Todos" },
];

const actionCls =
  "rounded-base border-2 border-border bg-white px-2 py-1 text-xs font-bold transition-all hover:-translate-y-0.5";

function StatusPill({ user }: { user: AdminUser }) {
  if (!user.is_active) {
    return <span className="rounded-full border-2 border-border bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-600">Desactivado</span>;
  }
  if (user.must_change_password) {
    return <span className="rounded-full border-2 border-border bg-amber-100 px-2 py-0.5 text-xs font-bold">Debe cambiar contraseña</span>;
  }
  return <span className="rounded-full border-2 border-border bg-green-100 px-2 py-0.5 text-xs font-bold">Activo</span>;
}

export default function Usuarios() {
  const { user: me } = useAuth();
  const { refresh: refreshDirectory } = useUserColors();
  const [filter, setFilter] = useState<Filter>("active");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activeUsers, setActiveUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data }, active] = await Promise.all([
        adminUsersAPI.list(filter),
        filter === "active" ? null : adminUsersAPI.list("active"),
      ]);
      setUsers(data.users);
      setActiveUsers(active ? active.data.users : data.users);
    } catch (err) {
      setError(apiError(err, "No se pudo cargar la lista de usuarios"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const afterChange = () => {
    load();
    refreshDirectory();
  };

  const reactivate = async (u: AdminUser) => {
    if (!await confirmDialog(`${u.name || u.username} podrá volver a entrar al dashboard.`, { title: `¿Reactivar a ${u.name || u.username}?`, confirmLabel: "Reactivar" })) return;
    try {
      await adminUsersAPI.reactivate(u.id);
      afterChange();
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-black md:text-3xl">Usuarios</h1>
          <p className="text-sm text-foreground/70">Crea, edita y desactiva al personal del dashboard.</p>
        </div>
        <NeoButton type="button" onClick={() => setDialog({ kind: "create" })}>
          <UserPlus size={18} /> Nuevo usuario
        </NeoButton>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border-2 border-border px-3 py-1 text-sm font-bold ${
              filter === f.key ? "bg-main text-main-foreground" : "bg-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-base border-2 border-red-500 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {loading && users.length === 0 ? (
        <p className="py-6 text-center text-foreground/60">Cargando…</p>
      ) : users.length === 0 ? (
        <p className="py-6 text-center text-foreground/60">No hay usuarios en esta lista.</p>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => {
            const isMe = u.id === me?.id;
            return (
              <li
                key={u.id}
                className={`flex flex-wrap items-center gap-x-6 gap-y-3 rounded-base border-2 border-border bg-background p-4 shadow-shadow ${
                  u.is_active ? "" : "opacity-70"
                }`}
              >
                <div className="flex min-w-[220px] flex-1 items-center gap-3">
                  <UserAvatar appearance={toAppearance({ name: u.name || u.username, color: u.color, avatar: u.avatar })} size="md" />
                  <div className="min-w-0">
                    <div className="truncate font-bold">
                      {u.name || u.username}
                      {isMe && <span className="ml-1 text-xs text-foreground/60">(tú)</span>}
                    </div>
                    <div className="truncate text-sm text-foreground/60">{u.username}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full border-2 border-border bg-secondary-background px-2 py-0.5 font-bold">{roleLabel(u.role)}</span>
                  <span className="rounded-full border-2 border-border bg-secondary-background px-2 py-0.5 font-bold">
                    {u.in_payroll ? "En ganancias" : "Sin ganancias"}
                  </span>
                  <StatusPill user={u} />
                  <span className="text-foreground/60" title="Última conexión">{lastSeenLabel(u.last_seen)}</span>
                </div>

                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  <Link to={`/actividad?actor_id=${u.id}`} className={`${actionCls} bg-secondary-background`}>
                    Ver actividad
                  </Link>
                  {u.is_active ? (
                    <>
                      <button type="button" className={actionCls} onClick={() => setDialog({ kind: "edit", user: u })}>Editar</button>
                      <button type="button" className={actionCls} onClick={() => setDialog({ kind: "password", user: u })}>Contraseña</button>
                      {!isMe && (
                        <button type="button" className={`${actionCls} bg-red-100`} onClick={() => setDialog({ kind: "deactivate", user: u })}>
                          Desactivar
                        </button>
                      )}
                    </>
                  ) : (
                    <button type="button" className={`${actionCls} bg-green-100`} onClick={() => reactivate(u)}>Reactivar</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AvatarCatalogPanel />

      {dialog?.kind === "create" && <UserFormModal onClose={() => setDialog(null)} onSaved={afterChange} />}
      {dialog?.kind === "edit" && <UserFormModal user={dialog.user} onClose={() => setDialog(null)} onSaved={afterChange} />}
      {dialog?.kind === "password" && <TempPasswordModal user={dialog.user} onClose={() => setDialog(null)} onSaved={afterChange} />}
      {dialog?.kind === "deactivate" && (
        <DeactivateModal
          user={dialog.user}
          candidates={activeUsers.filter((c) => c.id !== dialog.user.id)}
          onClose={() => setDialog(null)}
          onSaved={afterChange}
        />
      )}
    </div>
  );
}
