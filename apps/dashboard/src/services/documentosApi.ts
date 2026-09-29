import api, { getAPIUrl } from "./api";
import { getAuthToken } from "../utils";

// Documentos (Fase 1): "Buscar por nombre" in our selection + "Historial del digitador"

export interface Model {
  id: number;
  name: string;
  file_name: string;
  category: string | null;
  reason?: string;
}

export interface HistoryClient {
  id: number;
  name: string | null;
  phone: string | null;
  documents?: number;
  last_activity?: string;
}

export interface DocVersion {
  id: number;
  version_number: number;
  file_name: string;
  mime_type: string;
  size_bytes: number | null;
  source: "upload" | "generated" | "ai_edit";
  notes: string | null;
  created_at: string;
  created_by: number | null;
  created_by_name: string | null;
  status: "draft" | "approved";
}

export interface PortfolioDocument {
  id: number;
  title: string;
  client_id: number;
  client_name: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  latest_version: number | null;
  approved_version: number | null;
  versions_count: number;
  versions?: DocVersion[];
}

export type DocSort = "recent" | "date" | "name";

export const documentosAPI = {
  models: (q = "") => api.get<{ models: Model[] }>("/documentos/models", { params: { q } }),
  aiSearch: (query: string) => api.post<{ models: Model[] }>("/documentos/models/ai-search", { query }),
  clients: (q = "") => api.get<{ clients: HistoryClient[] }>("/documentos/clients", { params: { q } }),
  searchAllClients: (q = "") => api.get<{ clients: HistoryClient[] }>("/documentos/clients/search", { params: { q } }),
  createClient: (name: string, phone: string) => api.post<{ client: HistoryClient }>("/documentos/clients", { name, phone }),
  documents: (params: { client_id?: number; sort?: DocSort; created_by?: number }) =>
    api.get<{ documents: PortfolioDocument[] }>("/documentos/documents", { params }),
  document: (id: number) => api.get<{ document: PortfolioDocument }>(`/documentos/documents/${id}`),
  upload: (data: { file: File; client_id: number; title: string; notes?: string }) => {
    const fd = new FormData();
    fd.append("file", data.file);
    fd.append("client_id", String(data.client_id));
    fd.append("title", data.title);
    if (data.notes) fd.append("notes", data.notes);
    return api.post<{ document: PortfolioDocument }>("/documentos/documents", fd);
  },
  uploadVersion: (id: number, file: File, notes?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (notes) fd.append("notes", notes);
    return api.post<{ document: PortfolioDocument }>(`/documentos/documents/${id}/versions`, fd);
  },
  approve: (id: number, versionId: number) =>
    api.post<{ document: PortfolioDocument }>(`/documentos/documents/${id}/approve`, { version_id: versionId }),
};

// ── Fase 2 · Generación ──
export interface Field {
  key: string;
  label: string;
  group: string; // a role (VENDEDOR, COMPRADOR…) or "DOCUMENTO"
}
export type Source = { model_id: number } | { version_id: number };
export interface Change {
  op: "replace" | "insert_after" | "delete";
  i: number;
  before: string | null;
  after: string | null;
}

export const generacionAPI = {
  fields: (source: Source, client_id?: number, client_role?: string | null) =>
    api.get<{ fields: Field[]; roles: string[]; exact: boolean; prefill: Record<string, string> }>("/documentos/fields", {
      params: { ...source, ...(client_id ? { client_id } : {}), ...(client_role ? { client_role } : {}) },
    }),
  extract: (source: Source, data: { client_id?: number; text: string; files: File[] }) => {
    const fd = new FormData();
    Object.entries(source).forEach(([k, v]) => fd.append(k, String(v)));
    if (data.client_id) fd.append("client_id", String(data.client_id));
    fd.append("text", data.text);
    data.files.forEach((f) => fd.append("files", f));
    return api.post<{ values: Record<string, string> }>("/documentos/fill/extract", fd);
  },
  generate: (body: Source & { client_id?: number; client_role?: string | null; title: string; values: Record<string, string> }) =>
    api.post<{ document: PortfolioDocument; changes: Change[]; exact: boolean }>("/documentos/fill/generate", body),
  aiEdit: (body: Source & { client_id?: number; title?: string; instructions: string }) =>
    api.post<{ document: PortfolioDocument; changes: Change[] }>("/documentos/ai-edit", body),
};

export const modelFileUrl = (id: number, format: "docx" | "pdf", inline = false) =>
  `${getAPIUrl()}/api/documentos/models/${id}/file?format=${format}${inline ? "&inline=1" : ""}`;
export const versionFileUrl = (id: number, format: "docx" | "pdf", inline = false) =>
  `${getAPIUrl()}/api/documentos/versions/${id}/file?format=${format}${inline ? "&inline=1" : ""}`;

// Fetches a file with the session and returns a blob URL (throws the server's Spanish message)
export async function fetchFile(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${getAuthToken()}` }, credentials: "include" });
  if (!res.ok) {
    let message = "No se pudo abrir el archivo";
    try {
      message = (await res.json()).error || message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  return URL.createObjectURL(await res.blob());
}

export async function downloadFile(url: string, filename: string) {
  const blobUrl = await fetchFile(url);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}
