import React, { useEffect, useState, useCallback, useRef } from "react";
import UserBadge from "../components/UserBadge";
import { botAPI, getBotApiBaseURL, catalogUnitPrice, type ServiceCatalogItem, type Invoice, type ClientMedia } from "../services/botApi";
import { getAuthToken, fetchAuthenticatedFile, formatCurrency, preventDecimalInput } from "../utils";
import { useAuth } from "../context/AuthContext";
import { whatsappAction } from "../lib/quoteActions";
import { NeoCard, NeoButton, NeoInput } from "@guru/ui";
import {
  MessageSquare,
  Search,
  Send,
  Bot,
  User,
  RefreshCw,
  ChevronLeft,
  MessageCircle,
  UserCheck,
  Download,
  Maximize2,
  X,
  Info,
  FileText,
  Briefcase,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Package,
  Receipt,
  Plus,
  Trash2,
  UserPlus,
  Pencil,
  Image as ImageIcon,
  Paperclip,
  SlidersHorizontal,
} from "lucide-react";
import { notify } from "../lib/dialogs";
import { formatPhone } from "../lib/phone";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConvRow {
  phone: string;
  client_name: string | null;
  client_id?: number | null;
  client_assigned_to?: number | null;
  profile_pic_url?: string | null;
  last_message: string;
  last_message_at: string;
  message_count: string;
  botActive: boolean;
  firstMatchId?: string | number | null;
}

interface MsgRow {
  id: string | number;
  phone: string;
  direction: "inbound" | "outbound";
  content: string;        // real field from API
  message?: string;       // fallback alias
  media_url?: string | null;
  status?: string;
  created_at: string;
  ai_generated?: boolean;
}

interface ClientDetail {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name?: string | null, phone?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return phone ? phone.slice(-4) : "??";
}

interface AvatarProps {
  url?: string | null;
  name?: string | null;
  phone?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ url, name, phone, size = "md", className = "" }) => {
  const [failed, setFailed] = useState(false);

  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name || phone || "avatar"}
        onError={() => setFailed(true)}
        className={`rounded-full border-2 border-border object-cover shadow-button ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full border-2 border-border bg-main font-black text-main-foreground shadow-button ${sizeClasses[size]} ${className}`}
    >
      {getInitials(name, phone)}
    </div>
  );
};

function formatRelTime(ts: string): string {
  const date = new Date(ts);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "ahora";
  if (diffMins < 60) return `hace ${diffMins} min`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) {
    return date.toLocaleTimeString("es-DO", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Santo_Domingo",
    });
  }
  const fmt = (d: Date) => d.toLocaleDateString("es-DO", { timeZone: "America/Santo_Domingo" });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (fmt(date) === fmt(yesterday)) return "Ayer";
  return date.toLocaleDateString("es-DO", {
    day: "numeric",
    month: "short",
    timeZone: "America/Santo_Domingo",
  });
}

/** True when the WhatsApp display name looks like a long numeric code (not a real name) */
function looksLikeNumericCode(s?: string | null): boolean {
  if (!s || !s.trim()) return true;
  if (/[A-Za-záéíóúñÁÉÍÓÚÑ]/.test(s)) return false;
  return s.replace(/\D/g, "").length >= 8;
}

function getDateLabel(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString("es-DO", { timeZone: "America/Santo_Domingo" });
  if (fmt(date) === fmt(now)) return "Hoy";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (fmt(date) === fmt(yesterday)) return "Ayer";
  return date.toLocaleDateString("es-DO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Santo_Domingo",
  });
}

// ─── Conversation Item ────────────────────────────────────────────────────────

interface ConvItemProps {
  conv: ConvRow;
  isSelected: boolean;
  onSelect: () => void;
  onToggleAI: (phone: string, e: React.MouseEvent) => void;
}

const ConvItem: React.FC<ConvItemProps> = ({
  conv,
  isSelected,
  onSelect,
  onToggleAI,
}) => {
  const name = conv.client_name || formatPhone(conv.phone);
  const preview = conv.last_message || "—";
  const time = formatRelTime(conv.last_message_at);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-3 px-3 py-2.5 pr-12 text-left transition-colors ${
          isSelected ? "bg-main/15 shadow-[inset_4px_0_0_0_var(--main)]" : "hover:bg-secondary-background"
        }`}
      >
        <Avatar
          url={conv.profile_pic_url}
          name={conv.client_name}
          phone={conv.phone}
          size="md"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-bold text-foreground">{name}</p>
            <span className="shrink-0 text-[11px] tabular-nums text-foreground/50">{time}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-foreground/65">{preview}</p>
          {conv.client_assigned_to != null && (
            <div className="mt-1">
              <UserBadge userId={conv.client_assigned_to} />
            </div>
          )}
        </div>
      </button>

      {/* Bot switch for this chat */}
      <button
        type="button"
        onClick={(e) => onToggleAI(conv.phone, e)}
        aria-label={conv.botActive ? "Bot activo en este chat: pasar a manual" : "Manual: activar bot en este chat"}
        title={conv.botActive ? "Bot activo — clic para pasar a manual" : "Manual — clic para activar el bot"}
        className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-base border-2 border-border transition-colors ${
          conv.botActive
            ? "bg-main text-main-foreground shadow-button"
            : "bg-background text-foreground/60 hover:bg-secondary-background"
        }`}
      >
        {conv.botActive ? <Bot size={15} /> : <User size={15} />}
      </button>
    </li>
  );
};

// ─── Authenticated media loader (Blob URL) ───────────────────────────────────

function useMediaBlob(apiPath: string | null | undefined) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");

  useEffect(() => {
    if (!apiPath) return;
    let revoked = false;
    const token = getAuthToken();
    const base = getBotApiBaseURL();
    // media_url is stored as /api/media/... while baseURL already ends in /api
    const cleanBase = apiPath.startsWith("/api/") && base.endsWith("/api")
      ? base.slice(0, -4)
      : base;
    const url = apiPath.startsWith("http") ? apiPath : `${cleanBase}${apiPath}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) return;
        const ct = res.headers.get("content-type") ?? "";
        const blob = await res.blob();
        if (!revoked) {
          setMimeType(ct);
          setBlobUrl(URL.createObjectURL(blob));
        }
      })
      .catch(() => {});
    return () => {
      revoked = true;
      setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [apiPath]);

  return { blobUrl, mimeType };
}

// ─── Fullscreen image lightbox (like WhatsApp's "view photo") ─────────────────

const ImageLightbox: React.FC<{ src: string; alt?: string; onClose: () => void }> = ({ src, alt, onClose }) => (
  <div
    className="fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-4"
    onClick={onClose}
  >
    <button
      onClick={onClose}
      title="Cerrar"
      className="absolute right-4 top-4 rounded-base border-2 border-white/30 bg-white/10 p-2 text-white hover:bg-white/20"
    >
      <X size={20} />
    </button>
    <img
      src={src}
      alt={alt || "imagen"}
      className="max-h-full max-w-full rounded-base object-contain"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

// ─── Single media item for the client-media viewer grid ────────────────────────

const MediaGridItem: React.FC<{ media: ClientMedia }> = ({ media }) => {
  const apiPath = `/api/media/${media.id}/download`;
  const { blobUrl, mimeType } = useMediaBlob(apiPath);
  const [lightbox, setLightbox] = useState(false);
  const type = media.media_type || "";
  const isImage = type === "image" || mimeType.startsWith("image/");
  const isAudio = type === "audio" || mimeType.startsWith("audio/");
  const isVideo = type === "video" || mimeType.startsWith("video/");
  const label = media.original_name || `${type || "archivo"} #${media.id}`;

  return (
    <div className="rounded-base border-2 border-border bg-background p-2">
      {isImage ? (
        blobUrl ? (
          <button type="button" onClick={() => setLightbox(true)} title="Ver foto" className="block w-full">
            <img src={blobUrl} alt={label} className="h-36 w-full cursor-pointer rounded-base object-cover" />
          </button>
        ) : (
          <div className="flex h-36 items-center justify-center text-foreground/40"><RefreshCw size={18} className="animate-spin" /></div>
        )
      ) : isAudio ? (
        <div className="flex h-36 items-center justify-center py-2">
          {blobUrl ? <audio controls src={blobUrl} className="w-full" /> : <RefreshCw size={18} className="animate-spin" />}
        </div>
      ) : isVideo ? (
        blobUrl
          ? <video controls src={blobUrl} className="h-36 w-full rounded-base object-cover" />
          : <div className="flex h-36 items-center justify-center"><RefreshCw size={18} className="animate-spin" /></div>
      ) : (
        <div className="flex h-36 flex-col items-center justify-center gap-2 text-foreground/60">
          <FileText size={28} />
          {blobUrl && <a href={blobUrl} download={label} className="text-xs font-semibold text-main underline">Descargar</a>}
        </div>
      )}
      <p className="mt-1 truncate font-base text-[11px] text-foreground/60" title={label}>{label}</p>
      {lightbox && blobUrl && <ImageLightbox src={blobUrl} alt={label} onClose={() => setLightbox(false)} />}
    </div>
  );
};

// ─── PDF preview with fullscreen modal ────────────────────────────────────────

const PdfPreview: React.FC<{ blobUrl: string; apiPath: string }> = ({ blobUrl, apiPath }) => {
  const [open, setOpen] = useState(false);

  const fileName = apiPath.split("/").pop() || "documento.pdf";

  return (
    <div className="mb-1.5">
      <div className="relative">
        <iframe
          src={blobUrl}
          title="Vista previa PDF"
          className="h-64 w-full rounded-base border-2 border-border bg-white shadow-button"
        />
        <button
          onClick={() => setOpen(true)}
          className="absolute right-2 top-2 rounded-base border-2 border-border bg-secondary-background p-1.5 text-foreground shadow-button hover:bg-main hover:text-main-foreground"
          title="Ver en pantalla completa"
        >
          <Maximize2 size={14} />
        </button>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <a
          href={blobUrl}
          download={fileName}
          className="flex items-center justify-center gap-1 rounded-base border-2 border-border bg-secondary-background px-2 py-1 font-base text-[10px] font-black uppercase tracking-wide text-foreground hover:bg-main hover:text-main-foreground"
        >
          <Download size={12} />
          Descargar PDF
        </a>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-1 rounded-base border-2 border-border bg-secondary-background px-2 py-1 font-base text-[10px] font-black uppercase tracking-wide text-foreground hover:bg-main hover:text-main-foreground"
        >
          <Maximize2 size={12} />
          Ampliar
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="flex items-center justify-between pb-2">
            <span className="font-base text-sm font-semibold text-white">{fileName}</span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-base border-2 border-white/30 bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <X size={18} />
            </button>
          </div>
          <iframe
            src={blobUrl}
            title="Vista previa PDF pantalla completa"
            className="flex-1 w-full rounded-base bg-white"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

// ─── Media bubble component ───────────────────────────────────────────────────

const MediaAttachment: React.FC<{ apiPath: string; isOut: boolean }> = ({ apiPath, isOut }) => {
  const { blobUrl, mimeType } = useMediaBlob(apiPath);
  const [lightbox, setLightbox] = useState(false);

  if (!blobUrl) {
    return (
      <div className={`mb-1.5 font-base text-xs italic ${isOut ? "text-main-foreground/60" : "text-foreground/50"}`}>
        Cargando media…
      </div>
    );
  }

  const DownloadLink = ({ label = "Descargar" }: { label?: string }) => (
    <a
      href={blobUrl}
      download
      className="mt-1 flex items-center justify-center gap-1 rounded-base border-2 border-border bg-secondary-background px-2 py-1 font-base text-[10px] font-black uppercase tracking-wide text-foreground hover:bg-main hover:text-main-foreground"
    >
      <Download size={12} />
      {label}
    </a>
  );

  if (mimeType.startsWith("image/")) {
    return (
      <div className="mb-1.5">
        <img
          src={blobUrl}
          alt="imagen"
          className="w-full max-h-52 cursor-pointer rounded-base border-2 border-border object-cover shadow-button"
          onClick={() => setLightbox(true)}
          title="Ver foto"
        />
        <DownloadLink />
        {lightbox && <ImageLightbox src={blobUrl} alt="imagen" onClose={() => setLightbox(false)} />}
      </div>
    );
  }

  if (mimeType.startsWith("audio/")) {
    return (
      <div className="mb-1.5">
        <audio controls preload="metadata" className="w-full min-w-[250px]">
          <source src={blobUrl} type={mimeType || "audio/ogg"} />
          Tu navegador no soporta audio.
        </audio>
        <DownloadLink />
      </div>
    );
  }

  if (mimeType.startsWith("video/")) {
    return (
      <div className="mb-1.5">
        <video controls src={blobUrl} className="max-h-52 w-full rounded-base border-2 border-border object-cover shadow-button">
          Tu navegador no soporta video.
        </video>
        <DownloadLink />
      </div>
    );
  }

  // PDFs: inline preview + fullscreen + download
  if (mimeType === "application/pdf" || apiPath.toLowerCase().endsWith(".pdf")) {
    return (
      <PdfPreview blobUrl={blobUrl} apiPath={apiPath} />
    );
  }

  // Generic document download
  return (
    <div className="mb-1.5">
      <div className="flex items-center gap-2 rounded-base border-2 border-border bg-secondary-background px-3 py-2 shadow-button">
        <Download size={18} />
        <span className="font-base text-sm font-semibold">Documento</span>
      </div>
      <DownloadLink />
    </div>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────────────────

const MessageBubble: React.FC<{ msg: MsgRow; isHighlighted?: boolean }> = ({ msg, isHighlighted }) => {
  const isOut = msg.direction === "outbound";
  // Real field is "content"; fallback to "message" for safety
  const text = msg.content ?? msg.message ?? "";
  const time = (() => {
    try {
      return new Date(msg.created_at).toLocaleTimeString("es-DO", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Santo_Domingo",
      });
    } catch {
      return "";
    }
  })();

  const media = msg.media_url;

  return (
    <div
      className={`mb-1.5 flex ${isOut ? "justify-end" : "justify-start"} transition-all duration-300`}
      id={`msg-${msg.id}`}
    >
      <div
        className={`max-w-[85%] px-3 py-2 font-base text-sm shadow-button transition-all duration-300 md:max-w-[70%] ${
          isHighlighted
            ? "scale-[1.02] ring-2 ring-main ring-offset-2 ring-offset-background"
            : ""
        } ${
          // the bot's replies are light, a person's are solid: you see at a glance who answered
          isOut
            ? msg.ai_generated
              ? "rounded-bl-base rounded-tl-base rounded-tr-base border-2 border-border bg-main/15 text-foreground"
              : "rounded-bl-base rounded-tl-base rounded-tr-base border-2 border-border bg-main text-main-foreground"
            : "rounded-br-base rounded-tl-base rounded-tr-base border-2 border-border bg-background text-foreground"
        }`}
      >
        {/* Authenticated media */}
        {media && <MediaAttachment apiPath={media} isOut={isOut} />}
        {/* Text content */}
        {text && !text.startsWith("[📎") && !text.startsWith("[🎤") && (
          <p className="whitespace-pre-line break-words leading-relaxed">{text}</p>
        )}
        {/* Timestamp */}
        <p
          className={`mt-0.5 font-base text-[11px] tabular-nums ${
            isOut ? "text-right" : ""
          } ${isOut && !msg.ai_generated ? "text-main-foreground/70" : "text-foreground/50"}`}
        >
          {msg.ai_generated && <span className="mr-1.5 font-bold">🤖 Bot ·</span>}
          {time}
        </p>
      </div>
    </div>
  );
};

// ─── Date Separator ───────────────────────────────────────────────────────────

const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="my-3 flex items-center gap-3">
    <div className="flex-1 border-t-2 border-border/15" />
    <span className="rounded-full border-2 border-border bg-background px-2.5 py-0.5 font-base text-[11px] font-bold capitalize text-foreground/70">
      {label}
    </span>
    <div className="flex-1 border-t-2 border-border/15" />
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const BotMessages: React.FC = () => {
  const { isAdmin } = useAuth();
  // Conversation list
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ai" | "manual">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [contactFilter, setContactFilter] = useState<"all" | "clients" | "non_clients">("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("ALL"); // "ALL" | "none" | user id

  // Selected conversation
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(false); // mobile toggle
  const [assignableUsers, setAssignableUsers] = useState<Array<{ id: number; name: string; role: string; username: string }>>([]);
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  // Chat
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  // ── Media attach (send image/file from chat) ──
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachPreview, setAttachPreview] = useState<string | null>(null);
  const [attachCaption, setAttachCaption] = useState("");
  const [sendingMedia, setSendingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | number | null>(null);
  const [globalBotActive, setGlobalBotActive] = useState<boolean | null>(null);

  // Message search
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearch, setMsgSearch] = useState("");
  const [messageSearchMatches, setMessageSearchMatches] = useState<(string | number)[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Client detail panel
  const [showClientPanel, setShowClientPanel] = useState(false);
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [clientDetailLoading, setClientDetailLoading] = useState(false);
  // ── Edit client & media viewer ──
  const [showEditClient, setShowEditClient] = useState(false);
  const [editClientForm, setEditClientForm] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [savingClient, setSavingClient] = useState(false);
  const [editClientMsg, setEditClientMsg] = useState<string | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [clientMediaList, setClientMediaList] = useState<ClientMedia[]>([]);
  const [clientMediaLoading, setClientMediaLoading] = useState(false);

  // Add-contact form (chat without client record)
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactMsg, setContactMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // Link @lid to real phone
  const [linkPhone, setLinkPhone] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Quote/invoice modal
  interface QuoteItemForm {
    desc: string;
    cantidad: number | string;
    precio: number | string;
    itbis: boolean;
  }
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteType, setQuoteType] = useState<"COTIZACIÓN" | "FACTURA">("COTIZACIÓN");
  const [quoteItems, setQuoteItems] = useState<QuoteItemForm[]>([
    { desc: "", cantidad: 1, precio: "", itbis: false },
  ]);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteGenerating, setQuoteGenerating] = useState(false);
  const [quoteInvoice, setQuoteInvoice] = useState<Invoice | null>(null);
  const [quotePdfUrl, setQuotePdfUrl] = useState<string | null>(null);
  const [quotePdfFullscreen, setQuotePdfFullscreen] = useState(false);
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);
  const [quoteApprovalRequested, setQuoteApprovalRequested] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<ServiceCatalogItem[]>([]);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [catalogAll, setCatalogAll] = useState<ServiceCatalogItem[]>([]);
  const [showCatalogResults, setShowCatalogResults] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const prevMessageCount = useRef(0);

  // ── Fetch conversation list ─────────────────────────────────────────────────

  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setConvLoading(true);
    try {
      const res = await botAPI.getMessages();
      const raw = res.data as {
        conversations?: Array<{
          phone: string;
          client_id?: number | null;
          client_name?: string | null;
          client_assigned_to?: number | null;
          profile_pic_url?: string | null;
          last_message: string;
          last_message_at: string;
          message_count: string;
          botActive?: boolean;
          chatEnabled?: boolean;
          manualMode?: boolean;
        }>;
      };
      const convs = raw.conversations ?? [];
      setConversations((prev) => {
        const prevMap = new Map(prev.map((c) => [c.phone, c.botActive]));
        const assignedMap = new Map(prev.map((c) => [c.phone, c.client_assigned_to]));
        return convs.map((c) => ({
          ...c,
          client_id: c.client_id ?? null,
          client_name: c.client_name ?? null,
          client_assigned_to: c.client_assigned_to ?? assignedMap.get(c.phone) ?? null,
          profile_pic_url: c.profile_pic_url ?? null,
          botActive: c.botActive ?? prevMap.get(c.phone) ?? true,
        }));
      });
    } catch {
      // silent
    } finally {
      setConvLoading(false);
    }
  }, []);

  const fetchGlobalStatus = useCallback(async () => {
    try {
      const res = await botAPI.getStatus();
      setGlobalBotActive(!(res.data.paused ?? false));
    } catch {
      setGlobalBotActive(null);
    }
  }, []);

  // Auto-open chat from BotClients (localStorage) or from a notification link (?phone=)
  useEffect(() => {
    const phoneToOpen = localStorage.getItem('openChatPhone');
    if (phoneToOpen) {
      localStorage.removeItem('openChatPhone');
      setSelectedPhone(phoneToOpen);
      setShowRightPanel(true);
      return;
    }
    // From a notification link: /bot-messages?phone=XXXXXXXX
    const qp = new URLSearchParams(window.location.search).get('phone');
    if (qp) {
      setSelectedPhone(qp);
      setShowRightPanel(true);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchGlobalStatus();
    const iv = setInterval(() => {
      fetchConversations(true);
      fetchGlobalStatus();
    }, 8000);
    return () => clearInterval(iv);
  }, [fetchConversations, fetchGlobalStatus]);

  // ── Fetch client detail for info panel ────────────────────────────────────

  const fetchClientDetail = useCallback(async (clientId: number | string) => {
    setClientDetailLoading(true);
    try {
      const res = await botAPI.getClientDetail(clientId);
      setClientDetail(res.data as ClientDetail);
    } catch {
      setClientDetail(null);
    } finally {
      setClientDetailLoading(false);
    }
  }, []);

  // ── Edit client ────────────────────────────────────────────────────────────
  const openEditClient = () => {
    const c = clientDetail?.client;
    if (!c) return;
    setEditClientForm({
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      notes: c.notes || "",
    });
    setEditClientMsg(null);
    setShowEditClient(true);
  };

  const saveEditClient = async () => {
    const c = clientDetail?.client;
    if (!c?.id) return;
    setSavingClient(true);
    setEditClientMsg(null);
    try {
      await botAPI.updateClient(c.id, {
        name: editClientForm.name.trim() || undefined,
        phone: editClientForm.phone.trim() || undefined,
        email: editClientForm.email.trim() || undefined,
        address: editClientForm.address.trim() || undefined,
        notes: editClientForm.notes,
      });
      setEditClientMsg("Guardado ✓");
      await fetchClientDetail(c.id);
      await fetchConversations(true);
      setTimeout(() => setShowEditClient(false), 700);
    } catch {
      setEditClientMsg("Error al guardar");
    } finally {
      setSavingClient(false);
    }
  };

  // ── Media viewer ───────────────────────────────────────────────────────────
  // Works for registered clients (by client_id) AND unregistered contacts (by phone).
  const openMediaModal = async () => {
    const clientId = clientDetail?.client?.id;
    if (!clientId && !selectedPhone) return;
    setShowMediaModal(true);
    setClientMediaLoading(true);
    setClientMediaList([]);
    try {
      const res = clientId
        ? await botAPI.getClientMedia(clientId)
        : await botAPI.getMediaByPhone(selectedPhone);
      setClientMediaList((res.data as { media?: ClientMedia[] }).media ?? []);
    } catch {
      setClientMediaList([]);
    } finally {
      setClientMediaLoading(false);
    }
  };

  // ── Fetch messages for selected phone ──────────────────────────────────────

  const fetchMessages = useCallback(async (phone: string, silent = false) => {
    if (!silent) setMsgLoading(true);
    try {
      const res = await botAPI.getPhoneMessages(phone);
      const data = res.data as unknown;
      const raw = Array.isArray(data) ? data : ((data as any).messages ?? []);
      setMessages([...raw].reverse()); // API returns DESC, we need ASC for chat display
    } catch {
      if (!silent) setMessages([]);
    } finally {
      if (!silent) setMsgLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPhone) {
      fetchMessages(selectedPhone);
      // Mark this chat's inbound messages as read so the "Mensajes" badge drops
      botAPI.markChatRead(selectedPhone).catch(() => {});
    }
  }, [selectedPhone, fetchMessages]);

  // Auto-refresh selected chat (silent — no loading spinner, no scroll reset)
  useEffect(() => {
    if (!selectedPhone) return;
    const iv = setInterval(() => fetchMessages(selectedPhone, true), 8000);
    return () => clearInterval(iv);
  }, [selectedPhone, fetchMessages]);

  // Scroll to bottom ONLY on first load or conversation switch
  const lastSelectedPhone = useRef<string | null>(null);
  useEffect(() => {
    if (!messages.length) return;
    const isNewConversation = selectedPhone !== lastSelectedPhone.current;
    const isFirstLoad = prevMessageCount.current === 0;
    const hasNewMessages = messages.length > prevMessageCount.current;
    prevMessageCount.current = messages.length;

    if (isNewConversation || isFirstLoad) {
      lastSelectedPhone.current = selectedPhone;
      // Instant jump to bottom on conversation switch
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }, 50);
    } else if (hasNewMessages && !userScrolledRef.current) {
      // New message arrived and user is at bottom — smooth scroll
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    // If user scrolled up: NEVER move scroll
  }, [messages, selectedPhone]);

  // Track if user scrolled up manually
  const handleScrollContainer = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    userScrolledRef.current = distFromBottom > 80;
  }, []);

  // Scroll to highlighted message (search result) — wait for messages to load
  useEffect(() => {
    if (!highlightMessageId || messages.length === 0) return;
    // Wait for DOM to render the message
    const timer = setTimeout(() => {
      // Try both formats: msg-{id} and msg-{stringId}
      let element = document.getElementById(`msg-${highlightMessageId}`);
      if (!element) {
        // Try with string conversion
        element = document.getElementById(`msg-${String(highlightMessageId)}`);
      }
      console.log(`[Search] Looking for msg-${highlightMessageId}, found:`, !!element);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        console.log(`[Search] Scrolled to message ${highlightMessageId}`);
      } else {
        console.log(`[Search] Message ${highlightMessageId} not found in DOM`);
        console.log(`[Search] Available message IDs:`, messages.slice(0, 5).map(m => m.id));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [highlightMessageId, messages]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const selectConversation = (phone: string, firstMatchId?: string | number | null) => {
    setSelectedPhone(phone);
    setShowRightPanel(true);
    setInputText("");
    setHighlightMessageId(firstMatchId || null);
  };

  const handleToggleAI = async (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) =>
      prev.map((c) => (c.phone === phone ? { ...c, botActive: !c.botActive } : c))
    );
    try {
      const res = await botAPI.toggleChatAI(phone);
      // the server says where it ended up (an always-manual number can't be switched on)
      setConversations((prev) =>
        prev.map((c) => (c.phone === phone ? { ...c, botActive: res.data.botActive } : c))
      );
    } catch {
      // revert on failure
      setConversations((prev) =>
        prev.map((c) => (c.phone === phone ? { ...c, botActive: !c.botActive } : c))
      );
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !selectedPhone || sending) return;
    setInputText("");
    setSending(true);
    // Optimistic message
    const optimistic: MsgRow = {
      id: `opt-${Date.now()}`,
      phone: selectedPhone,
      direction: "outbound",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      await botAPI.sendMessage(selectedPhone, text);
      await fetchMessages(selectedPhone);
    } catch {
      // keep optimistic on screen
    } finally {
      setSending(false);
    }
  };

  // ── Media attach handlers ──────────────────────────────────────────────────
  const handleAttachSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      notify("El archivo es muy grande (máximo 16MB).");
      return;
    }
    setAttachFile(file);
    setAttachCaption("");
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setAttachPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachPreview(null);
    }
    // reset input so the same file can be picked again later
    e.target.value = "";
  };

  const cancelAttach = () => {
    setAttachFile(null);
    setAttachPreview(null);
    setAttachCaption("");
  };

  const handleSendMedia = async () => {
    if (!attachFile || !selectedPhone || sendingMedia) return;
    setSendingMedia(true);
    try {
      await botAPI.sendMedia(selectedPhone, attachFile, attachCaption.trim() || undefined);
      cancelAttach();
      await fetchMessages(selectedPhone);
    } catch (err) {
      notify("No se pudo enviar el archivo. Verifica que el bot esté conectado.");
    } finally {
      setSendingMedia(false);
    }
  };

  // ── Assignment (admin only) ───────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await botAPI.getAdminUsers();
        const data = res.data as { users?: Array<{ id: number; name: string; role: string; username: string }> } | undefined;
        setAssignableUsers((data?.users || [])
          // Only real digitadores (not auxiliares, not the admin workload account)
          .filter((u) => u.role === "digitador" && u.username !== "administracion")
          .map((u) => ({ id: u.id, name: u.name || u.username, role: u.role, username: u.username })));
      } catch {
        setAssignableUsers([]);
      }
    })();
  }, [isAdmin]);

  const handleAssign = async (userId: string) => {
    if (!selectedPhone) return;
    const isUnassign = userId === "";
    const targetUserId = isUnassign ? null : parseInt(userId, 10);
    const previousAssignedTo = selectedConv?.client_assigned_to ?? null;

    // Optimistic update so the UI doesn't flicker back
    setConversations((prev) =>
      prev.map((c) =>
        c.phone === selectedPhone ? { ...c, client_assigned_to: targetUserId } : c
      )
    );

    setAssigning(true);
    setAssignMsg(null);
    try {
      if (selectedConv?.client_id) {
        await botAPI.assignClient(selectedConv.client_id, targetUserId);
      } else {
        await botAPI.assignClientByPhone(selectedPhone, targetUserId);
      }
      setAssignMsg(isUnassign ? "Desasignado" : "Asignado correctamente");
      await fetchConversations(true);
    } catch (err: any) {
      // Revert on failure
      setConversations((prev) =>
        prev.map((c) =>
          c.phone === selectedPhone ? { ...c, client_assigned_to: previousAssignedTo } : c
        )
      );
      setAssignMsg(err?.response?.data?.error || "Error al asignar");
    } finally {
      setAssigning(false);
      setTimeout(() => setAssignMsg(null), 3000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Message search ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!msgSearch.trim()) {
      setMessageSearchMatches([]);
      setHighlightMessageId(null);
      return;
    }

    const q = msgSearch.toLowerCase();
    const matches = messages
      .filter((m) => m.content.toLowerCase().includes(q))
      .map((m) => m.id);
    setMessageSearchMatches(matches);
    setCurrentMatchIndex(0);

    if (matches.length > 0) {
      setHighlightMessageId(matches[0]);
      setTimeout(() => {
        const el = document.getElementById(`msg-${matches[0]}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [msgSearch, messages]);

  // ── Filtering ──────────────────────────────────────────────────────────────

  // Search + folded filters first; the tabs (and their counts) work on that list
  const narrowed = conversations.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      (c.client_name || "").toLowerCase().includes(q) ||
      c.phone.includes(q);
    const matchContact =
      contactFilter === "all" ||
      (contactFilter === "clients" ? c.client_id != null : c.client_id == null);
    const matchAssigned =
      assignedFilter === "ALL" ||
      (assignedFilter === "none" ? c.client_assigned_to == null : String(c.client_assigned_to) === assignedFilter);
    return matchSearch && matchContact && matchAssigned;
  });
  const tabCounts = {
    all: narrowed.length,
    ai: narrowed.filter((c) => c.botActive).length,
    manual: narrowed.filter((c) => !c.botActive).length,
  };
  const filtered = narrowed.filter(
    (c) => filter === "all" || (filter === "ai" && c.botActive) || (filter === "manual" && !c.botActive),
  );

  const assignedName = (id: string) =>
    id === "none" ? "Sin asignar" : assignableUsers.find((u) => String(u.id) === id)?.name || `Usuario ${id}`;
  const activeFilters = [
    contactFilter !== "all" && {
      key: "contact",
      label: contactFilter === "clients" ? "Clientes" : "Sin cliente",
      clear: () => setContactFilter("all"),
    },
    assignedFilter !== "ALL" && { key: "assigned", label: assignedName(assignedFilter), clear: () => setAssignedFilter("ALL") },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const clearFilters = () => {
    setContactFilter("all");
    setAssignedFilter("ALL");
  };

  const selectedConv = conversations.find((c) => c.phone === selectedPhone);

  // A chat is a privacy @lid when the "phone" is a long numeric ID (WhatsApp hides the
  // real number). Those can be manually linked to a real phone number.
  const isLidChat = !!selectedPhone && /^\d{13,}$/.test(selectedPhone.replace(/\D/g, ""));

  // Load client detail when the side panel opens
  useEffect(() => {
    if (showClientPanel && selectedConv?.client_id) {
      fetchClientDetail(selectedConv.client_id);
    } else if (!showClientPanel) {
      setClientDetail(null);
    }
  }, [showClientPanel, selectedConv?.client_id, fetchClientDetail]);

  // ── Add contact (chat without client record) ──────────────────────────────

  // Pre-fill the form when the selected chat changes
  useEffect(() => {
    setContactPhone(selectedPhone ?? "");
    const nm = selectedConv?.client_name;
    setContactName(nm && !looksLikeNumericCode(nm) ? nm : "");
    setContactMsg(null);
  }, [selectedPhone, selectedConv?.client_name]);

  const handleAddContact = async () => {
    if (!selectedPhone || contactSaving) return;
    if (!contactName.trim()) {
      setContactMsg({ type: "err", text: "El nombre es obligatorio." });
      return;
    }
    if (!contactPhone.trim()) {
      setContactMsg({ type: "err", text: "El teléfono es obligatorio." });
      return;
    }
    setContactSaving(true);
    setContactMsg(null);
    try {
      await botAPI.createClient({ name: contactName.trim(), phone: contactPhone.trim() });
      setContactMsg({ type: "ok", text: "Contacto agregado correctamente." });
      // Refresh so the conversation picks up the new client_id and the panel shows the record
      await fetchConversations(true);
    } catch (err: any) {
      const msg =
        err?.response?.status === 409
          ? "Este número ya está registrado como cliente."
          : err?.response?.data?.error || "Error al agregar el contacto.";
      setContactMsg({ type: "err", text: msg });
    } finally {
      setContactSaving(false);
    }
  };

  // ── Link @lid chat to a real phone number ────────────────────────────────────
  const handleLinkLid = async () => {
    if (!selectedPhone || linking) return;
    const real = linkPhone.replace(/\D/g, "");
    if (!real) {
      setLinkMsg({ type: "err", text: "Ingresa el número real del contacto." });
      return;
    }
    setLinking(true);
    setLinkMsg(null);
    try {
      const res = await botAPI.mapLid(selectedPhone, real);
      setLinkMsg({ type: "ok", text: `Vinculado. ${res.data.messagesMoved} mensajes movidos a ${real}.` });
      await fetchConversations(true);
      // Reload the conversation now pointing at the real number
      setSelectedPhone(real);
    } catch (err: any) {
      setLinkMsg({ type: "err", text: err?.response?.data?.error || "Error al vincular el número." });
    } finally {
      setLinking(false);
    }
  };

  // ── Quote / invoice generation ─────────────────────────────────────────────

  // Load the full service catalog once when the quote modal opens
  useEffect(() => {
    if (!showQuoteModal || catalogAll.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await botAPI.getServiceCatalog();
        const list = (res.data as { services?: ServiceCatalogItem[] }).services ?? [];
        if (!cancelled) setCatalogAll(list.filter((s) => s.active !== false));
      } catch {
        // catalog is optional — employee can still type items manually
      }
    })();
    return () => { cancelled = true; };
  }, [showQuoteModal, catalogAll.length]);

  // Filter the catalog locally as the user types
  useEffect(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (q.length < 2) {
      setCatalogResults([]);
      setCatalogSearching(false);
      return;
    }
    setCatalogSearching(false);
    setCatalogResults(catalogAll.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8));
  }, [catalogQuery, catalogAll]);

  const openQuoteModal = () => {
    setQuoteType("COTIZACIÓN");
    setQuoteItems([{ desc: "", cantidad: 1, precio: "", itbis: false }]);
    setQuoteNotes("");
    setQuoteError(null);
    setQuoteInvoice(null);
    setQuoteSent(false); setQuoteApprovalRequested(false);
    setQuoteSending(false);
    setQuotePdfFullscreen(false);
    setCatalogQuery("");
    setCatalogResults([]);
    setShowCatalogResults(false);
    setQuotePdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setShowQuoteModal(true);
  };

  const closeQuoteModal = () => {
    setShowQuoteModal(false);
    setQuotePdfFullscreen(false);
    setQuotePdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const addQuoteItem = () =>
    setQuoteItems((prev) => [...prev, { desc: "", cantidad: 1, precio: "", itbis: false }]);

  const removeQuoteItem = (idx: number) =>
    setQuoteItems((prev) => prev.filter((_, i) => i !== idx));

  const updateQuoteItem = (idx: number, field: keyof QuoteItemForm, value: string | number | boolean) =>
    setQuoteItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );

  const handlePickCatalogItem = (svc: ServiceCatalogItem) => {
    const price = catalogUnitPrice(svc) ?? 0;
    setQuoteItems((prev) => {
      const last = prev[prev.length - 1];
      // Fill the last row if it is still empty; otherwise append a new line
      if (last && !last.desc.trim() && !(Number(last.precio) > 0)) {
        return prev.map((it, i) =>
          i === prev.length - 1 ? { ...it, desc: svc.name, precio: price } : it,
        );
      }
      return [...prev, { desc: svc.name, cantidad: 1, precio: price, itbis: false }];
    });
    setCatalogQuery("");
    setCatalogResults([]);
    setShowCatalogResults(false);
  };

  const quoteTotals = (() => {
    const subtotal = quoteItems.reduce(
      (sum, it) => sum + (Number(it.cantidad) || 0) * (Number(it.precio) || 0),
      0,
    );
    const itbis = quoteItems.reduce(
      (sum, it) =>
        it.itbis ? sum + (Number(it.cantidad) || 0) * (Number(it.precio) || 0) * 0.18 : sum,
      0,
    );
    return { subtotal, itbis, total: subtotal + itbis };
  })();

  const handleGenerateQuote = async () => {
    if (!selectedPhone || quoteGenerating) return;
    const validItems = quoteItems.filter(
      (it) => it.desc.trim() && (Number(it.precio) || 0) > 0,
    );
    if (validItems.length === 0) {
      setQuoteError("Agrega al menos un artículo con descripción y precio.");
      return;
    }
    setQuoteGenerating(true);
    setQuoteError(null);
    setQuoteSent(false); setQuoteApprovalRequested(false);
    try {
      const waName = selectedConv?.client_name;
      const clientName =
        waName && !looksLikeNumericCode(waName) ? waName : formatPhone(selectedPhone);
      const createRes = await botAPI.createInvoice({
        type: quoteType,
        clientId: selectedConv?.client_id ?? undefined,
        clientName,
        clientPhone: selectedPhone,
        items: validItems.map((it) => ({
          desc: it.desc.trim(),
          cantidad: Number(it.cantidad) || 1,
          precio: Number(it.precio) || 0,
          itbis: !!it.itbis,
        })),
        notes: quoteNotes.trim() || undefined,
      });
      const invoice = createRes.data.invoice;
      // Employees don't see the document until the admin approves it: it goes straight to approval
      if (!isAdmin) {
        const approval = await botAPI.requestInvoiceApproval(invoice.id);
        setQuoteInvoice(approval.data.invoice ?? { ...invoice, status: "pending_approval" });
        setQuoteApprovalRequested(true);
        return;
      }
      // Generate the PDF (preview only — nothing is sent automatically)
      await botAPI.generateInvoicePdf(invoice.id);
      const blobUrl = await fetchAuthenticatedFile(botAPI.getInvoicePdfUrl(invoice.id));
      setQuotePdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return blobUrl;
      });
      setQuoteInvoice(invoice);
    } catch (err: any) {
      setQuoteError(
        err?.response?.data?.error || "Error al generar el documento. Inténtalo de nuevo.",
      );
    } finally {
      setQuoteGenerating(false);
    }
  };

  // Employees can't send straight to the client: the quote goes to the admin first
  const handleRequestQuoteApproval = async () => {
    if (!quoteInvoice || quoteSending || quoteApprovalRequested) return;
    setQuoteSending(true);
    setQuoteError(null);
    try {
      await botAPI.requestInvoiceApproval(quoteInvoice.id);
      setQuoteApprovalRequested(true);
    } catch (err: any) {
      setQuoteError(err?.response?.data?.error || "No se pudo enviar al admin. Inténtalo de nuevo.");
    } finally {
      setQuoteSending(false);
    }
  };

  const handleSendQuoteWhatsapp = async () => {
    if (!quoteInvoice || quoteSending || quoteSent) return;
    setQuoteSending(true);
    setQuoteError(null);
    try {
      await botAPI.sendInvoiceWhatsapp(quoteInvoice.id);
      setQuoteSent(true);
    } catch (err: any) {
      setQuoteError(
        err?.response?.data?.error ||
          "No se pudo enviar por WhatsApp. Verifica que el bot esté conectado.",
      );
    } finally {
      setQuoteSending(false);
    }
  };

  // Fetch WhatsApp profile picture on demand if missing
  useEffect(() => {
    if (!selectedPhone || !selectedConv || selectedConv.profile_pic_url) return;

    let cancelled = false;
    botAPI.getProfilePic(selectedPhone)
      .then((res) => {
        const url = (res.data as { url?: string | null }).url;
        if (url && !cancelled) {
          setConversations((prev) =>
            prev.map((c) =>
              c.phone === selectedPhone ? { ...c, profile_pic_url: url } : c
            )
          );
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [selectedPhone, selectedConv]);

  // ── Group messages by date ─────────────────────────────────────────────────

  const messageGroups: { date: string; msgs: MsgRow[] }[] = [];
  messages.forEach((m) => {
    const label = getDateLabel(m.created_at);
    const last = messageGroups[messageGroups.length - 1];
    if (!last || last.date !== label) {
      messageGroups.push({ date: label, msgs: [m] });
    } else {
      last.msgs.push(m);
    }
  });

  // Calculate stats
  // Chat tools: cotización, media, buscar
  const chatTools = [
    { label: "Generar cotización", icon: <Receipt size={16} />, onClick: openQuoteModal, active: false },
    { label: "Ver media del chat", icon: <ImageIcon size={16} />, onClick: openMediaModal, active: false },
    {
      label: "Buscar en mensajes",
      icon: <Search size={16} />,
      active: showMsgSearch,
      onClick: () => {
        setShowMsgSearch(!showMsgSearch);
        if (showMsgSearch) {
          setMsgSearch("");
          setMessageSearchMatches([]);
          setHighlightMessageId(null);
        }
      },
    },
  ].map((t) => (
    <button
      key={t.label}
      type="button"
      onClick={t.onClick}
      title={t.label}
      aria-label={t.label}
      className={`flex h-8 w-8 items-center justify-center rounded-base border-2 border-border shadow-button transition-colors md:h-9 md:w-9 ${
        t.active ? "bg-main text-main-foreground" : "bg-background text-foreground hover:bg-main/15"
      }`}
    >
      {t.icon}
    </button>
  ));

  const totalConversations = conversations.length;
  // Sum message_count from all conversations
  const totalMessages = conversations.reduce((sum, conv) => {
    const count = parseInt(conv.message_count || "0", 10);
    return sum + count;
  }, 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="-m-3 md:-m-8 flex overflow-hidden"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/*
       * Escape DashboardLayout's padding (p-3 md:p-8) so the 2-panel layout
       * can fill the full available height below the top bar (h-16 / h-20).
       */}
      {/* ════════════════════════════════════════════════════════════
          LEFT PANEL — Conversation List (320 px on desktop)
      ════════════════════════════════════════════════════════════ */}
      <div
        className={`flex flex-col border-r-2 border-border bg-background ${
          showRightPanel ? "hidden md:flex" : "flex"
        } w-full flex-shrink-0 md:w-80`}
      >
        {/* Header: title, search, folded filters, tabs with counts */}
        <div className="flex-shrink-0 border-b-2 border-border bg-secondary-background px-3 pb-2 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-2xl font-black text-foreground">Mensajes</h2>
            <span className="text-xs font-semibold tabular-nums text-foreground/60">
              {totalConversations} chats · {totalMessages} mensajes
            </span>
          </div>

          <div className="relative mt-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
            <input
              type="text"
              placeholder={search.trim().length >= 2 ? "Buscando en mensajes..." : "Buscar nombre, número o palabra…"}
              aria-label="Buscar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-base border-2 border-border bg-background py-2 pl-9 font-base text-sm text-foreground outline-none focus:border-main ${
                search.trim().length >= 2 ? "pr-24" : "pr-3"
              }`}
            />
            {search.trim().length >= 2 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-base text-[10px] font-black text-main">
                EN MENSAJES
              </span>
            )}
          </div>

          {/* Advanced filters, folded by default */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className={`inline-flex items-center gap-1.5 rounded-base border-2 border-border px-2.5 py-1 text-xs font-bold ${
                showFilters || activeFilters.length ? "bg-main text-main-foreground" : "bg-background"
              }`}
            >
              <SlidersHorizontal size={14} />
              {activeFilters.length ? `Filtros · ${activeFilters.length}` : "Filtros"}
            </button>
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.clear}
                aria-label={`Quitar filtro: ${f.label}`}
                className="inline-flex max-w-[11rem] items-center gap-1 rounded-full border-2 border-border bg-background px-2 py-0.5 text-xs font-semibold"
              >
                <span className="truncate">{f.label}</span>
                <X size={12} className="shrink-0" />
              </button>
            ))}
            {activeFilters.length > 1 && (
              <button type="button" onClick={clearFilters} className="text-xs font-semibold underline">
                Limpiar
              </button>
            )}
          </div>
          {showFilters && (
            <div className="mt-2 space-y-2 rounded-base border-2 border-border bg-background p-2.5">
              <label className="block font-base text-xs font-semibold text-foreground/70">
                Contacto
                <select
                  value={contactFilter}
                  onChange={(e) => setContactFilter(e.target.value as typeof contactFilter)}
                  className="mt-1 w-full rounded-base border-2 border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-main"
                >
                  <option value="all">Todos</option>
                  <option value="clients">Clientes registrados</option>
                  <option value="non_clients">Sin cliente</option>
                </select>
              </label>
              {isAdmin && (
                <label className="block font-base text-xs font-semibold text-foreground/70">
                  Asignado a
                  <select
                    value={assignedFilter}
                    onChange={(e) => setAssignedFilter(e.target.value)}
                    className="mt-1 w-full rounded-base border-2 border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-main"
                  >
                    <option value="ALL">Todos</option>
                    <option value="none">Sin asignar</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {/* Tabs with counts */}
          <div role="tablist" aria-label="Estado del bot" className="custom-scroll -mx-3 mt-2 flex gap-1 overflow-x-auto px-3 pb-1">
            {(
              [
                ["all", "Todos"],
                ["ai", "Bot"],
                ["manual", "Manual"],
              ] as const
            ).map(([val, label]) => {
              const active = filter === val;
              return (
                <button
                  key={val}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(val)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-base border-2 px-2 py-1 text-xs font-bold ${
                    active ? "border-border bg-main text-main-foreground shadow-button" : "border-transparent hover:border-border"
                  }`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-main-foreground/15" : "bg-foreground/10"}`}>
                    {tabCounts[val]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation list */}
        <div className="custom-scroll flex-1 overflow-y-auto">
          {convLoading ? (
            <div className="flex items-center justify-center py-16 text-foreground/50">
              <RefreshCw size={20} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-foreground/50">
              <MessageSquare
                size={32}
                className="mx-auto mb-2 opacity-40"
              />
              <p className="font-base text-base">
                {conversations.length ? "Ningún chat con estos filtros" : "Sin conversaciones"}
              </p>
            </div>
          ) : (
            <ul className="divide-y-2 divide-border/15">
              {filtered.map((conv) => (
                <ConvItem
                  key={conv.phone}
                  conv={conv}
                  isSelected={selectedPhone === conv.phone}
                  onSelect={() => selectConversation(conv.phone, conv.firstMatchId)}
                  onToggleAI={handleToggleAI}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          RIGHT PANEL — Chat Area
      ════════════════════════════════════════════════════════════ */}
      <div
        className={`flex flex-1 flex-col overflow-hidden bg-secondary-background ${
          !showRightPanel ? "hidden md:flex" : "flex"
        }`}
      >
        {/* ── Empty state ── */}
        {!selectedPhone ? (
          <div className="flex flex-1 flex-col items-center justify-center text-foreground/50">
            <MessageSquare size={52} className="mb-4 opacity-40" />
            <p className="font-heading text-xl font-semibold text-foreground/70 md:text-2xl">
              Selecciona una conversación
            </p>
            <p className="mt-1 font-base text-base">
              Los mensajes aparecerán aquí
            </p>
          </div>
        ) : (
          <>
            {/* ── Top bar: who + tools, then the bot and assignment strip ── */}
            <div className="flex-shrink-0 border-b-2 border-border bg-secondary-background">
              <div className="flex items-center gap-2 px-3 pt-2.5 md:gap-3 md:px-4">
                {/* Back (mobile only) */}
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-base border-2 border-border bg-background md:hidden"
                  onClick={() => {
                    setShowRightPanel(false);
                    setSelectedPhone(null);
                  }}
                  aria-label="Volver a la lista"
                >
                  <ChevronLeft size={18} />
                </button>

                <Avatar
                  url={selectedConv?.profile_pic_url}
                  name={selectedConv?.client_name}
                  phone={selectedPhone}
                  size="sm"
                  className="shrink-0 md:h-10 md:w-10"
                />

                {/* Name + phone: opens the client's info */}
                <button
                  type="button"
                  onClick={() => setShowClientPanel(true)}
                  className="group min-w-0 flex-1 text-left"
                  title="Ver información del cliente"
                >
                  <h3 className="flex items-center gap-1.5 font-base text-base font-bold text-foreground">
                    <span className="truncate group-hover:text-main group-hover:underline">
                      {selectedConv?.client_name || formatPhone(selectedPhone)}
                    </span>
                    <Info size={14} className="shrink-0 text-foreground/50" />
                  </h3>
                  <p className="truncate font-base text-xs tabular-nums text-foreground/60">{formatPhone(selectedPhone)}</p>
                </button>

                {/* Tools (on phones they go in the strip below, so the name fits) */}
                <div className="hidden shrink-0 items-center gap-1.5 md:flex">{chatTools}</div>
              </div>

              {/* Bot + assignment strip */}
              <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5 pt-2 md:px-4">
                <button
                  type="button"
                  onClick={(e) => handleToggleAI(selectedPhone, e)}
                  aria-label={selectedConv?.botActive ? "Bot activo en este chat: pasar a manual" : "Manual: activar bot en este chat"}
                  className={`inline-flex items-center gap-1.5 rounded-full border-2 border-border px-2.5 py-0.5 text-xs font-bold transition-colors ${
                    selectedConv?.botActive ? "bg-main text-main-foreground" : "bg-background text-foreground/70 hover:bg-main/15"
                  }`}
                >
                  {selectedConv?.botActive ? <Bot size={13} /> : <User size={13} />}
                  {selectedConv?.botActive ? (
                    <>
                      Bot<span className="hidden sm:inline"> respondiendo</span>
                    </>
                  ) : (
                    "Manual"
                  )}
                </button>
                {globalBotActive === false && (
                  <span className="rounded-full border-2 border-red-600 px-2 py-0.5 text-[11px] font-bold text-red-600">
                    Bot pausado
                  </span>
                )}

                {!isAdmin && selectedConv?.client_assigned_to != null && (
                  <UserBadge userId={selectedConv.client_assigned_to} size="sm" />
                )}

                {/* Assignment (admin only) */}
                {isAdmin && (
                  <label className="relative flex items-center gap-1.5 text-xs font-semibold text-foreground/70 md:ml-auto">
                    <UserCheck size={14} className="hidden shrink-0 sm:block" />
                    <span className="hidden sm:inline">Asignado a</span>
                    <select
                      disabled={assigning}
                      value={selectedConv?.client_assigned_to ?? ""}
                      onChange={(e) => handleAssign(e.target.value)}
                      className="h-7 max-w-[100px] truncate rounded-base sm:max-w-[140px] border-2 border-border bg-background px-1.5 text-xs font-semibold text-foreground focus:outline-none disabled:opacity-50"
                      title="Asignar chat a digitador"
                      aria-label="Asignar chat a"
                    >
                      <option value="">Sin asignar</option>
                      {assignableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.username}
                        </option>
                      ))}
                    </select>
                    {assignMsg && (
                      <span className="absolute -bottom-5 right-0 whitespace-nowrap text-[10px] font-semibold text-main">
                        {assignMsg}
                      </span>
                    )}
                  </label>
                )}
                <div className="ml-auto flex items-center gap-1.5 md:hidden">{chatTools}</div>
              </div>
            </div>

            {/* Message search bar */}
            {showMsgSearch && (
              <div className="flex flex-shrink-0 items-center gap-2 border-b-2 border-border bg-secondary-background px-4 py-2">
                <Search size={16} className="flex-shrink-0 text-foreground/50" />
                <NeoInput
                  type="text"
                  value={msgSearch}
                  onChange={(e) => setMsgSearch(e.target.value)}
                  placeholder="Buscar en mensajes..."
                  autoFocus
                  className="flex-1"
                />
                {messageSearchMatches.length > 0 && (
                  <span className="flex-shrink-0 font-base text-xs text-foreground/60">
                    {currentMatchIndex + 1}/{messageSearchMatches.length}
                  </span>
                )}
                <NeoButton
                  onClick={() => {
                    setShowMsgSearch(false);
                    setMsgSearch("");
                    setMessageSearchMatches([]);
                    setHighlightMessageId(null);
                  }}
                  variant="ghost"
                  size="icon"
                >
                  ✕
                </NeoButton>
              </div>
            )}

            {/* ── Messages area ── */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScrollContainer}
              className="custom-scroll flex-1 overflow-y-auto px-3 py-3 md:px-5"
            >
              {msgLoading ? (
                <div className="flex items-center justify-center py-16 text-foreground/50">
                  <RefreshCw size={20} className="animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <p className="font-base text-base text-foreground/50">Sin mensajes aún</p>
                </div>
              ) : (
                messageGroups.map((group) => (
                  <div key={group.date}>
                    <DateSeparator label={group.date} />
                    {group.msgs.map((msg) => (
                      <MessageBubble key={msg.id} msg={msg} isHighlighted={msg.id === highlightMessageId} />
                    ))}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Input bar ── */}
            <div className="flex flex-shrink-0 flex-col border-t-2 border-border bg-secondary-background">
              {/* Attach preview */}
              {attachFile && (
                <div className="flex items-center gap-3 border-b-2 border-border px-4 py-2">
                  {attachPreview ? (
                    <img src={attachPreview} alt="preview" className="h-14 w-14 rounded-base border-2 border-border object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-base border-2 border-border bg-background">
                      <FileText size={22} className="text-foreground/50" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-base text-xs font-semibold text-foreground">{attachFile.name}</p>
                    <NeoInput
                      type="text"
                      value={attachCaption}
                      onChange={(e) => setAttachCaption(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendMedia(); }}
                      placeholder="Descripción (opcional)..."
                      className="mt-1 text-sm"
                    />
                  </div>
                  <NeoButton onClick={handleSendMedia} disabled={sendingMedia} size="icon" className="h-9 w-9 flex-shrink-0" title="Enviar archivo">
                    {sendingMedia ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  </NeoButton>
                  <NeoButton onClick={cancelAttach} variant="neutral" size="icon" className="h-9 w-9 flex-shrink-0" title="Cancelar">
                    <X size={16} />
                  </NeoButton>
                </div>
              )}
              {/* right padding: the owl advisor floats over the bottom-right corner */}
              <div className="flex items-center gap-2 py-2.5 pl-3 pr-14 md:pl-4 md:pr-24">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={handleAttachSelect}
                />
                <NeoButton
                  onClick={() => fileInputRef.current?.click()}
                  variant="neutral"
                  size="icon"
                  className="h-11 w-11 flex-shrink-0 md:h-9 md:w-9"
                  title="Adjuntar archivo"
                >
                  <Paperclip size={18} />
                </NeoButton>
                <NeoInput
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 text-base md:text-sm"
                />
                <NeoButton
                  onClick={handleSend}
                  disabled={!inputText.trim() || sending}
                  size="icon"
                  className="h-11 w-11 md:h-9 md:w-9"
                >
                  {sending ? (
                    <RefreshCw size={18} className="animate-spin md:size-4" />
                  ) : (
                    <Send size={18} />
                  )}
                </NeoButton>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          CLIENT DETAIL PANEL — slide-over from the right
      ════════════════════════════════════════════════════════════ */}
      {showClientPanel && selectedPhone && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-10 bg-black/40"
            onClick={() => setShowClientPanel(false)}
          />
          <div className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l-2 border-border bg-background shadow-xl md:w-96">
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b-2 border-border bg-secondary-background px-4 py-3">
              <div className="flex items-center gap-2">
                <Avatar
                  url={selectedConv?.profile_pic_url}
                  name={selectedConv?.client_name}
                  phone={selectedPhone}
                  size="md"
                />
                <div className="min-w-0">
                  <p className="truncate font-base text-base font-semibold text-foreground">
                    {selectedConv?.client_name || formatPhone(selectedPhone)}
                  </p>
                  <p className="truncate font-base text-xs text-foreground/60">
                    {formatPhone(selectedPhone)}
                  </p>
                </div>
              </div>
              <NeoButton
                size="icon"
                variant="neutral"
                onClick={() => setShowClientPanel(false)}
                title="Cerrar panel"
              >
                <X size={18} />
              </NeoButton>
            </div>

          {/* Content */}
          <div className="custom-scroll flex-1 overflow-y-auto px-3 py-3 md:px-5">
            {!selectedConv?.client_id ? (
              <div className="space-y-4">
                {/* Chat identity */}
                <NeoCard variant="neutral" className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      url={selectedConv?.profile_pic_url}
                      name={selectedConv?.client_name}
                      phone={selectedPhone}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-base text-sm font-semibold text-foreground">
                        {selectedConv?.client_name && !looksLikeNumericCode(selectedConv.client_name)
                          ? selectedConv.client_name
                          : "Sin nombre de WhatsApp"}
                      </p>
                      <p className="truncate font-base text-xs text-foreground/60">
                        {formatPhone(selectedPhone)}
                      </p>
                    </div>
                  </div>
                </NeoCard>

                {/* View chat media (works even without a client record — by phone) */}
                <NeoButton onClick={openMediaModal} variant="neutral" size="sm" className="w-full">
                  <ImageIcon size={14} />
                  Ver media del chat
                </NeoButton>

                {/* Add contact form */}
                <NeoCard variant="neutral" className="p-3">
                  <h3 className="mb-1 font-base text-sm font-black uppercase tracking-wide text-foreground/70">
                    Agregar contacto
                  </h3>
                  <p className="mb-3 font-base text-xs text-foreground/60">
                    Este chat aún no tiene ficha de cliente. Completa los datos para crearla y
                    vincular los mensajes automáticamente.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block font-base text-xs font-semibold text-foreground/80">
                        Nombre *
                      </label>
                      <NeoInput
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="h-10 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-base text-xs font-semibold text-foreground/80">
                        Teléfono *
                      </label>
                      <NeoInput
                        type="text"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="Ej: 18095551234"
                        className="h-10 text-sm"
                      />
                    </div>
                    {contactMsg && (
                      <p
                        className={`font-base text-sm font-semibold ${
                          contactMsg.type === "ok" ? "text-main" : "text-red-600"
                        }`}
                      >
                        {contactMsg.text}
                      </p>
                    )}
                    <NeoButton
                      onClick={handleAddContact}
                      disabled={contactSaving}
                      size="sm"
                      className="w-full"
                    >
                      {contactSaving ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <UserPlus size={14} />
                      )}
                      {contactSaving ? "Guardando..." : "Agregar contacto"}
                    </NeoButton>
                  </div>
                </NeoCard>

                {/* Link @lid to a real phone number */}
                {isLidChat && (
                  <NeoCard variant="neutral" className="p-3">
                    <h3 className="mb-1 font-base text-sm font-black uppercase tracking-wide text-foreground/70">
                      Vincular número real
                    </h3>
                    <p className="mb-3 font-base text-xs text-foreground/60">
                      Este contacto usa un ID de privacidad de WhatsApp. Si conoces su número
                      real, vincúlalo para unificar la conversación bajo ese número.
                    </p>
                    <div className="space-y-3">
                      <NeoInput
                        type="text"
                        value={linkPhone}
                        onChange={(e) => setLinkPhone(e.target.value)}
                        placeholder="Ej: 18095551234"
                        className="h-10 text-sm"
                      />
                      {linkMsg && (
                        <p className={`font-base text-sm font-semibold ${linkMsg.type === "ok" ? "text-main" : "text-red-600"}`}>
                          {linkMsg.text}
                        </p>
                      )}
                      <NeoButton onClick={handleLinkLid} disabled={linking} size="sm" className="w-full">
                        {linking ? <RefreshCw size={14} className="animate-spin" /> : <Phone size={14} />}
                        {linking ? "Vinculando..." : "Vincular número"}
                      </NeoButton>
                    </div>
                  </NeoCard>
                )}
              </div>
            ) : clientDetailLoading ? (
              <div className="flex items-center justify-center py-16 text-foreground/50">
                <RefreshCw size={24} className="animate-spin" />
              </div>
            ) : !clientDetail ? (
              <div className="py-12 text-center text-foreground/50">
                <p className="font-base text-base">No se pudo cargar la información</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* General info */}
                <NeoCard variant="neutral" className="p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="font-base text-sm font-black uppercase tracking-wide text-foreground/70">
                      Información general
                    </h3>
                    <div className="flex items-center gap-1">
                      <NeoButton size="icon" variant="neutral" className="h-7 w-7" onClick={openEditClient} title="Editar contacto">
                        <Pencil size={13} />
                      </NeoButton>
                      <NeoButton size="icon" variant="neutral" className="h-7 w-7" onClick={openMediaModal} title="Ver media del chat">
                        <ImageIcon size={13} />
                      </NeoButton>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {clientDetail.client.name && (
                      <div className="flex items-start gap-2">
                        <User size={14} className="mt-0.5 text-foreground/50" />
                        <span className="font-base text-sm">{clientDetail.client.name}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <Phone size={14} className="mt-0.5 text-foreground/50" />
                      <span className="font-base text-sm">{formatPhone(clientDetail.client.phone)}</span>
                    </div>
                    {clientDetail.client.email && (
                      <div className="flex items-start gap-2">
                        <Mail size={14} className="mt-0.5 text-foreground/50" />
                        <span className="font-base text-sm">{clientDetail.client.email}</span>
                      </div>
                    )}
                    {clientDetail.client.address && (
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="mt-0.5 text-foreground/50" />
                        <span className="font-base text-sm">{clientDetail.client.address}</span>
                      </div>
                    )}
                    {clientDetail.client.notes && (
                      <div className="mt-2 rounded-base border-2 border-border bg-background p-2">
                        <p className="font-base text-xs font-semibold text-foreground/70">Notas</p>
                        <p className="font-base text-sm">{clientDetail.client.notes}</p>
                      </div>
                    )}
                  </div>
                </NeoCard>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <NeoCard variant="neutral" className="p-2.5">
                    <div className="flex items-center gap-1.5 font-base text-xs text-foreground/70">
                      <Briefcase size={12} />
                      Casos
                    </div>
                    <p className="mt-1 font-heading text-xl font-bold">{clientDetail.stats.totalCases}</p>
                  </NeoCard>
                  <NeoCard variant="neutral" className="p-2.5">
                    <div className="flex items-center gap-1.5 font-base text-xs text-foreground/70">
                      <Package size={12} />
                      Servicios
                    </div>
                    <p className="mt-1 font-heading text-xl font-bold">{clientDetail.stats.totalServices}</p>
                  </NeoCard>
                  <NeoCard variant="neutral" className="p-2.5">
                    <div className="flex items-center gap-1.5 font-base text-xs text-foreground/70">
                      <FileText size={12} />
                      Documentos
                    </div>
                    <p className="mt-1 font-heading text-xl font-bold">{clientDetail.stats.totalDocuments}</p>
                  </NeoCard>
                  <NeoCard variant="neutral" className="p-2.5">
                    <div className="flex items-center gap-1.5 font-base text-xs text-foreground/70">
                      <MessageCircle size={12} />
                      Mensajes
                    </div>
                    <p className="mt-1 font-heading text-xl font-bold">{clientDetail.stats.totalMessages}</p>
                  </NeoCard>
                </div>

                {/* Cases */}
                {clientDetail.cases.length > 0 && (
                  <NeoCard variant="neutral" className="p-3">
                    <h3 className="mb-2 font-base text-sm font-black uppercase tracking-wide text-foreground/70">
                      Casos activos
                    </h3>
                    <div className="space-y-2">
                      {clientDetail.cases.map((c) => (
                        <div key={c.id} className="rounded-base border-2 border-border bg-background p-2">
                          <p className="font-base text-sm font-semibold">{c.case_number || `#${c.id}`}</p>
                          <p className="font-base text-xs text-foreground/70">{c.title}</p>
                          <p className="mt-1 font-base text-xs uppercase text-main">{c.status}</p>
                        </div>
                      ))}
                    </div>
                  </NeoCard>
                )}

                {/* Services */}
                {clientDetail.services.length > 0 && (
                  <NeoCard variant="neutral" className="p-3">
                    <h3 className="mb-2 font-base text-sm font-black uppercase tracking-wide text-foreground/70">
                      Servicios
                    </h3>
                    <div className="space-y-2">
                      {clientDetail.services.map((s) => (
                        <div key={s.id} className="rounded-base border-2 border-border bg-background p-2">
                          <p className="font-base text-sm font-semibold">{s.name}</p>
                          <p className="font-base text-xs text-foreground/70">{s.abbreviation} · {s.category_type}</p>
                          <p className="mt-1 font-base text-xs uppercase" style={{ color: s.color }}>{s.status}</p>
                        </div>
                      ))}
                    </div>
                  </NeoCard>
                )}

                {/* Documents */}
                {clientDetail.documents.length > 0 && (
                  <NeoCard variant="neutral" className="p-3">
                    <h3 className="mb-2 font-base text-sm font-black uppercase tracking-wide text-foreground/70">
                      Documentos
                    </h3>
                    <div className="space-y-2">
                      {clientDetail.documents.map((d) => (
                        <div key={d.id} className="rounded-base border-2 border-border bg-background p-2">
                          <p className="font-base text-sm font-semibold">{d.doc_type}</p>
                          {d.file_name && <p className="font-base text-xs text-foreground/70">{d.file_name}</p>}
                          <p className="mt-1 font-base text-xs uppercase text-foreground/60">{d.status}</p>
                        </div>
                      ))}
                    </div>
                  </NeoCard>
                )}

                {/* Appointments */}
                {clientDetail.appointments.length > 0 && (
                  <NeoCard variant="neutral" className="p-3">
                    <h3 className="mb-2 font-base text-sm font-black uppercase tracking-wide text-foreground/70">
                      Citas
                    </h3>
                    <div className="space-y-2">
                      {clientDetail.appointments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 rounded-base border-2 border-border bg-background p-2">
                          <Calendar size={14} className="text-foreground/50" />
                          <div>
                            <p className="font-base text-sm font-semibold">{a.type}</p>
                            <p className="font-base text-xs text-foreground/70">{a.date} · {a.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </NeoCard>
                )}
              </div>
            )}
          </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          QUOTE / INVOICE MODAL — generate PDF preview, send via WhatsApp
      ════════════════════════════════════════════════════════════ */}
      {showQuoteModal && selectedPhone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeQuoteModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-base border-2 border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b-2 border-border bg-secondary-background px-4 py-3">
              <h3 className="flex items-center gap-2 font-heading text-lg font-black">
                <Receipt size={18} />
                {quoteInvoice
                  ? `${quoteType === "FACTURA" ? "Factura" : "Cotización"} generada`
                  : "Generar cotización"}
              </h3>
              <button
                onClick={closeQuoteModal}
                className="rounded-base border-2 border-border bg-secondary-background p-1.5 text-foreground hover:bg-main hover:text-main-foreground"
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="custom-scroll flex-1 overflow-y-auto p-4">
              {!quoteInvoice ? (
                <>
                  {/* Type selector */}
                  <div className="mb-4 flex gap-2">
                    <NeoButton
                      type="button"
                      variant={quoteType === "COTIZACIÓN" ? "default" : "neutral"}
                      className="flex-1"
                      onClick={() => setQuoteType("COTIZACIÓN")}
                    >
                      Cotización
                    </NeoButton>
                    <NeoButton
                      type="button"
                      variant={quoteType === "FACTURA" ? "default" : "neutral"}
                      className="flex-1"
                      onClick={() => setQuoteType("FACTURA")}
                    >
                      Factura
                    </NeoButton>
                  </div>

                  {/* Client (from chat) */}
                  <div className="mb-4 rounded-base border-2 border-border bg-secondary-background p-2.5">
                    <p className="font-base text-xs font-semibold text-foreground/60">Cliente</p>
                    <p className="truncate font-base text-sm font-semibold text-foreground">
                      {selectedConv?.client_name && !looksLikeNumericCode(selectedConv.client_name)
                        ? selectedConv.client_name
                        : formatPhone(selectedPhone)}
                      {selectedConv?.client_id ? " · registrado" : " · sin ficha"}
                    </p>
                  </div>

                  {/* Catalog search */}
                  <div className="relative mb-4">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50"
                    />
                    <NeoInput
                      type="text"
                      value={catalogQuery}
                      onChange={(e) => {
                        setCatalogQuery(e.target.value);
                        setShowCatalogResults(true);
                      }}
                      onFocus={() => setShowCatalogResults(true)}
                      placeholder="Buscar servicio en el catálogo..."
                      className="h-10 pl-9 pr-8 text-sm"
                    />
                    {catalogSearching && (
                      <RefreshCw
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-foreground/50"
                      />
                    )}
                    {showCatalogResults && catalogResults.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-base border-2 border-border bg-background shadow-button">
                        {catalogResults.map((svc, i) => (
                          <button
                            key={svc.id ?? i}
                            type="button"
                            onClick={() => handlePickCatalogItem(svc)}
                            className="flex w-full items-center justify-between gap-2 border-b-2 border-border/40 px-3 py-2 text-left last:border-b-0 hover:bg-secondary-background"
                          >
                            <span className="truncate font-base text-sm text-foreground">
                              {svc.name}
                            </span>
                            <span className="flex-shrink-0 font-base text-xs font-semibold text-foreground/60">
                              {(catalogUnitPrice(svc) ?? 0) > 0
                                ? formatCurrency(catalogUnitPrice(svc) as number)
                                : "—"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div className="mb-4">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="font-base text-sm font-semibold text-foreground/80">
                        Artículos *
                      </label>
                      <NeoButton type="button" size="sm" variant="neutral" onClick={addQuoteItem}>
                        <Plus size={14} />
                        Agregar
                      </NeoButton>
                    </div>
                    <div className="space-y-2">
                      {quoteItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-base border-2 border-border bg-secondary-background p-2"
                        >
                          <NeoInput
                            type="text"
                            value={item.desc}
                            onChange={(e) => updateQuoteItem(idx, "desc", e.target.value)}
                            placeholder="Descripción"
                            className="mb-2 h-9 text-sm"
                          />
                          <div className="flex items-center gap-2">
                            <NeoInput
                              type="number"
                              min={1}
                              step="1"
                              onKeyDown={preventDecimalInput}
                              value={item.cantidad}
                              onChange={(e) => updateQuoteItem(idx, "cantidad", e.target.value)}
                              placeholder="Cant."
                              className="h-9 w-20 px-2 text-sm"
                            />
                            <NeoInput
                              type="number"
                              min={0}
                              step="1"
                              onKeyDown={preventDecimalInput}
                              value={item.precio}
                              onChange={(e) => updateQuoteItem(idx, "precio", e.target.value)}
                              placeholder="Precio"
                              className="h-9 flex-1 px-2 text-sm"
                            />
                            <label className="flex items-center gap-1 whitespace-nowrap font-base text-xs font-semibold">
                              <input
                                type="checkbox"
                                checked={item.itbis}
                                onChange={(e) => updateQuoteItem(idx, "itbis", e.target.checked)}
                                className="h-4 w-4 accent-main"
                              />
                              ITBIS
                            </label>
                            {quoteItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeQuoteItem(idx)}
                                className="rounded-base p-1.5 text-red-500 hover:bg-red-500/10"
                                title="Quitar línea"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mb-4">
                    <label className="mb-1 block font-base text-sm font-semibold text-foreground/80">
                      Notas
                    </label>
                    <textarea
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                      placeholder="Condiciones de pago, detalles adicionales..."
                      rows={2}
                      className="w-full resize-none rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
                    />
                  </div>

                  {/* Live totals */}
                  <NeoCard variant="main" className="mb-4 p-3">
                    <div className="flex items-center justify-between text-sm text-main-foreground/80">
                      <span>Subtotal</span>
                      <span>{formatCurrency(quoteTotals.subtotal)}</span>
                    </div>
                    {quoteTotals.itbis > 0 && (
                      <div className="flex items-center justify-between text-sm text-main-foreground/80">
                        <span>ITBIS (18%)</span>
                        <span>{formatCurrency(quoteTotals.itbis)}</span>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between border-t-2 border-main-foreground/30 pt-2">
                      <span className="font-base text-sm font-black uppercase">Total</span>
                      <span className="font-heading text-xl font-bold text-main-foreground">
                        {formatCurrency(quoteTotals.total)}
                      </span>
                    </div>
                  </NeoCard>
                </>
              ) : (
                <>
                  {/* Generated document summary */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-base text-sm font-black uppercase text-foreground">
                        {quoteInvoice.doc_number || `Documento #${quoteInvoice.id}`}
                      </p>
                      <p className="font-base text-xs text-foreground/60">
                        {quoteType} · Total {formatCurrency(Number(quoteInvoice.total) || quoteTotals.total)}
                      </p>
                    </div>
                    {isAdmin && (
                      <NeoButton
                        type="button"
                        size="sm"
                        variant="neutral"
                        onClick={() => {
                          setQuoteInvoice(null);
                          setQuoteSent(false); setQuoteApprovalRequested(false);
                        }}
                      >
                        Volver a editar
                      </NeoButton>
                    )}
                  </div>

                  {/* PDF preview (admin only; employees see it once approved, in Cotizaciones) */}
                  {!isAdmin ? null : quotePdfUrl ? (
                    <div className="mb-3">
                      <div className="relative">
                        <iframe
                          src={quotePdfUrl}
                          title="Vista previa del documento"
                          className="h-[50vh] w-full rounded-base border-2 border-border bg-white shadow-button"
                        />
                        <button
                          onClick={() => setQuotePdfFullscreen(true)}
                          className="absolute right-2 top-2 rounded-base border-2 border-border bg-secondary-background p-1.5 text-foreground shadow-button hover:bg-main hover:text-main-foreground"
                          title="Ver en pantalla completa"
                        >
                          <Maximize2 size={14} />
                        </button>
                      </div>
                      <a
                        href={quotePdfUrl}
                        download={`${quoteInvoice.doc_number || "documento"}.pdf`}
                        className="mt-2 flex items-center justify-center gap-1 rounded-base border-2 border-border bg-secondary-background px-2 py-1.5 font-base text-xs font-black uppercase tracking-wide text-foreground hover:bg-main hover:text-main-foreground"
                      >
                        <Download size={12} />
                        Descargar PDF
                      </a>
                    </div>
                  ) : (
                    <div className="mb-3 flex items-center justify-center py-10 text-foreground/50">
                      <RefreshCw size={20} className="animate-spin" />
                    </div>
                  )}

                  {/* Sent confirmation */}
                  {quoteApprovalRequested && (
                    <p className="mb-3 rounded-base border-2 border-border bg-main px-3 py-2 font-base text-sm font-semibold text-main-foreground">
                      ✓ Enviada al admin para aprobación. Cuando la apruebe, se envía al cliente desde Cotizaciones.
                    </p>
                  )}

                  {quoteSent && (
                    <p className="mb-3 rounded-base border-2 border-border bg-main px-3 py-2 font-base text-sm font-semibold text-main-foreground">
                      ✓ {quoteType === "FACTURA" ? "Factura" : "Cotización"} enviada al cliente por
                      WhatsApp
                    </p>
                  )}
                </>
              )}

              {quoteError && (
                <p className="mb-2 font-base text-sm font-semibold text-red-600">{quoteError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t-2 border-border bg-secondary-background px-4 py-3">
              {!quoteInvoice ? (
                <>
                  <NeoButton type="button" variant="neutral" onClick={closeQuoteModal} disabled={quoteGenerating}>
                    Cancelar
                  </NeoButton>
                  <NeoButton type="button" onClick={handleGenerateQuote} disabled={quoteGenerating}>
                    {quoteGenerating ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <FileText size={16} />
                    )}
                    {quoteGenerating ? "Generando..." : isAdmin ? "Generar y previsualizar" : "Crear y pedir aprobación"}
                  </NeoButton>
                </>
              ) : (
                <>
                  <NeoButton type="button" variant="neutral" onClick={closeQuoteModal}>
                    Cerrar
                  </NeoButton>
                  {whatsappAction({ isAdmin, isOwner: true, status: quoteInvoice.status }) === "send" ? (
                    <NeoButton
                      type="button"
                      onClick={handleSendQuoteWhatsapp}
                      disabled={quoteSending || quoteSent || !quotePdfUrl}
                    >
                      {quoteSending ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      {quoteSent ? "Enviada" : quoteSending ? "Enviando..." : "Enviar por WhatsApp"}
                    </NeoButton>
                  ) : (
                    <NeoButton
                      type="button"
                      onClick={handleRequestQuoteApproval}
                      disabled={quoteSending || quoteApprovalRequested}
                    >
                      {quoteSending ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      {quoteApprovalRequested ? "Enviada al admin" : quoteSending ? "Enviando..." : "Pedir aprobación al admin"}
                    </NeoButton>
                  )}
                </>
              )}
            </div>
          </div>

          {/* PDF fullscreen overlay */}
          {quotePdfFullscreen && quotePdfUrl && (
            <div
              className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-4"
              onClick={() => setQuotePdfFullscreen(false)}
            >
              <div className="flex items-center justify-between pb-2">
                <span className="font-base text-sm font-semibold text-white">
                  {quoteInvoice.doc_number || "Documento"}
                </span>
                <button
                  onClick={() => setQuotePdfFullscreen(false)}
                  className="rounded-base border-2 border-white/30 bg-white/10 p-2 text-white hover:bg-white/20"
                >
                  <X size={18} />
                </button>
              </div>
              <iframe
                src={quotePdfUrl}
                title="Documento pantalla completa"
                className="w-full flex-1 rounded-base bg-white"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Edit client modal ── */}
      {showEditClient && clientDetail?.client && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowEditClient(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <NeoCard variant="neutral" className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold">Editar contacto</h3>
                <NeoButton size="icon" variant="neutral" onClick={() => setShowEditClient(false)} title="Cerrar">
                  <X size={16} />
                </NeoButton>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">Nombre</label>
                  <NeoInput value={editClientForm.name} onChange={(e) => setEditClientForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">Teléfono</label>
                  <NeoInput value={editClientForm.phone} onChange={(e) => setEditClientForm((f) => ({ ...f, phone: e.target.value }))} placeholder="8095551234" />
                </div>
                <div>
                  <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">Email</label>
                  <NeoInput value={editClientForm.email} onChange={(e) => setEditClientForm((f) => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com" />
                </div>
                <div>
                  <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">Dirección</label>
                  <NeoInput value={editClientForm.address} onChange={(e) => setEditClientForm((f) => ({ ...f, address: e.target.value }))} placeholder="Calle, ciudad" />
                </div>
                <div>
                  <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">Notas</label>
                  <textarea
                    value={editClientForm.notes}
                    onChange={(e) => setEditClientForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground"
                    placeholder="Notas internas"
                  />
                </div>
                {editClientMsg && (
                  <p className={`font-base text-sm font-semibold ${editClientMsg.includes("✓") ? "text-green-600" : "text-red-600"}`}>
                    {editClientMsg}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <NeoButton variant="neutral" onClick={() => setShowEditClient(false)}>Cancelar</NeoButton>
                  <NeoButton onClick={saveEditClient} disabled={savingClient}>
                    {savingClient ? "Guardando..." : "Guardar"}
                  </NeoButton>
                </div>
              </div>
            </NeoCard>
          </div>
        </div>
      )}

      {/* ── Media viewer modal ── */}
      {showMediaModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowMediaModal(false)}>
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <NeoCard variant="neutral" className="flex max-h-[80vh] flex-col p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold">Media del chat</h3>
                <NeoButton size="icon" variant="neutral" onClick={() => setShowMediaModal(false)} title="Cerrar">
                  <X size={16} />
                </NeoButton>
              </div>
              <div className="custom-scroll flex-1 overflow-y-auto">
                {clientMediaLoading ? (
                  <div className="flex items-center justify-center py-16 text-foreground/50">
                    <RefreshCw size={24} className="animate-spin" />
                  </div>
                ) : clientMediaList.length === 0 ? (
                  <div className="py-12 text-center text-foreground/50">
                    <ImageIcon size={36} className="mx-auto mb-2 opacity-40" />
                    <p className="font-base text-sm">No hay media en este chat todavía.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {clientMediaList.map((m) => <MediaGridItem key={m.id} media={m} />)}
                  </div>
                )}
              </div>
            </NeoCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotMessages;
