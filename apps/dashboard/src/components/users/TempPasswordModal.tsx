import React, { useState } from "react";
import { NeoButton } from "@guru/ui";
import Modal, { fieldCls, labelCls } from "./Modal";
import { adminUsersAPI, type AdminUser } from "../../services/api";
import { apiError, generateTempPassword } from "../../lib/users";

const TempPasswordModal: React.FC<{ user: AdminUser; onClose: () => void; onSaved: () => void }> = ({ user, onClose, onSaved }) => {
  const [password, setPassword] = useState(() => generateTempPassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres");
    setSaving(true);
    setError(null);
    try {
      await adminUsersAPI.setTempPassword(user.id, password);
      setDone(true);
      onSaved();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  const name = user.name || user.username;
  return (
    <Modal title={`Contraseña temporal de ${name}`} onClose={onClose}>
      {done ? (
        <>
          <p className="text-sm">Listo. Comunícale la contraseña a {name}; deberá cambiarla al entrar.</p>
          <p className="my-4 rounded-base border-2 border-border bg-secondary-background p-4 font-mono text-lg font-bold">{password}</p>
          <NeoButton type="button" onClick={onClose}>Listo</NeoButton>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className={labelCls}>
            Nueva contraseña temporal
            <div className="flex gap-2">
              <input className={fieldCls} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="mt-1 rounded-base border-2 border-border px-3 text-sm font-bold" onClick={() => setPassword(generateTempPassword())}>
                Generar
              </button>
            </div>
          </label>
          <p className="text-sm text-foreground/70">Deberá cambiarla al entrar. Si tiene el dashboard abierto, se le pedirá cambiarla de inmediato.</p>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <NeoButton type="submit" disabled={saving}>{saving ? "Guardando…" : "Poner contraseña temporal"}</NeoButton>
        </form>
      )}
    </Modal>
  );
};

export default TempPasswordModal;
