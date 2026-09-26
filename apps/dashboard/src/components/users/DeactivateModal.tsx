import React, { useEffect, useState } from "react";
import { NeoButton } from "@guru/ui";
import Modal, { fieldCls, labelCls } from "./Modal";
import { adminUsersAPI, type AdminUser } from "../../services/api";
import { apiError } from "../../lib/users";

interface Props {
  user: AdminUser;
  candidates: AdminUser[]; // active users who can receive the assignments
  onClose: () => void;
  onSaved: () => void;
}

const DeactivateModal: React.FC<Props> = ({ user, candidates, onClose, onSaved }) => {
  const [counts, setCounts] = useState<{ clients: number; cases: number } | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = user.name || user.username;

  useEffect(() => {
    adminUsersAPI
      .assignments(user.id)
      .then(({ data }) => setCounts(data))
      .catch((err) => setError(apiError(err, "No se pudieron cargar sus asignaciones")));
  }, [user.id]);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminUsersAPI.deactivate(user.id, reassignTo ? Number(reassignTo) : null);
      onSaved();
      onClose();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Desactivar a ${name}`} tone="danger" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-base border-2 border-amber-500 bg-amber-50 p-3 text-sm">
          {counts
            ? `${name} tiene ${counts.clients} clientes/chats y ${counts.cases} casos asignados.`
            : "Cargando asignaciones…"}
        </div>
        <label className={labelCls}>
          Pasarlos a
          <select className={fieldCls} value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
            <option value="">Sin asignar</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.username}</option>
            ))}
          </select>
        </label>
        <p className="text-sm text-foreground/70">
          {name} no podrá entrar más y su sesión abierta se cerrará en menos de un minuto. Su historial se conserva y
          puedes reactivarla después.
        </p>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <div className="flex gap-2">
          <NeoButton type="button" variant="neutral" onClick={onClose}>Cancelar</NeoButton>
          <NeoButton type="button" className="bg-red-500 text-white" disabled={saving || !counts} onClick={confirm}>
            {saving ? "Desactivando…" : "Desactivar"}
          </NeoButton>
        </div>
      </div>
    </Modal>
  );
};

export default DeactivateModal;
