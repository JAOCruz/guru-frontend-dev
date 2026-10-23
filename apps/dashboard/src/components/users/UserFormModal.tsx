import React, { useMemo, useState } from "react";
import { NeoButton } from "@guru/ui";
import Modal, { fieldCls, labelCls } from "./Modal";
import TakeColorDialog from "./TakeColorDialog";
import { adminUsersAPI, type AdminUser, type AdminUserInput } from "../../services/api";
import { apiError, generateTempPassword } from "../../lib/users";
import { ADMIN_ONLY_AVATAR, AVATARS, AVATAR_KEYS, COLOR_KEYS, COLOR_PALETTE, type AvatarKey, type ColorKey } from "../../lib/userColors";
import { useUserColors } from "../../context/UserColorsContext";
import TakeAvatarDialog from "./TakeAvatarDialog";
import { todayISO } from "../../lib/dates";

interface Props {
  user?: AdminUser; // edit mode when present
  onClose: () => void;
  onSaved: () => void;
}

type Role = AdminUserInput["role"];

const UserFormModal: React.FC<Props> = ({ user, onClose, onSaved }) => {
  const editing = !!user;
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<Role>((user?.role === "employee" ? "digitador" : user?.role) ?? "digitador");
  const [inPayroll, setInPayroll] = useState(user?.in_payroll ?? true);
  const [birthDate, setBirthDate] = useState(user?.birth_date ?? "");
  // Edit mode: the admin can change this person's animal, even taking one someone else has
  const { users, refresh } = useUserColors();
  const [avatarSel, setAvatarSel] = useState<AvatarKey | null>((user?.avatar as AvatarKey) ?? null);
  const [pendingTake, setPendingTake] = useState<{ key: AvatarKey; owner: string } | null>(null);
  const [takeConfirmed, setTakeConfirmed] = useState<AvatarKey | null>(null);
  const owners = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => u.id !== user?.id && u.avatar && m.set(u.avatar, u.name || u.username || ""));
    return m;
  }, [users, user?.id]);
  // …and their color: one per person; taking someone's gives them the color this person had
  const initialColor = (user?.color as ColorKey | null) ?? null;
  const [colorSel, setColorSel] = useState<ColorKey | null>(initialColor);
  const [pendingColor, setPendingColor] = useState<{ key: ColorKey; owner: string } | null>(null);
  const [colorConfirmed, setColorConfirmed] = useState<ColorKey | null>(null);
  const colorOwners = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => u.id !== user?.id && u.color && m.set(u.color, u.name || u.username || ""));
    return m;
  }, [users, user?.id]);
  const avatarChoices = AVATAR_KEYS.filter((k) => k !== ADMIN_ONLY_AVATAR || user?.role === "admin");
  const [tempPassword, setTempPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);

  const changeRole = (next: Role) => {
    setRole(next);
    if (!editing) setInPayroll(next !== "admin");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !username.trim()) return setError("Nombre y usuario son obligatorios");
    if (!editing && tempPassword.length < 8) return setError("La contraseña debe tener al menos 8 caracteres");
    setSaving(true);
    const data: AdminUserInput = { name: name.trim(), username: username.trim(), email: email.trim(), role, in_payroll: inPayroll, birth_date: birthDate };
    try {
      if (editing) {
        await adminUsersAPI.update(user!.id, data);
        if (avatarSel !== ((user!.avatar as AvatarKey) ?? null)) {
          await adminUsersAPI.setAvatar(user!.id, avatarSel, {
            force: !!avatarSel && avatarSel === takeConfirmed,
            label: avatarSel ? AVATARS[avatarSel].label : undefined,
          });
        }
        if (colorSel && colorSel !== initialColor) {
          await adminUsersAPI.setColor(user!.id, colorSel, { force: colorSel === colorConfirmed, label: COLOR_PALETTE[colorSel].label });
        }
        refresh().catch(() => {});
        onSaved();
        onClose();
      } else {
        await adminUsersAPI.create({ ...data, temp_password: tempPassword });
        onSaved();
        setCreated({ username: data.username, password: tempPassword });
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <Modal title="Usuario creado" onClose={onClose}>
        <p className="text-sm">
          Comunícale estos datos a la persona. Al entrar deberá crear su propia contraseña.
        </p>
        <div className="my-4 space-y-2 rounded-base border-2 border-border bg-secondary-background p-4 font-mono text-base">
          <div>Usuario: <b>{created.username}</b></div>
          <div>Contraseña temporal: <b>{created.password}</b></div>
        </div>
        <div className="flex gap-2">
          <NeoButton type="button" variant="neutral" onClick={() => navigator.clipboard?.writeText(`Usuario: ${created.username}\nContraseña temporal: ${created.password}`)}>
            Copiar
          </NeoButton>
          <NeoButton type="button" onClick={onClose}>Listo</NeoButton>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={editing ? `Editar a ${user!.name || user!.username}` : "Nuevo usuario"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className={labelCls}>
          Nombre
          <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Usuario
            <input className={fieldCls} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className={labelCls}>
            Email (opcional)
            <input className={fieldCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        <label className={labelCls}>
          Fecha de nacimiento (opcional)
          <input className={fieldCls} type="date" min="1900-01-01" max={todayISO()} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
        {editing && (
          <div>
            <p className={labelCls}>Animal</p>
            <div className="mt-1 grid max-h-40 grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5 overflow-y-auto rounded-base border-2 border-border bg-white p-1.5">
              {avatarChoices.map((key) => {
                const owner = owners.get(key);
                const selected = avatarSel === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => (owner && !selected ? setPendingTake({ key, owner }) : setAvatarSel(selected ? null : key))}
                    title={`${AVATARS[key].label}${owner ? ` · lo tiene ${owner}` : ""}`}
                    aria-pressed={selected}
                    className={`relative flex h-10 items-center justify-center rounded-base border-2 text-xl ${
                      selected ? "border-border bg-main/20 ring-2 ring-main" : "border-transparent hover:border-border"
                    } ${owner && !selected ? "opacity-40" : ""}`}
                  >
                    {AVATARS[key].emoji}
                  </button>
                );
              })}
            </div>
            {pendingTake && (
              <TakeAvatarDialog
                avatarKey={pendingTake.key}
                owner={pendingTake.owner}
                onCancel={() => setPendingTake(null)}
                onConfirm={() => {
                  setAvatarSel(pendingTake.key);
                  setTakeConfirmed(pendingTake.key);
                  setPendingTake(null);
                }}
              />
            )}
          </div>
        )}
        {editing && (
          <div>
            <p className={labelCls}>Color</p>
            <div className="mt-1 grid grid-cols-6 gap-1.5 rounded-base border-2 border-border bg-white p-1.5" role="group" aria-label="Color">
              {COLOR_KEYS.map((key) => {
                const owner = colorOwners.get(key);
                const selected = colorSel === key;
                const c = COLOR_PALETTE[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => (owner && !selected ? setPendingColor({ key, owner }) : setColorSel(key))}
                    title={`${c.label}${owner ? ` · lo tiene ${owner}` : ""}`}
                    aria-label={`${c.label}${owner ? ` (lo tiene ${owner})` : ""}`}
                    aria-pressed={selected}
                    style={{ background: c.bg, color: c.text }}
                    className={`relative flex h-9 items-center justify-center rounded-base border-2 text-[10px] font-black ${
                      selected ? "border-border ring-2 ring-main ring-offset-1" : "border-transparent hover:border-border"
                    } ${owner && !selected ? "opacity-45" : ""}`}
                  >
                    {selected ? "✓" : owner ? (owner.trim()[0] || "").toUpperCase() : ""}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-foreground/60">
              {colorSel ? COLOR_PALETTE[colorSel].label : "Sin color"} · los colores con letra ya los usa otra persona.
            </p>
            {pendingColor && (
              <TakeColorDialog
                colorKey={pendingColor.key}
                owner={pendingColor.owner}
                person={user!.name || user!.username}
                replaced={initialColor}
                onCancel={() => setPendingColor(null)}
                onConfirm={() => {
                  setColorSel(pendingColor.key);
                  setColorConfirmed(pendingColor.key);
                  setPendingColor(null);
                }}
              />
            )}
          </div>
        )}
        <label className={labelCls}>
          Rol
          <select className={fieldCls} value={role} onChange={(e) => changeRole(e.target.value as Role)}>
            <option value="digitador">Digitador</option>
            <option value="auxiliar">Auxiliar</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="h-5 w-5 accent-main" checked={inPayroll} onChange={(e) => setInPayroll(e.target.checked)} />
          Participa en ganancias
        </label>
        {!editing && (
          <label className={labelCls}>
            Contraseña temporal
            <div className="flex gap-2">
              <input className={fieldCls} autoComplete="new-password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
              <button type="button" className="mt-1 rounded-base border-2 border-border px-3 text-sm font-bold" onClick={() => setTempPassword(generateTempPassword())}>
                Generar
              </button>
            </div>
          </label>
        )}
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <NeoButton type="submit" disabled={saving}>
          {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear usuario"}
        </NeoButton>
      </form>
    </Modal>
  );
};

export default UserFormModal;
