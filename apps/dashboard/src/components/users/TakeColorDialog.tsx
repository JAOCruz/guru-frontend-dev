import { NeoButton } from "@guru/ui";
import Modal from "./Modal";
import { COLOR_PALETTE, type ColorKey } from "../../lib/userColors";

interface Props {
  colorKey: ColorKey;
  owner: string;
  person: string; // who is getting the color
  replaced: ColorKey | null; // the color that person has now (goes to the owner)
  onConfirm: () => void;
  onCancel: () => void;
}

// Asks before taking a color someone else has (each color belongs to one person)
export default function TakeColorDialog({ colorKey, owner, person, replaced, onConfirm, onCancel }: Props) {
  const c = COLOR_PALETTE[colorKey];
  return (
    <Modal title="Este color ya tiene dueño" onClose={onCancel}>
      <p className="text-sm">
        <span className="mr-1.5 inline-block h-5 w-5 rounded-base border-2 border-border align-middle" style={{ background: c.bg }} />
        <b>{c.label}</b> lo tiene <b>{owner}</b>. ¿Quieres quitárselo y dárselo a {person}?
      </p>
      <p className="mt-2 text-sm text-foreground/70">
        {replaced
          ? <>{owner} se quedará con el color que tenía {person}: <b>{COLOR_PALETTE[replaced].label}</b>.</>
          : <>{owner} recibirá otro color libre.</>}
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
