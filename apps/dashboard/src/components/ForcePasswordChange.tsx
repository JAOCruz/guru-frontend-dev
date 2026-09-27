import React, { useState } from "react";
import { NeoButton } from "@guru/ui";
import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";

const inputCls = "mt-1 w-full rounded-base border-2 border-border bg-white px-3 py-2 font-base text-sm text-foreground focus:outline-none";

// Shown instead of the dashboard while the user still has an admin-issued temporary password
export default function ForcePasswordChange() {
  const { user, refreshUser, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!current || !next || !confirm) return setError("Completa todos los campos");
    if (next.length < 8) return setError("La nueva contraseña debe tener al menos 8 caracteres");
    if (next !== confirm) return setError("La confirmación no coincide");
    setSaving(true);
    try {
      await authAPI.changePassword(current, next);
      await refreshUser();
    } catch (err: any) {
      setError(err.response?.data?.error || "No se pudo cambiar la contraseña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md overflow-hidden rounded-base border-2 border-border bg-background shadow-shadow">
        <div className="border-b-2 border-border bg-main px-6 py-4 font-heading text-xl font-black text-main-foreground">
          Crea tu contraseña
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          <p className="text-sm text-foreground/80">
            Hola{user?.name ? `, ${user.name}` : ""}. Tu administrador te dio una contraseña temporal. Crea una propia para continuar.
          </p>
          <label className="block text-sm font-bold">
            Contraseña temporal
            <input type="password" autoComplete="current-password" className={inputCls} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="block text-sm font-bold">
            Nueva contraseña
            <input type="password" autoComplete="new-password" placeholder="Mínimo 8, con letras y números" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="block text-sm font-bold">
            Confirmar nueva contraseña
            <input type="password" autoComplete="new-password" className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex items-center justify-between">
            <NeoButton type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar y entrar"}</NeoButton>
            <button type="button" onClick={logout} className="text-sm font-bold underline">Cerrar sesión</button>
          </div>
        </form>
      </div>
    </div>
  );
}
