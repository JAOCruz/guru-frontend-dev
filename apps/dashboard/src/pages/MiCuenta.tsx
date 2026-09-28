import React, { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { useAuth } from "../context/AuthContext";
import { useUserColors } from "../context/UserColorsContext";
import { authAPI, avatarsAPI } from "../services/api";
import { todayISO } from "../lib/dates";
import UserAvatar from "../components/UserAvatar";
import TakeAvatarDialog from "../components/users/TakeAvatarDialog";
import {
  ADMIN_ONLY_AVATAR, AVATARS, AVATAR_KEYS, COLOR_KEYS, COLOR_PALETTE, toAppearance,
  type AvatarKey, type ColorKey,
} from "../lib/userColors";

const card = "rounded-base border-2 border-border bg-background shadow-shadow";

export default function MiCuenta() {
  const { user, refreshUser, isAdmin } = useAuth();
  const { users, refresh } = useUserColors();

  const [color, setColor] = useState<ColorKey | null>((user?.color as ColorKey) ?? null);
  const [avatar, setAvatar] = useState<AvatarKey | null>((user?.avatar as AvatarKey) ?? null);
  const [saving, setSaving] = useState(false);
  // Admin only: an animal someone else has, pending confirmation / confirmed to take
  const [pendingTake, setPendingTake] = useState<{ key: AvatarKey; owner: string } | null>(null);
  const [takeConfirmed, setTakeConfirmed] = useState<AvatarKey | null>(null);
  const [appearanceMsg, setAppearanceMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [birthDate, setBirthDate] = useState(user?.birthDate ?? "");
  const [bdSaving, setBdSaving] = useState(false);
  const [bdMsg, setBdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setBirthDate(user?.birthDate ?? ""), [user?.birthDate]);

  const saveBirthDate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBdSaving(true);
    setBdMsg(null);
    try {
      await authAPI.updateProfile({ birthDate: birthDate || null });
      await refreshUser();
      setBdMsg({ ok: true, text: birthDate ? "Fecha guardada" : "Fecha borrada" });
    } catch (err: any) {
      setBdMsg({ ok: false, text: err.response?.data?.error || "No se pudo guardar" });
    } finally {
      setBdSaving(false);
    }
  };

  useEffect(() => {
    setColor((user?.color as ColorKey) ?? null);
    setAvatar((user?.avatar as AvatarKey) ?? null);
  }, [user?.color, user?.avatar]);

  const takenColor = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => u.id !== user?.id && u.color && m.set(u.color, u.name || u.username || ""));
    return m;
  }, [users, user?.id]);

  // Employees see the animals the admin enabled (plus their own); the admin sees all
  const [enabledAvatars, setEnabledAvatars] = useState<string[] | null>(null);
  useEffect(() => {
    avatarsAPI
      .getEnabled()
      .then(({ data }) => setEnabledAvatars(data.enabled))
      .catch(() => setEnabledAvatars(null));
  }, []);
  const visibleAvatars = useMemo(
    () =>
      isAdmin || !enabledAvatars
        ? AVATAR_KEYS
        : AVATAR_KEYS.filter((k) => k === ADMIN_ONLY_AVATAR || k === user?.avatar || enabledAvatars.includes(k)),
    [isAdmin, enabledAvatars, user?.avatar],
  );

  const takenAvatar = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => u.id !== user?.id && u.avatar && m.set(u.avatar, u.name || u.username || ""));
    return m;
  }, [users, user?.id]);

  const preview = toAppearance({ name: user?.name || user?.username, color, avatar });
  const dirty = color !== (user?.color ?? null) || avatar !== (user?.avatar ?? null);

  const saveAppearance = async () => {
    setSaving(true);
    setAppearanceMsg(null);
    try {
      const payload: { color?: string; avatar?: string | null; force?: boolean; label?: string } = {};
      if (color && color !== user?.color) payload.color = color;
      if (avatar !== (user?.avatar ?? null)) {
        payload.avatar = avatar;
        if (avatar && avatar === takeConfirmed) payload.force = true;
        if (avatar) payload.label = AVATARS[avatar].label;
      }
      await authAPI.updateAppearance(payload);
      await Promise.all([refreshUser(), refresh()]);
      setAppearanceMsg({ ok: true, text: "Guardado. Todos verán tu nuevo color y animal." });
    } catch (err: any) {
      const text = err.response?.data?.error || "No se pudo guardar";
      setAppearanceMsg({ ok: false, text });
      if (err.response?.status === 409) await refresh();
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      return setPwMsg({ ok: false, text: "Completa todos los campos" });
    }
    if (newPassword.length < 8) {
      return setPwMsg({ ok: false, text: "La nueva contraseña debe tener al menos 8 caracteres" });
    }
    if (newPassword !== confirmPassword) {
      return setPwMsg({ ok: false, text: "La confirmación no coincide" });
    }
    setPwSaving(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setPwMsg({ ok: true, text: "Contraseña actualizada" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwMsg({ ok: false, text: err.response?.data?.error || "No se pudo cambiar la contraseña" });
    } finally {
      setPwSaving(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-base border-2 border-border bg-white px-3 py-2 font-base text-sm focus:outline-none";

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-4 md:p-8 lg:grid-cols-2">
      <section className={card}>
        <div className="border-b-2 border-border bg-main px-5 py-3 font-heading text-lg font-black text-main-foreground">
          Mi avatar y color
        </div>
        <div className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-sm font-bold">Elige tu animal</p>
            <div className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-2 overflow-y-auto p-1 pr-2">
              {visibleAvatars.map((key) => {
                const reserved = key === ADMIN_ONLY_AVATAR && !isAdmin;
                const owner = takenAvatar.get(key);
                // The admin may take a taken animal (after confirming); employees can't
                const disabled = reserved || (!!owner && !isAdmin);
                const selected = avatar === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      owner && !selected ? setPendingTake({ key, owner }) : setAvatar(selected ? null : key)
                    }
                    title={reserved ? "Reservado para el admin" : owner ? `${AVATARS[key].label} · lo tiene ${owner}` : AVATARS[key].label}
                    className={`relative flex h-11 items-center justify-center rounded-base border-2 border-border bg-white text-2xl transition-all ${
                      selected ? "ring-4 ring-main ring-offset-2" : ""
                    } ${disabled ? "cursor-not-allowed opacity-30" : "hover:-translate-y-0.5"}`}
                  >
                    {AVATARS[key].emoji}
                    {reserved && <Lock size={12} className="absolute -right-1 -top-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {pendingTake && (
            <TakeAvatarDialog
              avatarKey={pendingTake.key}
              owner={pendingTake.owner}
              onCancel={() => setPendingTake(null)}
              onConfirm={() => {
                setAvatar(pendingTake.key);
                setTakeConfirmed(pendingTake.key);
                setPendingTake(null);
              }}
            />
          )}

          <div>
            <p className="mb-2 text-sm font-bold">Elige tu color</p>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_KEYS.map((key) => {
                const owner = takenColor.get(key);
                const selected = color === key;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!!owner}
                    onClick={() => setColor(key)}
                    title={owner ? `Lo tiene ${owner}` : COLOR_PALETTE[key].label}
                    style={{ backgroundColor: COLOR_PALETTE[key].bg }}
                    className={`h-9 rounded-base border-2 border-border transition-all ${
                      selected ? "ring-4 ring-main ring-offset-2" : ""
                    } ${owner ? "cursor-not-allowed opacity-30" : "hover:-translate-y-0.5"}`}
                  >
                    {owner && <span className="text-sm font-black">✕</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">Vista previa</p>
            <div
              className="flex min-w-0 items-center gap-3 overflow-hidden rounded-base border-2 border-border p-4 shadow-shadow"
              style={{ backgroundColor: preview.color.bg, color: preview.color.text }}
            >
              <UserAvatar appearance={preview} size="lg" />
              <span className="min-w-0 truncate font-heading text-2xl font-black uppercase">{preview.name}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NeoButton type="button" onClick={saveAppearance} disabled={!dirty || !color || saving}>
              {saving ? "Guardando…" : "Guardar"}
            </NeoButton>
            {appearanceMsg && (
              <span role="status" className={`basis-full text-sm font-semibold ${appearanceMsg.ok ? "text-green-700" : "text-red-600"}`}>
                {appearanceMsg.text}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className={card}>
        <div className="border-b-2 border-border bg-main px-5 py-3 font-heading text-lg font-black text-main-foreground">
          Cambiar contraseña
        </div>
        <form onSubmit={changePassword} className="space-y-4 p-5">
          <label className="block text-sm font-bold">
            Contraseña actual
            <input type="password" autoComplete="current-password" className={inputCls} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </label>
          <label className="block text-sm font-bold">
            Nueva contraseña
            <input type="password" autoComplete="new-password" placeholder="Mínimo 8, con letras y números" className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label className="block text-sm font-bold">
            Confirmar nueva contraseña
            <input type="password" autoComplete="new-password" className={inputCls} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <NeoButton type="submit" disabled={pwSaving}>
              {pwSaving ? "Guardando…" : "Cambiar contraseña"}
            </NeoButton>
            {pwMsg && (
              <span role="status" className={`basis-full text-sm font-semibold ${pwMsg.ok ? "text-green-700" : "text-red-600"}`}>{pwMsg.text}</span>
            )}
          </div>
        </form>
      </section>

      <section className={card}>
        <div className="border-b-2 border-border bg-main px-5 py-3 font-heading text-lg font-black text-main-foreground">
          Mis datos
        </div>
        <form onSubmit={saveBirthDate} className="space-y-4 p-5">
          <label className="block text-sm font-bold">
            Fecha de nacimiento
            <input type="date" min="1900-01-01" max={todayISO()} className={inputCls} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <NeoButton type="submit" disabled={bdSaving || birthDate === (user?.birthDate ?? "")}>
              {bdSaving ? "Guardando…" : "Guardar fecha"}
            </NeoButton>
            {bdMsg && (
              <span role="status" className={`basis-full text-sm font-semibold ${bdMsg.ok ? "text-green-700" : "text-red-600"}`}>{bdMsg.text}</span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
