import { useEffect, useState } from "react";
import { FileUp } from "lucide-react";
import { NeoButton } from "@guru/ui";
import Modal, { fieldCls, labelCls } from "../users/Modal";
import { etiquetasAPI, type TagModel } from "../../services/etiquetasApi";

const MAX_MB = 20;

interface Props {
  onClose: () => void;
  onDone: (model: TagModel) => void; // uploaded and tagged: ready to review
  onSaved?: () => void; // the model exists, even if the tagging failed
}

// A person's own model: Word only, private from the start. The AI tags it right after uploading;
// if that fails the model stays saved and the tagging can be retried here or from the Biblioteca.
export default function UploadModelDialog({ onClose, onDone, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<TagModel | null>(null); // saved, but the AI could not tag it

  useEffect(() => {
    etiquetasAPI
      .categories()
      .then(({ data }) => setCategories(data.categories))
      .catch(() => setError("No se pudieron cargar las categorías"));
  }, []);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!/\.docx$/i.test(f.name)) return setError("Solo documentos Word (.docx)");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`El archivo pasa de ${MAX_MB} MB`);
    setError(null);
    setFile(f);
    if (!name) setName(f.name.replace(/\.docx$/i, ""));
  };

  const tag = async (model: TagModel) => {
    setStep("La IA está poniendo las etiquetas…");
    try {
      const { data } = await etiquetasAPI.aiTag(model.id);
      onDone(data.model);
    } catch (err: any) {
      setUploaded(model);
      setError(`${err?.response?.data?.error || "La IA no pudo etiquetarlo"}. Tu modelo quedó guardado.`);
    } finally {
      setStep(null);
    }
  };

  const submit = async () => {
    if (!file) return setError("Elige un archivo Word");
    if (!name.trim()) return setError("Ponle un nombre al modelo");
    if (!categoryId) return setError("Elige una categoría");
    setSaving(true);
    setError(null);
    try {
      setStep("Subiendo…");
      const { data } = await etiquetasAPI.uploadModel({ file, name: name.trim(), category_id: Number(categoryId) });
      onSaved?.();
      await tag(data.model);
    } catch (err: any) {
      setStep(null);
      setError(err?.response?.data?.error || "No se pudo subir el modelo");
    } finally {
      setSaving(false);
    }
  };

  const retry = async () => {
    setSaving(true);
    setError(null);
    await tag(uploaded!);
    setSaving(false);
  };

  return (
    <Modal title="Subir mi modelo" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-foreground/70">Solo tú y los admins lo verán. Lo puedes usar con tus clientes enseguida, y si quieres que lo usen todos, pides que se publique.</p>
        {!uploaded && (
          <>
            <label className="block">
              <span className={labelCls}>Archivo Word (.docx, hasta {MAX_MB} MB)</span>
              <input type="file" accept=".docx" className={fieldCls} onChange={(e) => pick(e.target.files?.[0])} disabled={saving} />
            </label>
            <label className="block">
              <span className={labelCls}>Nombre del modelo</span>
              <input className={fieldCls} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} disabled={saving} />
            </label>
            <label className="block">
              <span className={labelCls}>Categoría</span>
              <select className={fieldCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={saving}>
                <option value="">Elige una categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {step && <p role="status" className="text-sm font-semibold">{step}</p>}
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <NeoButton type="button" variant="neutral" onClick={onClose} disabled={saving}>
            {uploaded ? "Cerrar" : "Cancelar"}
          </NeoButton>
          {uploaded ? (
            <NeoButton type="button" onClick={retry} disabled={saving}>Reintentar con IA</NeoButton>
          ) : (
            <NeoButton type="button" onClick={submit} disabled={saving}>
              <FileUp size={16} /> {saving ? "Subiendo…" : "Subir"}
            </NeoButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
