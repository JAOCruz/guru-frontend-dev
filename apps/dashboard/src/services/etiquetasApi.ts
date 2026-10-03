import api, { getAPIUrl } from "./api";
import type { PortfolioDocument } from "./documentosApi";

// Documentos · Etiquetas: tagged models (AI tagging, admin review/approval, exact filling)

export type TagStatus = "untagged" | "pending" | "approved";

export interface TagMeta {
  key: string;
  label: string;
  group: string; // a role (VENDEDOR, COMPRADOR…) or "DOCUMENTO"
  example: string | null; // the previous case's value it replaced
}

export interface TagVersion {
  id: number;
  template_id: number;
  version_number: number;
  tags: TagMeta[];
  skipped: { i: number; text: string }[];
  source: "ai" | "edit" | "restore";
  notes: string | null;
  created_at: string;
  created_by_name: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
}

export interface TagModel {
  id: number;
  name: string;
  category: string | null;
  status: TagStatus;
  current: TagVersion | null; // admin: latest version; employee: the approved one
  approved: TagVersion | null;
  versions?: TagVersion[]; // admin only
}

export interface TagSummaryModel {
  id: number;
  name: string;
  category: string | null;
  status: TagStatus;
  latest_version: number | null;
  taggable: boolean;
}

export interface TagBatch {
  running: boolean;
  total: number;
  done: number;
  failed: { id: number; name: string; error: string }[];
  current: string | null;
  finished_at: string | null;
}

export type TagEditOp =
  | { op: "tag"; text: string; offset: number; length: number; occurrence: number; key: string; label?: string; group?: string }
  | { op: "rename"; from: string; key: string; label?: string; group?: string }
  | { op: "untag"; key: string }
  | { op: "meta"; key: string; label?: string; group?: string }
  // body edits (the model's wording); never mixed with the tag edits above in one save
  | { op: "text"; text: string; offset: number; length: number; occurrence: number; replacement: string }
  | { op: "para"; i: number; from: string; to: string }
  | { op: "insert"; after: number; text: string }
  | { op: "delete"; i: number; from: string };

export const BODY_OPS = new Set<TagEditOp["op"]>(["text", "para", "insert", "delete"]);
export const isBodyOp = (o: TagEditOp) => BODY_OPS.has(o.op);

// A change the AI proposes to the wording, to confirm before it is saved
export type AiChange = Extract<TagEditOp, { op: "para" | "insert" | "delete" }> & { tags_added: string[]; tags_removed: string[] };

export const etiquetasAPI = {
  summary: () => api.get<{ counts: Record<TagStatus, number>; models: TagSummaryModel[]; batch: TagBatch }>("/documentos/tags/summary"),
  startBatch: () => api.post<{ batch: TagBatch }>("/documentos/tags/batch"),
  aiTag: (id: number) => api.post<{ model: TagModel }>(`/documentos/tags/models/${id}/ai`, {}, { timeout: 180_000 }),
  model: (id: number) => api.get<{ model: TagModel }>(`/documentos/tags/models/${id}`),
  edit: (id: number, body: { base_version_id: number; ops: TagEditOp[]; notes?: string }) =>
    api.post<{ model: TagModel }>(`/documentos/tags/models/${id}/edit`, body),
  aiEdit: (id: number, instructions: string) =>
    api.post<{ base_version_id: number; changes: AiChange[] }>(`/documentos/tags/models/${id}/ai-edit`, { instructions }, { timeout: 180_000 }),
  restore: (id: number, versionId: number) => api.post<{ model: TagModel }>(`/documentos/tags/models/${id}/restore`, { version_id: versionId }),
  approve: (versionId: number) => api.post<{ model: TagModel }>(`/documentos/tags/versions/${versionId}/approve`),
  fill: (id: number, body: { values: Record<string, string>; client_id: number; client_role?: string | null; title: string; version_id: number }) =>
    api.post<{ document: PortfolioDocument; empty: number }>(`/documentos/tags/models/${id}/fill`, body),
  extract: (id: number, data: { version_id: number; client_id?: number; text: string; files: File[] }) => {
    const fd = new FormData();
    fd.append("version_id", String(data.version_id));
    if (data.client_id) fd.append("client_id", String(data.client_id));
    fd.append("text", data.text);
    data.files.forEach((f) => fd.append("files", f));
    return api.post<{ values: Record<string, string> }>(`/documentos/tags/models/${id}/extract`, fd, { timeout: 180_000 });
  },
  profile: (clientId: number) => api.get<{ profile: Record<string, string> }>(`/documentos/clients/${clientId}/profile`),
};

export const tagVersionFileUrl = (id: number) => `${getAPIUrl()}/api/documentos/tags/versions/${id}/file`;

export const STATUS_LABEL: Record<TagStatus, string> = {
  untagged: "Sin etiquetar",
  pending: "Pendiente de revisión",
  approved: "Aprobado",
};

export const groupLabel = (g: string) => (g === "DOCUMENTO" ? "Datos generales" : g.charAt(0) + g.slice(1).toLowerCase().replace(/_/g, " "));

// Same matching as the backend's legal profile: "NOMBRE_VENDEDOR" (group VENDEDOR) → "NOMBRE"
const norm = (k: string) =>
  k.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
export function prefillFromProfile(tags: TagMeta[], profile: Record<string, string>, role: string): Record<string, string> {
  const byNorm = new Map(Object.entries(profile).map(([k, v]) => [norm(k), v]));
  const out: Record<string, string> = {};
  for (const t of tags) {
    if (t.group !== role) continue;
    const base = t.key.endsWith(`_${role}`) ? t.key.slice(0, -(role.length + 1)) : t.key;
    const v = byNorm.get(norm(base));
    if (v) out[t.key] = v;
  }
  return out;
}
