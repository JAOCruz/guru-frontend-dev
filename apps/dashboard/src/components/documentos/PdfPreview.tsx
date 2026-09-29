import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { NeoButton } from "@guru/ui";
import { fetchFile } from "../../services/documentosApi";

interface Props {
  title: string;
  pdfUrl: string;
  onClose: () => void;
  onDownloadWord?: () => void;
}

// Shows a document as PDF inside the dashboard (the most faithful view of the Word file)
export default function PdfPreview({ title, pdfUrl, onClose, onDownloadWord }: Props) {
  const [blob, setBlob] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    fetchFile(pdfUrl)
      .then((u) => {
        url = u;
        setBlob(u);
      })
      .catch((err) => setError(err.message));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pdfUrl]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/80 p-3 md:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Vista previa: ${title}`}
        className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-base border-2 border-border bg-background shadow-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-border bg-main px-4 py-2 text-main-foreground">
          <span className="min-w-0 truncate font-heading font-black">{title}</span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-base p-1 hover:bg-black/10">
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center bg-secondary-background">
          {blob ? (
            <object data={blob} type="application/pdf" className="h-full w-full" aria-label={title}>
              <p className="p-6 text-center text-sm">Tu navegador no puede mostrar PDFs aquí.</p>
            </object>
          ) : error ? (
            <div className="max-w-sm p-6 text-center">
              <p className="font-semibold">{error}</p>
              {onDownloadWord && (
                <NeoButton className="mt-4" onClick={onDownloadWord}>
                  <Download size={16} /> Descargar Word
                </NeoButton>
              )}
            </div>
          ) : (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-main" aria-label="Cargando" />
          )}
        </div>
      </div>
    </div>
  );
}
