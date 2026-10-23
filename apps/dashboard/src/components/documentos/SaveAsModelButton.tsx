import { useState } from "react";
import { FilePlus2 } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { etiquetasAPI } from "../../services/etiquetasApi";
import { confirmDialog, notify } from "../../lib/dialogs";

// A personalized document's new wording becomes the model's next version: the AI puts tags back in
// place of the client's data and an admin approves it before every digitador can use it.
export default function SaveAsModelButton({ documentId }: { documentId: number }) {
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const ok = await confirmDialog(
      "El texto de este documento (su última versión en Word) se guardará como una nueva versión del modelo. La IA quita los datos del cliente y los cambia por etiquetas. Un admin la revisa y la aprueba; desde ahí todos los digitadores la usan. El documento del cliente no cambia y sigue siendo solo tuyo.",
      { title: "Guardar como nueva versión del modelo", confirmLabel: "Guardar" },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await etiquetasAPI.fromDocument(documentId);
      notify(`Se guardó como v${data.version.version_number} de «${data.model_name}». Un admin debe aprobarla para que todos la usen.`, "success");
      if (data.client_data_left.length) {
        notify(`Ojo: quedan datos del cliente en el párrafo ${data.client_data_left.join(", ")}. El admin debe quitarlos antes de aprobar.`, "error");
      }
    } catch (err: any) {
      notify(err?.response?.data?.error || "No se pudo guardar como modelo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <NeoButton type="button" size="sm" variant="neutral" onClick={save} disabled={busy}>
      <FilePlus2 size={14} /> {busy ? "Guardando…" : "Guardar como nueva versión del modelo"}
    </NeoButton>
  );
}
