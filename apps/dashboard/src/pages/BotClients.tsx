import React, { useEffect, useState, useCallback } from "react";
import UserBadge from "../components/UserBadge";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  RefreshCw,
  Phone,
  MessageCircle,
  ChevronLeft,
  Mail,
  FileText,
  Briefcase,
  Image,
  Music,
  FileIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { botAPI, BotClient, ClientDetailFull, ClientMedia } from "../services/botApi";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { NeoCard, NeoButton, NeoBadge } from "@guru/ui";
import { notify } from "../lib/dialogs";
import { formatPhone } from "../lib/phone";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name?: string, phone?: string): string => {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (phone) return phone.slice(-2);
  return "??";
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatShortDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-DO", { day: "numeric", month: "short" });
};

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" });
};

// ─── Client Item ──────────────────────────────────────────────────────────────

const ClientItem: React.FC<{
  client: BotClient;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ client, isSelected, onSelect }) => {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
          isSelected ? "bg-main/15 shadow-[inset_4px_0_0_0_var(--main)]" : "hover:bg-secondary-background"
        }`}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-border bg-main text-xs font-black text-main-foreground shadow-button">
          {getInitials(client.name, client.phone)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-bold text-foreground">{client.name || "Sin nombre"}</p>
            <span className="shrink-0 text-[11px] tabular-nums text-foreground/50">
              {client.messageCount} mensajes
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-foreground/65">
            <span className="shrink-0 tabular-nums">{formatPhone(client.phone)}</span>
            {client.joinedAt && <span className="shrink-0 text-foreground/45">· desde {formatShortDate(client.joinedAt)}</span>}
          </div>
          {client.assigned_to != null && (
            <div className="mt-1">
              <UserBadge userId={client.assigned_to} />
            </div>
          )}
        </div>
      </button>
    </li>
  );
};

// ─── Tab Content Components ────────────────────────────────────────────────────

interface DashboardUser {
  id: number;
  name: string;
  role: string;
}

const InfoTab: React.FC<{
  detail: ClientDetailFull;
  onChat: () => void;
  users: DashboardUser[];
  isAdmin: boolean;
  onAssign: (userId: number | null) => void;
  assigning: boolean;
}> = ({
  detail,
  onChat,
  users,
  isAdmin,
  onAssign,
  assigning,
}) => (
  <div className="space-y-6">
    {/* Avatar + Name */}
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border bg-main text-xl font-black text-main-foreground shadow-button">
        {getInitials(detail.client.name, detail.client.phone)}
      </div>
      <div>
        <p className="font-heading text-xl font-bold text-foreground md:text-2xl">
          {detail.client.name || "Sin nombre"}
        </p>
        <p className="font-base text-base text-foreground/70">{detail.client.phone}</p>
      </div>
    </div>

    {/* Chat Button */}
    <NeoButton onClick={onChat} className="w-full">
      <MessageCircle size={18} />
      Abrir Chat
    </NeoButton>

    {/* Assignment (admin only) */}
    {isAdmin && (
      <NeoCard variant="neutral" className="space-y-3 p-4">
        <p className="font-base text-sm text-foreground/60">Asignar cliente a</p>
        <select
          disabled={assigning}
          value={detail.client.assigned_to || ""}
          onChange={(e) => onAssign(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-base text-foreground focus:outline-none focus:ring-2 focus:ring-main"
        >
          <option value="">Sin asignar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </select>
        {assigning && (
          <p className="text-center text-sm text-foreground/50">
            <RefreshCw size={14} className="mr-1 inline animate-spin" />
            Guardando...
          </p>
        )}
      </NeoCard>
    )}

    {/* Details Grid */}
    <NeoCard variant="neutral" className="space-y-4 p-4">
      {detail.client.email && (
        <div className="flex items-start gap-3">
          <Mail size={16} className="mt-0.5 flex-shrink-0 text-foreground/60" />
          <div className="min-w-0">
            <p className="font-base text-sm text-foreground/60">Email</p>
            <p className="break-all font-base text-base text-foreground">{detail.client.email}</p>
          </div>
        </div>
      )}
      {detail.client.address && (
        <div className="flex items-start gap-3">
          <Phone size={16} className="mt-0.5 flex-shrink-0 text-foreground/60" />
          <div className="min-w-0">
            <p className="font-base text-sm text-foreground/60">Dirección</p>
            <p className="font-base text-base text-foreground">{detail.client.address}</p>
          </div>
        </div>
      )}
      {detail.client.notes && (
        <div className="flex items-start gap-3">
          <FileText size={16} className="mt-0.5 flex-shrink-0 text-foreground/60" />
          <div className="min-w-0">
            <p className="font-base text-sm text-foreground/60">Notas</p>
            <p className="font-base text-base text-foreground">{detail.client.notes}</p>
          </div>
        </div>
      )}
    </NeoCard>

    {/* Stats Grid */}
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Servicios", value: detail.stats.totalServices, icon: Briefcase },
        { label: "Casos", value: detail.stats.totalCases, icon: FileText },
        { label: "Mensajes", value: detail.stats.totalMessages, icon: MessageCircle },
        { label: "Documentos", value: detail.stats.totalDocuments, icon: FileIcon },
      ].map(({ label, value, icon: Icon }) => (
        <NeoCard key={label} variant="neutral" className="p-3 text-center">
          <Icon size={18} className="mx-auto mb-1 text-main" />
          <p className="font-heading text-xl font-bold text-foreground md:text-2xl">{value}</p>
          <p className="font-base text-sm text-foreground/60">{label}</p>
        </NeoCard>
      ))}
    </div>

    <p className="text-center font-base text-sm text-foreground/50">
      Registrado {formatDate(detail.client.created_at)}
    </p>
  </div>
);

const ServicesTab: React.FC<{ detail: ClientDetailFull }> = ({ detail }) => (
  <div className="space-y-3">
    {detail.services.length === 0 ? (
      <p className="py-8 text-center font-base text-base text-foreground/50">Sin servicios registrados</p>
    ) : (
      detail.services.map((service) => (
        <NeoCard
          key={service.id}
          variant="neutral"
          className="flex items-start gap-3 p-3"
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-base border-2 border-border text-xs font-black text-main-foreground"
            style={{ backgroundColor: service.color }}
          >
            {service.abbreviation}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-base text-base font-semibold text-foreground">{service.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <NeoBadge variant={service.status === "active" ? "main" : "neutral"}>
                {service.status === "active" ? "Activo" : "Completado"}
              </NeoBadge>
            </div>
            <p className="mt-1 font-base text-sm text-foreground/60">
              Desde {formatDate(service.started_at)}
            </p>
          </div>
        </NeoCard>
      ))
    )}
  </div>
);

const CasesTab: React.FC<{ detail: ClientDetailFull }> = ({ detail }) => {
  const casesByType = detail.cases.reduce(
    (acc, c) => {
      const type = c.case_type || "Sin tipo";
      if (!acc[type]) acc[type] = [];
      acc[type].push(c);
      return acc;
    },
    {} as Record<string, typeof detail.cases>
  );

  return (
    <div className="space-y-4">
      {detail.cases.length === 0 ? (
        <p className="py-8 text-center font-base text-base text-foreground/50">Sin casos registrados</p>
      ) : (
        Object.entries(casesByType).map(([type, cases]) => (
          <div key={type}>
            <p className="px-2 py-2 font-base text-sm font-black uppercase tracking-wider text-foreground/60">
              {type}
            </p>
            <div className="space-y-2">
              {cases.map((caseItem) => (
                <NeoCard
                  key={caseItem.id}
                  variant="neutral"
                  className="space-y-2 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex-1 font-base text-base font-semibold text-foreground">{caseItem.title}</p>
                    <NeoBadge
                      variant={caseItem.status === "open" ? "main" : "neutral"}
                      className="flex-shrink-0 whitespace-nowrap"
                    >
                      {caseItem.status === "open" ? "Abierto" : "Cerrado"}
                    </NeoBadge>
                  </div>
                  <p className="font-base text-sm text-foreground/60">{caseItem.case_number}</p>
                  {caseItem.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {caseItem.tags.map((tag, i) => (
                        <NeoBadge key={i} variant="outline">
                          {tag.tag_value}
                        </NeoBadge>
                      ))}
                    </div>
                  )}
                </NeoCard>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const MediaTab: React.FC<{ media: ClientMedia[] }> = ({ media }) => {
  const grouped = media.reduce(
    (acc, m) => {
      if (!acc[m.media_type]) acc[m.media_type] = [];
      acc[m.media_type].push(m);
      return acc;
    },
    {} as Record<string, ClientMedia[]>
  );

  const typeIcons: Record<string, React.ReactNode> = {
    image: <Image size={32} />,
    audio: <Music size={32} />,
    document: <FileIcon size={32} />,
    video: <FileIcon size={32} />,
  };

  return (
    <div className="space-y-4">
      {media.length === 0 ? (
        <p className="py-8 text-center font-base text-base text-foreground/50">Sin archivos compartidos</p>
      ) : (
        Object.entries(grouped).map(([type, files]) => (
          <div key={type}>
            <p className="px-2 py-2 font-base text-sm font-black uppercase tracking-wider text-foreground/60">
              {type}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {files.map((file) => (
                <NeoCard
                  key={file.id}
                  variant="neutral"
                  className="space-y-2 p-3 text-center"
                >
                  <div className="flex justify-center text-foreground/60">
                    {typeIcons[type] || <FileIcon size={32} />}
                  </div>
                  <p className="truncate font-base text-sm text-foreground">{file.original_name}</p>
                  <p className="font-base text-sm text-foreground/60">
                    {file.file_size ? `${(file.file_size / 1024).toFixed(0)} KB` : "—"}
                  </p>
                </NeoCard>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

const MessagesTab: React.FC<{ detail: ClientDetailFull; onViewAll: () => void }> = ({
  detail,
  onViewAll,
}) => (
  <div className="space-y-3">
    {detail.messages.length === 0 ? (
      <p className="py-8 text-center font-base text-base text-foreground/50">Sin mensajes</p>
    ) : (
      <>
        {detail.messages.slice(0, 20).map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-base border-2 border-border px-3 py-2 font-base text-base ${
                msg.direction === "outbound"
                  ? "bg-main text-main-foreground shadow-button"
                  : "bg-secondary-background text-foreground shadow-button"
              }`}
            >
              <p className="mb-1 font-base text-xs text-foreground/60">{formatTime(msg.created_at)}</p>
              <p className="break-words">{msg.content}</p>
            </div>
          </div>
        ))}
        {detail.messages.length > 20 && (
          <NeoButton onClick={onViewAll} variant="outline" className="w-full">
            Ver todos ({detail.messages.length} mensajes)
          </NeoButton>
        )}
      </>
    )}
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const BotClients: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [clients, setClients] = useState<BotClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assignTab, setAssignTab] = useState<"all" | "assigned" | "unassigned">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [userFilter, setUserFilter] = useState("ALL");

  const [selectedClient, setSelectedClient] = useState<BotClient | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ClientDetailFull | null>(null);
  const [media, setMedia] = useState<ClientMedia[]>([]);
  const [activeTab, setActiveTab] = useState<"info" | "services" | "cases" | "media" | "messages">("info");
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await botAPI.getClients();
      const data = res.data as { clients?: BotClient[] } | BotClient[];
      const list = Array.isArray(data) ? data : (data?.clients || []);
      setClients(list);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClientDetail = useCallback(async (clientId: string | number) => {
    setDetailLoading(true);
    setActiveTab("info");
    try {
      const detailRes = await botAPI.getClientDetail(clientId);
      setDetail(detailRes.data);

      const mediaRes = await botAPI.getClientMedia(clientId);
      setMedia(mediaRes.data?.media || []);
    } catch {
      setDetail(null);
      setMedia([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/admin/users");
        // Client assignment is for digitadores only (not auxiliares/admin workload)
        setUsers((data.users || []).filter((u: any) => u.role === "digitador" && u.username !== "administracion"));
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    };
    fetchUsers();
  }, [isAdmin]);

  const handleAssignClient = async (userId: number | null) => {
    if (!selectedClient || !detail) return;
    setAssigning(true);
    try {
      await api.put(`/clients/${selectedClient.id}/assign`, { user_id: userId });
      setDetail((prev) =>
        prev ? { ...prev, client: { ...prev.client, assigned_to: userId } } : prev
      );
      await fetchClients();
    } catch (err: any) {
      console.error("Assign client error:", err);
      notify(err?.response?.data?.error || "Error asignando cliente");
    } finally {
      setAssigning(false);
    }
  };

  const handleSelectClient = async (client: BotClient) => {
    setSelectedClient(client);
    setShowRightPanel(true);
    await fetchClientDetail(client.id);
  };

  const handleChat = () => {
    if (selectedClient) {
      localStorage.setItem("openChatPhone", selectedClient.phone);
      navigate("/dashboard/bot-messages");
    }
  };

  // Search + digitador filter first; the tabs (and their counts) work on that list
  const narrowed = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = (c.name || "").toLowerCase().includes(q) || c.phone.includes(q);
    const matchUser = userFilter === "ALL" || String(c.assigned_to) === userFilter;
    return matchSearch && matchUser;
  });
  const tabCounts = {
    all: narrowed.length,
    assigned: narrowed.filter((c) => c.assigned_to != null).length,
    unassigned: narrowed.filter((c) => c.assigned_to == null).length,
  };
  const filtered = narrowed.filter(
    (c) => assignTab === "all" || (assignTab === "assigned" ? c.assigned_to != null : c.assigned_to == null),
  );
  const userName = (id: string) => users.find((u) => String(u.id) === id)?.name || `Usuario ${id}`;

  const tabLabels: Record<typeof activeTab, string> = {
    info: "Info",
    services: "Servicios",
    cases: "Casos",
    media: "Archivos",
    messages: "Mensajes",
  };

  return (
    <div
      className="-m-3 md:-m-8 flex overflow-hidden"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* LEFT PANEL — Client List */}
      <div
        className={`flex flex-col border-r-2 border-border bg-background ${
          showRightPanel ? "hidden md:flex" : "flex"
        } w-full flex-shrink-0 md:w-80`}
      >
        {/* Header: title, search, folded filter, tabs with counts */}
        <div className="flex-shrink-0 border-b-2 border-border bg-secondary-background px-3 pb-2 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-2xl font-black text-foreground">Clientes</h2>
            <span className="text-xs font-semibold tabular-nums text-foreground/60">{clients.length} clientes</span>
          </div>

          <div className="relative mt-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
            <input
              type="text"
              placeholder="Buscar nombre o número…"
              aria-label="Buscar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-base border-2 border-border bg-background py-2 pl-9 pr-3 font-base text-sm text-foreground outline-none focus:border-main"
            />
          </div>

          {isAdmin && (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  className={`inline-flex items-center gap-1.5 rounded-base border-2 border-border px-2.5 py-1 text-xs font-bold ${
                    showFilters || userFilter !== "ALL" ? "bg-main text-main-foreground" : "bg-background"
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  {userFilter !== "ALL" ? "Filtros · 1" : "Filtros"}
                </button>
                {userFilter !== "ALL" && (
                  <button
                    type="button"
                    onClick={() => setUserFilter("ALL")}
                    aria-label={`Quitar filtro: ${userName(userFilter)}`}
                    className="inline-flex max-w-[11rem] items-center gap-1 rounded-full border-2 border-border bg-background px-2 py-0.5 text-xs font-semibold"
                  >
                    <span className="truncate">{userName(userFilter)}</span>
                    <X size={12} className="shrink-0" />
                  </button>
                )}
              </div>
              {showFilters && (
                <div className="mt-2 rounded-base border-2 border-border bg-background p-2.5">
                  <label className="block font-base text-xs font-semibold text-foreground/70">
                    Digitador
                    <select
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      className="mt-1 w-full rounded-base border-2 border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-main"
                    >
                      <option value="ALL">Todos</option>
                      {users.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div role="tablist" aria-label="Asignación" className="custom-scroll -mx-3 mt-2 flex gap-1 overflow-x-auto px-3 pb-1">
                {(
                  [
                    ["all", "Todos"],
                    ["assigned", "Asignados"],
                    ["unassigned", "Sin asignar"],
                  ] as const
                ).map(([val, label]) => {
                  const active = assignTab === val;
                  const urgent = val === "unassigned" && tabCounts.unassigned > 0;
                  return (
                    <button
                      key={val}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setAssignTab(val)}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-base border-2 px-2 py-1 text-xs font-bold ${
                        active
                          ? "border-border bg-main text-main-foreground shadow-button"
                          : urgent
                            ? "border-orange-500 bg-orange-500/10 text-orange-700"
                            : "border-transparent hover:border-border"
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
            </>
          )}
        </div>

        {/* Client List */}
        <div className="custom-scroll flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-foreground/50">
              <RefreshCw size={20} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-foreground/50">
              <Users size={32} className="mx-auto mb-2 opacity-40" />
              <p className="font-base text-base">{clients.length ? "Ningún cliente con estos filtros" : "Sin clientes"}</p>
            </div>
          ) : (
            <ul className="divide-y-2 divide-border/15">
              {filtered.map((client) => (
                <ClientItem
                  key={client.id}
                  client={client}
                  isSelected={selectedClient?.id === client.id}
                  onSelect={() => handleSelectClient(client)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Client Detail */}
      <div
        className={`flex flex-1 flex-col overflow-hidden bg-secondary-background ${
          !showRightPanel ? "hidden md:flex" : "flex"
        }`}
      >
        {!selectedClient ? (
          <div className="flex flex-1 items-center justify-center text-foreground/50">
            <p className="font-heading text-xl text-foreground/70 md:text-2xl">Selecciona un cliente</p>
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <div className="flex flex-shrink-0 items-center gap-3 border-b-2 border-border bg-secondary-background px-4 py-3">
              <NeoButton
                size="icon"
                variant="neutral"
                className="md:hidden"
                onClick={() => {
                  setShowRightPanel(false);
                  setSelectedClient(null);
                }}
              >
                <ChevronLeft size={20} />
              </NeoButton>

              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-border bg-main text-sm font-black text-main-foreground shadow-button">
                {getInitials(selectedClient.name, selectedClient.phone)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-base text-base font-semibold text-foreground">
                  {selectedClient.name || "Sin nombre"}
                </p>
                <p className="truncate font-base text-sm tabular-nums text-foreground/60">{formatPhone(selectedClient.phone)}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b-2 border-border bg-secondary-background px-4 py-2">
              {(["info", "services", "cases", "media", "messages"] as const).map((tab) => (
                <NeoButton
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  variant={activeTab === tab ? "default" : "neutral"}
                  size="sm"
                >
                  {tabLabels[tab]}
                </NeoButton>
              ))}
            </div>

            {/* Content */}
            <div className="custom-scroll flex-1 overflow-y-auto px-4 py-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-8 text-foreground/50">
                  <RefreshCw size={20} className="animate-spin" />
                </div>
              ) : !detail ? (
                <p className="py-8 text-center font-base text-base text-foreground/50">Error cargando detalles</p>
              ) : activeTab === "info" ? (
                <InfoTab
                  detail={detail}
                  onChat={handleChat}
                  users={users}
                  isAdmin={isAdmin}
                  onAssign={handleAssignClient}
                  assigning={assigning}
                />
              ) : activeTab === "services" ? (
                <ServicesTab detail={detail} />
              ) : activeTab === "cases" ? (
                <CasesTab detail={detail} />
              ) : activeTab === "media" ? (
                <MediaTab media={media} />
              ) : (
                <MessagesTab detail={detail} onViewAll={handleChat} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BotClients;
