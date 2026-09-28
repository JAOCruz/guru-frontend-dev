import { NeoButton } from "@guru/ui";
import Modal from "./Modal";
import { AVATARS, type AvatarKey } from "../../lib/userColors";

interface Props {
  avatarKey: AvatarKey;
  owner: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Asks before taking an animal someone else is using (they lose it)
export default function TakeAvatarDialog({ avatarKey, owner, onConfirm, onCancel }: Props) {
  const { emoji, label } = AVATARS[avatarKey];
  return (
    <Modal title="Este animal ya tiene dueño" onClose={onCancel}>
      <p className="text-sm">
        <span className="mr-1 text-2xl align-middle">{emoji}</span>
        <b>{label}</b> lo está usando <b>{owner}</b>. ¿Seguro que quieres seleccionarlo? Se le quitará a {owner} y tendrá que
        elegir otro.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <NeoButton type="button" variant="neutral" onClick={onCancel}>
          Cancelar
        </NeoButton>
        <NeoButton type="button" onClick={onConfirm}>
          Sí, quitárselo
        </NeoButton>
      </div>
    </Modal>
  );
}
