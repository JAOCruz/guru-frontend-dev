import React, { useState } from "react";
import { NeoButton } from "@guru/ui";
import Modal, { fieldCls, labelCls } from "./Modal";
import { adminUsersAPI, type AdminUser, type AdminUserInput } from "../../services/api";
import { apiError, generateTempPassword } from "../../lib/users";
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
