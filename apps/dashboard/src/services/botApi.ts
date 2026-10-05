import axios from "axios";
import { getAuthToken } from "../utils";

export function getBotApiBaseURL(): string {
  if (typeof window === "undefined") return "/api";
  const host = window.location.hostname;

  // Production domains → Railway backend (HTTPS)
  if (
    host === "gurusolucionesrd.com" ||
    host === "www.gurusolucionesrd.com" ||
    host.includes("netlify.app")
  ) {
    return "https://guruweb-backend-production.up.railway.app/api";
  }

  // Local / LAN development keeps the original behavior
  return `http://${host}:3000/api`;
}

const BOT_API_URL = getBotApiBaseURL();

const BOT_API_KEY = import.meta.env.VITE_BOT_API_KEY || "";

const botApi = axios.create({
  baseURL: BOT_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // send HttpOnly cookie as auth fallback
});

// Request interceptor to add bot token and API key
botApi.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (BOT_API_KEY) {
      config.headers["x-api-key"] = BOT_API_KEY;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — do NOT wipe tokens here. AuthContext owns session
// cleanup so a transient 401 from one endpoint doesn't log the user out globally.
botApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

// ─── Types ─────────────────────────────────────────────────────────────────

export type BotMode = "all" | "selected";
export type AssignmentMode = "manual" | "automatic";

export interface BotStatus {
  status: "disconnected" | "connecting" | "connected";
  paused?: boolean;
  mode?: BotMode;
  assignmentMode?: AssignmentMode;
  phone?: string;
  /** "meta" = official WhatsApp Cloud API (no QR session), "baileys" = linked device by QR */
  provider?: "meta" | "baileys";
  /** Mensajes lists only chats with messages from this moment (ISO); null = all */
  chatsSince?: string | null;
}

export interface BotMessage {
  id: string;
  phone: string;
  name?: string;
  lastMessage: string;
  timestamp: string;
  botActive: boolean;
  enabled?: boolean;
}

export interface BotClient {
  id: string;
  name?: string;
  phone: string;
  joinedAt: string;
  messageCount: number;
  assigned_to?: number | null;
}

export interface ClientDetailFull {
  client: {
    id: number;
    name?: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
    assigned_to?: number | null;
    created_at: string;
  };
  services: Array<{
    id: number;
    name: string;
    abbreviation: string;
    color: string;
    category_type: string;
    status: 'active' | 'completed' | 'cancelled';
    started_at: string;
  }>;
  cases: Array<{
    id: number;
    case_number: string;
    title: string;
    description?: string;
    status: string;
    case_type?: string;
    court?: string;
    next_hearing?: string;
    created_at: string;
    tags: Array<{ tag_type: string; tag_value: string }>;
  }>;
  messages: Array<{
    id: number;
    direction: 'inbound' | 'outbound';
    content: string;
    media_url?: string;
    created_at: string;
  }>;
  documents: Array<{
    id: number;
    doc_type: string;
    file_name?: string;
    status: string;
    created_at: string;
  }>;
  appointments: Array<{
    id: number;
    date: string;
    time: string;
    type: string;
    status: string;
  }>;
  stats: {
    totalServices: number;
    totalCases: number;
    totalMessages: number;
    totalDocuments: number;
  };
}

export interface ClientMedia {
  id: number;
  phone: string;
  client_id: number;
  wa_message_id?: string;
  media_type: string;
  mime_type?: string;
  original_name?: string;
  saved_name: string;
  file_path: string;
  file_size?: number;
  context: string;
  created_at: string;
}

// ─── Invoice / Quotation types ─────────────────────────────────────────────

export interface InvoiceItemInput {
  desc: string;
  cantidad: number;
  precio: number;
  itbis?: boolean;
}

export interface CreateInvoicePayload {
  type: "COTIZACIÓN" | "FACTURA";
  clientId?: number;
  clientName: string;
  clientPhone?: string;
  items: InvoiceItemInput[];
  notes?: string;
}

export interface Invoice {
  id: number;
  doc_number?: string;
  type?: string;
  client_name?: string;
  client_phone?: string;
  client_id?: number | null;
  items?: Array<{ desc?: string; name?: string; cantidad?: number; precio?: number; itbis?: boolean }>;
  total?: number;
  subtotal?: number;
  itbis?: number;
  status?: string;
  pdf_path?: string;
  created_at?: string;
  [key: string]: unknown;
}

// ─── Service catalog types ──────────────────────────────────────────────────

export interface ServiceCatalogItem {
  id: number;
  name: string;
  description?: string | null;
  category_name?: string;
  digitacion_price?: string | number | null;
  notarizacion_price?: string | number | null;
  price_tiers?: Array<{ min?: number; max?: number | null; price: number }> | null;
  unit_type?: string;
  active?: boolean;
  [key: string]: unknown;
}

/** Suggested unit price for a catalog item: digitación → notarización → first tier. */
export function catalogUnitPrice(item: ServiceCatalogItem): number | null {
  const dig = Number(item.digitacion_price);
  if (dig > 0) return dig;
  const nota = Number(item.notarizacion_price);
  if (nota > 0) return nota;
  const tier = item.price_tiers?.[0]?.price;
  if (tier != null && Number(tier) > 0) return Number(tier);
  return null;
}

// ─── Chat / Conversation types ──────────────────────────────────────────────

export type MessageDirection = "inbound" | "outbound";
export type HandledBy = "ai" | "human";

export interface ChatMessage {
  id: string;
  phone: string;
  message: string;
  direction: MessageDirection;
  timestamp: string;
  handledBy?: HandledBy;
  fromMe?: boolean;
  read?: boolean;
}

export interface Conversation {
  id: string;
  phone: string;
  name?: string;
  client_id?: number | null;
  client_name?: string | null;
  profile_pic_url?: string | null;
  lastMessage: string;
  lastMessageTime: string;
  timestamp: string;
  unreadCount?: number;
  botActive?: boolean;
  chatEnabled?: boolean;
  manualMode?: boolean;
  aiActive?: boolean;
  handledBy?: HandledBy;
  status?: "active" | "inactive";
}

export interface PhoneStatus {
  phone: string;
  aiActive: boolean;
  mode: "ai" | "human";
}

// ─── Analytics types ────────────────────────────────────────────────────────

export interface IntentData {
  intent: string;
  count: number;
  percentage: number;
}

export interface DashboardStats {
  totalConversations?: number;
  aiHandled?: number;
  humanHandled?: number;
  humanTakeovers?: number;
  avgResponseTimeAI?: number;
  avgResponseTimeHuman?: number;
  totalMessages?: number;
  activeConversations?: number;
  [key: string]: unknown;
}

export interface AnalyticsData {
  topIntents?: IntentData[];
  dailyStats?: { date: string; ai: number; human: number }[];
  [key: string]: unknown;
}

// ─── Document types (Digitación services) ──────────────────────────────────

export interface DocumentIndexItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  sub_subcategory: string | null;
  specialization: string;
  file_path: string;
  absolute_path: string;
  file_extension: string;
  file_size_bytes: number;
  modified_date: string;
  status: 'active' | 'archived' | 'draft';
  description: string;
  tags: string[];
  comments: Array<{
    id?: string;
    author?: string;
    text: string;
    created_at?: string;
  }>;
}

export interface DocGenTemplateVariable {
  tag: string;
  description?: string;
  data_source?: string;
  format_expected?: string;
  is_rol_dynamic?: boolean;
  rol_type?: string;
  is_required?: boolean;
}

export interface DocGenTemplateDetail {
  template: {
    id: number;
    name: string;
    file_path: string;
    doc_type: string;
    description?: string;
    category_name?: string;
  };
  variables: DocGenTemplateVariable[];
  requiredRoles: Record<string, string[]>;
}

export interface DocumentIndexMetadata {
  total_documents: number;
  generated_at: string;
  base_path: string;
}

export interface DocumentIndex {
  metadata: DocumentIndexMetadata;
  categories: string[];
  documents: DocumentIndexItem[];
  grouped_by_category: Record<string, number>;
}

// ─── API Methods ────────────────────────────────────────────────────────────

export const botAPI = {
  // ── Bot connection ──────────────────────────────────────────────────────
  getStatus: () => botApi.get<BotStatus>("/whatsapp/status"),
  connect: () => botApi.post("/whatsapp/connect"),
  getQR: () => botApi.get<{ qr: string | null; status?: string; message?: string }>("/whatsapp/qr"),
  disconnect: () => botApi.post("/whatsapp/disconnect"),
  resync: () => botApi.post("/whatsapp/resync"),
  reconnect: () => botApi.post("/whatsapp/reconnect"),
  toggleBot: () => botApi.post("/whatsapp/bot-toggle"),
  setBotMode: (mode: BotMode) => botApi.post("/whatsapp/bot-mode", { mode }),
  setAssignmentMode: (mode: AssignmentMode) =>
    botApi.post("/whatsapp/assignment-mode", { mode }),

  /** POST /api/whatsapp/archive-chats — Mensajes shows only chats from now on (nothing is deleted) */
  archiveChats: () =>
    botApi.post<{ chatsSince: string; manualCleared: number }>("/whatsapp/archive-chats"),

  /** GET /api/whatsapp/profile-pic/:phone — fetch WhatsApp profile picture URL */
  getProfilePic: (phone: string) =>
    botApi.get<{ url: string | null }>(`/whatsapp/profile-pic/${encodeURIComponent(phone)}`),

  // ── Legacy message/client endpoints ────────────────────────────────────
  getMessages: () => botApi.get<{ conversations: Array<{phone:string;client_name:string|null;last_message:string;last_message_at:string;message_count:string}> }>("/messages/conversations"),
  getClients: () => botApi.get<{ clients: BotClient[] }>("/clients"),
  /** POST /api/clients — create client record and link existing chat messages (409 if phone exists) */
  createClient: (data: { name: string; phone: string; email?: string; address?: string; notes?: string }) =>
    botApi.post<{ client: BotClient }>("/clients", data),
  /** PUT /api/clients/:id — update client fields (name, phone, email, address, notes) */
  updateClient: (clientId: string | number, data: { name?: string; phone?: string; email?: string; address?: string; notes?: string }) =>
    botApi.put<{ client: BotClient }>(`/clients/${clientId}`, data),
  getClientDetail: (clientId: string | number) =>
    botApi.get<ClientDetailFull>(`/clients/${clientId}/detail`),
  getClientMedia: (clientId: string | number) =>
    botApi.get<{ media: ClientMedia[] }>(`/clients/${clientId}/media`),
  /** GET /api/media/phone/:phone — media for a chat by phone (works for unregistered contacts) */
  getMediaByPhone: (phone: string) =>
    botApi.get<{ media: ClientMedia[] }>(`/media/phone/${encodeURIComponent(phone)}`),
  getClientCasesSummary: (clientId: string | number) =>
    botApi.get(`/clients/${clientId}/cases-summary`),
  toggleContactMode: (phone: string) =>
    botApi.post(`/messages/manual-toggle/${encodeURIComponent(phone)}`),
  enableContact: (phone: string) =>
    botApi.post(`/messages/chat-toggle/${encodeURIComponent(phone)}`),
  loginBot: (email: string, password: string) =>
    botApi.post<{ token: string }>("/auth/login", { email, password }),

  // ── Conversations ───────────────────────────────────────────────────────
  /** GET /api/messages/conversations — list all conversations */
  getConversations: () =>
    botApi.get<Conversation[]>("/messages/conversations"),

  /** GET /api/messages/phone/:phone — full message history */
  getPhoneMessages: (phone: string) =>
    botApi.get<ChatMessage[]>(`/messages/phone/${encodeURIComponent(phone)}`),

  /** POST /api/messages/map-lid — link a privacy @lid chat to a real phone number (admin) */
  mapLid: (lidPhone: string, realPhone: string) =>
    botApi.post<{ lidPhone: string; realPhone: string; messagesMoved: number }>(
      `/messages/map-lid`,
      { lidPhone, realPhone },
    ),

  /** POST /api/messages/phone/:phone/mark-read — mark a chat's inbound messages as read */
  markChatRead: (phone: string) =>
    botApi.post<{ marked: number }>(`/messages/phone/${encodeURIComponent(phone)}/mark-read`),

  /** POST /api/messages/send-direct — send a message from the dashboard (agent reply) */
  sendMessage: (phone: string, message: string) =>
    botApi.post("/messages/send-direct", { phone, content: message }),

  /** POST /api/messages/send-media — send an image/audio/video/document to a chat (multipart) */
  sendMedia: (phone: string, file: File, caption?: string) => {
    const formData = new FormData();
    formData.append("phone", phone);
    if (caption) formData.append("caption", caption);
    formData.append("file", file);
    return botApi.post("/messages/send-media", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /** POST /api/messages/bot-toggle/:phone — the chat's 🤖 button: in "Seleccionados" turns the bot
   *  on/off for this chat, in "Todos" is the agent takeover (Bot ↔ Manual) */
  toggleChatAI: (phone: string) =>
    botApi.post<{ phone: string; botActive: boolean }>(`/messages/bot-toggle/${encodeURIComponent(phone)}`),

  /** GET /api/messages/phone-status/:phone — get AI/manual status */
  getPhoneStatus: (phone: string) =>
    botApi.get<PhoneStatus>(`/messages/phone-status/${encodeURIComponent(phone)}`),

  // ── Dashboard & Analytics ───────────────────────────────────────────────
  /** GET /api/dashboard/stats */
  getDashboardStats: () => botApi.get<DashboardStats>("/dashboard/stats"),

  /** GET /api/dashboard/analytics */
  getAnalytics: () => botApi.get<AnalyticsData>("/dashboard/analytics"),

  /** GET /api/clients */
  getAllClients: () => botApi.get<{ clients: BotClient[] }>("/clients"),

  /** POST /api/clients/:id/assign — assign client to a digitador/auxiliar (null = unassign) */
  assignClient: (clientId: number | string, userId: number | string | null) =>
    botApi.post<{ client: BotClient; assigned_to_user: { id: number; username: string; name: string; role: string } | null }>(`/clients/${clientId}/assign`, { user_id: userId }),

  /** POST /api/clients/assign-by-phone — assign (or create-and-assign) a client by phone (null = unassign) */
  assignClientByPhone: (phone: string, userId: number | string | null) =>
    botApi.post<{ client: BotClient; assigned_to_user: { id: number; username: string; name: string; role: string } | null }>(`/clients/assign-by-phone`, { phone, user_id: userId }),

  /** GET /api/admin/users — list users for assignment dropdown */
  getAdminUsers: () => botApi.get<{ users: Array<{ id: number; email: string; username: string; name: string; role: string; created_at: string }> }>("/admin/users"),
  searchConversations: (query: string) =>
    botApi.get<{ conversations: Array<{phone:string;client_name:string|null;last_message:string;last_message_at:string;message_count:string;botActive:boolean;firstMatchId:number|null}> }>("/messages/search", { params: { q: query } }),

  // ── Invoices / Quotations ─────────────────────────────────────────────────
  /** POST /api/invoices — create a quotation or invoice (total computed by backend) */
  createInvoice: (data: CreateInvoicePayload) =>
    botApi.post<{ invoice: Invoice }>("/invoices", data),

  /** POST /api/invoices/:id/generate-pdf — generate the PDF WITHOUT marking it as sent (preview) */
  generateInvoicePdf: (id: number | string) =>
    botApi.post<{ invoice: Invoice; pdfPath: string }>(`/invoices/${id}/generate-pdf`),

  /** POST /api/invoices/:id/send-whatsapp — send the PDF to the client's WhatsApp chat and mark as sent */
  sendInvoiceWhatsapp: (id: number | string) =>
    botApi.post<{ invoice: Invoice; message: string }>(`/invoices/${id}/send-whatsapp`),

  /** POST /api/invoices/:id/request-approval — employee draft -> pending_approval (admin must approve before sending) */
  requestInvoiceApproval: (id: number | string) =>
    botApi.post<{ invoice: Invoice; message: string }>(`/invoices/${id}/request-approval`),

  /** GET /api/invoices/:id/pdf — full URL; download via fetchAuthenticatedFile (Bearer + blob) */
  getInvoicePdfUrl: (id: number | string): string =>
    `${BOT_API_URL}/invoices/${id}/pdf`,

  // ── Service catalog ───────────────────────────────────────────────────────
  /** GET /api/service-catalog/ — list ALL catalog services; filter client-side */
  getServiceCatalog: () =>
    botApi.get<{ services: ServiceCatalogItem[] }>(`/service-catalog/`),

  // ── Document Management (Digitación services) ──────────────────────────────
  /** GET /api/documents/index — fetch document index with all 319 documents */
  getDocumentIndex: () =>
    botApi.get<DocumentIndex>("/documents/index"),

  /** POST /api/documents/:id/comment — add comment to document */
  addDocumentComment: (docId: string, comment: { text: string; author?: string }) =>
    botApi.post(`/documents/${docId}/comment`, comment),

  /** PUT /api/documents/:id — update document metadata */
  updateDocumentMetadata: (docId: string, updates: Partial<DocumentIndexItem>) =>
    botApi.put(`/documents/${docId}`, updates),

  /** GET /api/documents/file/:docId — returns URL to stream a document file (used as iframe src) */
  getDocumentFileUrl: (docId: string): string => {
    return `${BOT_API_URL}/documents/file/${docId}`;
  },

  // ── Document Generation (Mother Brain) ─────────────────────────────────────
  /** GET /api/docgen/templates/:id — template detail with variables and roles */
  getDocGenTemplateDetail: (id: number | string) =>
    botApi.get<DocGenTemplateDetail>(`/docgen/templates/${id}`),

  /** POST /api/docgen/sessions — create a generation session */
  createDocGenSession: (templateId: number | string, clientId?: number | string | null, phone?: string) =>
    botApi.post<{ session: { id: number | string } }>("/docgen/sessions", { templateId, clientId, phone }),

  /** PUT /api/docgen/sessions/:id/data — update collected data and roles */
  updateDocGenSessionData: (
    id: number | string,
    collectedData: Record<string, string>,
    assignedRoles: Record<string, Record<string, string>>
  ) => botApi.put(`/docgen/sessions/${id}/data`, { collectedData, assignedRoles }),

  /** POST /api/docgen/sessions/:id/generate — generate the document */
  generateDocGenSession: (id: number | string) =>
    botApi.post<{ success: boolean; fileName: string; filePath: string }>(`/docgen/sessions/${id}/generate`),

  /** GET /api/docgen/sessions/:id/download — download URL for generated document */
  getDocGenSessionDownloadUrl: (id: number | string): string =>
    `${BOT_API_URL}/docgen/sessions/${id}/download`,
};

export default botApi;
