import React, { useEffect, useState, useCallback } from "react";
import UserBadge from "../components/UserBadge";
import { Search, RefreshCw, ChevronLeft, AlertCircle, Tag, SlidersHorizontal, X } from "lucide-react";
import api from "../services/api";
import { getAuthToken } from "../utils";
import { useAuth } from "../context/AuthContext";
import { NeoCard, NeoButton, NeoBadge } from "@guru/ui";
import { notify } from "../lib/dialogs";

const getAPIUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3000";
  const host = window.location.hostname;

  // Production domains → Railway backend (HTTPS)
  if (
    host === "gurusolucionesrd.com" ||
    host === "www.gurusolucionesrd.com" ||
    host.includes("netlify.app")
  ) {
    return "https://guruweb-backend-production.up.railway.app";
  }

  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:3000";
  }

  // Local / LAN development
  return `http://${host}:3000`;
};

// Map frontend section IDs to backend case_type values
const SECTION_TO_CASE_TYPE: Record<string, string> = {
  "reclamaciones": "reclamaciones",
  "reclamaciones_digitacion": "reclamaciones",
  "reclamaciones_tienda_fisica": "tienda_fisica",
  "reclamaciones_administracion": "reclamaciones",
  "digitacion": "digitacion",
  "tienda_fisica": "tienda_fisica",
  "administracion": "reclamaciones",
  "consultas": "consultas",
  "tramites": "tramites",
};

interface CaseRow {
  id: number;
  case_number: string;
  title: string;
  description?: string;
  status: string;
  case_type?: string;
  court?: string;
  next_hearing?: string;
  client_id: number;
  user_id?: number | null;
  created_at: string;
  tags: Array<{ tag_type: string; tag_value: string }>;
  client_name?: string;
  client_phone?: string;
}

interface Section {
  id: string;
  name: string;
  label: string;
  description: string;
  color: string;
  complaint_tags: Array<{ id: string; label: string; color: string }>;
}

const SECTIONS: Section[] = [
  // RECLAMACIONES AND SUBSECTIONS
  {
    id: "reclamaciones",
    name: "Reclamaciones",
    label: "📋 Reclamaciones",
    description: "Quejas y reclamaciones de clientes",
    color: "from-red-500 to-pink-600",
    complaint_tags: [
      {
        id: "servicio_erroneo",
        label: "Servicio erróneo",
        color: "#ef4444",
      },
      {
        id: "precios_altos",
        label: "Precios altos",
        color: "#f97316",
      },
      {
        id: "info_erronea",
        label: "Información errónea",
        color: "#eab308",
      },
    ],
  },
  {
    id: "reclamaciones_digitacion",
    name: "Reclamaciones - Digitación",
    label: "  └─ Digitación",
    description: "Reclamaciones de servicio de digitación",
    color: "from-red-500 to-pink-600",
    complaint_tags: [
      {
        id: "servicio_erroneo",
        label: "Servicio erróneo",
        color: "#ef4444",
      },
      {
        id: "precios_altos",
        label: "Precios altos",
        color: "#f97316",
      },
    ],
  },
  {
    id: "reclamaciones_tienda_fisica",
    name: "Reclamaciones - Tienda Física",
    label: "  └─ Tienda Física",
    description: "Reclamaciones de tienda física",
    color: "from-red-500 to-pink-600",
    complaint_tags: [
      {
        id: "producto_defectuoso",
        label: "Producto defectuoso",
        color: "#ef4444",
      },
      {
        id: "cantidad_incorrecta",
        label: "Cantidad incorrecta",
        color: "#f97316",
      },
    ],
  },
  {
    id: "reclamaciones_administracion",
    name: "Reclamaciones - Administración",
    label: "  └─ Administración",
    description: "Reclamaciones de servicios administrativos",
    color: "from-red-500 to-pink-600",
    complaint_tags: [
      {
        id: "info_erronea",
        label: "Información errónea",
        color: "#eab308",
      },
      {
        id: "servicio_erroneo",
        label: "Servicio erróneo",
        color: "#ef4444",
      },
    ],
  },

  // GENERAL CASES (NON-RECLAMACIONES)
  {
    id: "digitacion",
    name: "Digitación",
    label: "✍️ Digitación",
    description: "Casos generales de servicio de digitación",
    color: "from-blue-500 to-cyan-600",
    complaint_tags: [],
  },
  {
    id: "tienda_fisica",
    name: "Tienda Física",
    label: "🏪 Tienda Física",
    description: "Casos generales de tienda física",
    color: "from-amber-500 to-orange-600",
    complaint_tags: [],
  },
  {
    id: "administracion",
    name: "Administración",
    label: "⚙️ Administración",
    description: "Casos administrativos y generales",
    color: "from-purple-500 to-pink-600",
    complaint_tags: [],
  },

  {
    id: "consultas",
    name: "Consultas",
    label: "Consultas",
    description: "Consultas legales y asesoría",
    color: "from-blue-500 to-cyan-600",
    complaint_tags: [],
  },
  {
    id: "tramites",
    name: "Trámites",
    label: "Trámites",
    description: "Trámites y gestiones administrativas",
    color: "from-emerald-500 to-teal-600",
    complaint_tags: [],
  },
];

const Cases: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>(SECTIONS[0]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [users, setUsers] = useState<Array<{ id: number; name: string; role: string }>>([]);
  const [assigning, setAssigning] = useState(false);
  const [closing, setClosing] = useState(false);

  // Separate sections into reclamaciones and normal cases
  const reclamacionesSections = SECTIONS.filter(s => s.id.startsWith('reclamaciones'));
  const normalCasesSections = SECTIONS.filter(s => !s.id.startsWith('reclamaciones'));

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const caseType = SECTION_TO_CASE_TYPE[activeSection.id] || activeSection.id;
      const response = await fetch(
        `${getAPIUrl()}/api/cases?case_type=${caseType}`,
        {
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCases(Array.isArray(data) ? data : data.cases || []);
      } else {
        setCases([]);
      }
    } catch (err) {
      console.error("Failed to fetch cases:", err);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [activeSection]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/admin/users");
        // Cases are handled by digitadores only (not auxiliares/admin workload)
        setUsers((data.users || []).filter((u: any) => u.role === "digitador" && u.username !== "administracion"));
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    };
    fetchUsers();
  }, [isAdmin]);

  const handleAssignCase = async (userId: number | null) => {
    if (!selectedCase) return;
    setAssigning(true);
    try {
      await api.post(`/cases/${selectedCase.id}/assign`, { user_id: userId });
      setSelectedCase((prev) =>
        prev
          ? {
              ...prev,
              user_id: userId,
              status: userId ? "in_progress" : prev.status,
            }
          : prev
      );
      await fetchCases();
    } catch (err: any) {
      console.error("Assign case error:", err);
      notify(err?.response?.data?.error || "Error asignando caso");
    } finally {
      setAssigning(false);
    }
  };

  const handleCloseCase = async () => {
    if (!selectedCase) return;
    setClosing(true);
    try {
      await api.post(`/cases/${selectedCase.id}/close`, { reason: "paid" });
      setSelectedCase((prev) => (prev ? { ...prev, status: "paid" } : prev));
      await fetchCases();
    } catch (err: any) {
      console.error("Close case error:", err);
      notify(err?.response?.data?.error || "Error cerrando caso");
    } finally {
      setClosing(false);
    }
  };

  // Search + complaint types first; the Abiertos/Resueltos tabs (and their counts) work on that list
  const narrowed = cases.filter((c) => {
    // Search filter
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      c.title.toLowerCase().includes(q) ||
      c.case_number.toLowerCase().includes(q) ||
      (c.client_name || "").toLowerCase().includes(q);

    // Tag filter
    if (selectedTags.size > 0) {
      const hasTag = c.tags.some((tag) => selectedTags.has(tag.tag_value));
      if (!hasTag) return false;
    }

    return matchSearch;
  });
  const statusCounts = {
    open: narrowed.filter((c) => c.status !== 'resolved').length,
    resolved: narrowed.filter((c) => c.status === 'resolved').length,
  };
  const filtered = narrowed.filter((c) => (showResolved ? c.status === 'resolved' : c.status !== 'resolved'));

  const pickSection = (id: string) => {
    const section = SECTIONS.find((x) => x.id === id);
    if (!section) return;
    setActiveSection(section);
    setSelectedTags(new Set());
    setSearch("");
  };

  const toggleTag = (tagValue: string) => {
    const newTags = new Set(selectedTags);
    if (newTags.has(tagValue)) {
      newTags.delete(tagValue);
    } else {
      newTags.add(tagValue);
    }
    setSelectedTags(newTags);
  };

  return (
    <div
      className="-m-3 md:-m-8 flex overflow-hidden bg-background text-foreground"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* LEFT PANEL — Sections & Filters */}
      <div
        className={`flex flex-col border-r-2 border-border bg-secondary-background ${
          showRightPanel ? "hidden md:flex" : "flex"
        } w-full flex-shrink-0 md:w-80`}
      >
        {/* Header: title, section, search, folded complaint filters, status tabs with counts */}
        <div className="flex-shrink-0 border-b-2 border-border bg-secondary-background px-3 pb-2 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-2xl font-black">Casos</h2>
            <span className="text-xs font-semibold tabular-nums text-foreground/60">{cases.length} en esta sección</span>
          </div>

          <label className="mt-2 block font-base text-xs font-semibold text-foreground/70">
            Sección
            <select
              value={activeSection.id}
              onChange={(e) => pickSection(e.target.value)}
              className="mt-1 w-full rounded-base border-2 border-border bg-background px-2 py-1.5 text-sm font-semibold text-foreground outline-none focus:border-main"
            >
              <optgroup label="Reclamaciones">
                {reclamacionesSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.id === "reclamaciones" ? "Todas las reclamaciones" : section.name.replace(/^Reclamaciones - /, "Reclamaciones · ")}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Casos">
                {normalCasesSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <div className="relative mt-2">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
            <input
              type="text"
              placeholder="Buscar caso, número o cliente…"
              aria-label="Buscar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-base border-2 border-border bg-background py-2 pl-9 pr-3 font-base text-sm text-foreground outline-none focus:border-main"
            />
          </div>

          {/* Complaint types, folded by default */}
          {activeSection.complaint_tags.length > 0 && (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  aria-expanded={showFilters}
                  className={`inline-flex items-center gap-1.5 rounded-base border-2 border-border px-2.5 py-1 text-xs font-bold ${
                    showFilters || selectedTags.size ? "bg-main text-main-foreground" : "bg-background"
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  {selectedTags.size ? `Filtros · ${selectedTags.size}` : "Filtros"}
                </button>
                {[...selectedTags].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    aria-label={`Quitar filtro: ${t}`}
                    className="inline-flex max-w-[11rem] items-center gap-1 rounded-full border-2 border-border bg-background px-2 py-0.5 text-xs font-semibold"
                  >
                    <span className="truncate">{t}</span>
                    <X size={12} className="shrink-0" />
                  </button>
                ))}
                {selectedTags.size > 1 && (
                  <button type="button" onClick={() => setSelectedTags(new Set())} className="text-xs font-semibold underline">
                    Limpiar
                  </button>
                )}
              </div>
              {showFilters && (
                <fieldset className="mt-2 space-y-1.5 rounded-base border-2 border-border bg-background p-2.5">
                  <legend className="px-1 text-xs font-semibold text-foreground/70">Tipo de reclamación</legend>
                  {activeSection.complaint_tags.map((tag) => (
                    <label key={tag.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedTags.has(tag.label)}
                        onChange={() => toggleTag(tag.label)}
                        className="h-4 w-4 accent-[var(--main)]"
                      />
                      {tag.label}
                    </label>
                  ))}
                </fieldset>
              )}
            </>
          )}

          <div role="tablist" aria-label="Estado" className="custom-scroll -mx-3 mt-2 flex gap-1 overflow-x-auto px-3 pb-1">
            {(
              [
                [false, "Abiertos", statusCounts.open],
                [true, "Resueltos", statusCounts.resolved],
              ] as const
            ).map(([resolved, label, count]) => {
              const active = showResolved === resolved;
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setShowResolved(resolved)}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-base border-2 px-2 py-1 text-xs font-bold ${
                    active ? "border-border bg-main text-main-foreground shadow-button" : "border-transparent hover:border-border"
                  }`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-main-foreground/15" : "bg-foreground/10"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cases List */}
        <div className="flex-1 overflow-y-auto custom-scroll bg-background">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-foreground/50">
              <RefreshCw size={20} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-foreground/50">
              <AlertCircle size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-base">{cases.length ? "Ningún caso con estos filtros" : "Sin casos"}</p>
            </div>
          ) : (
            <ul className="divide-y-2 divide-border/15">
              {filtered.map((caseItem) => {
                const selected = selectedCase?.id === caseItem.id;
                return (
                  <li key={caseItem.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCase(caseItem);
                        setShowRightPanel(true);
                      }}
                      className={`w-full px-3 py-2.5 text-left transition-colors ${
                        selected ? "bg-main/15 shadow-[inset_4px_0_0_0_var(--main)]" : "hover:bg-secondary-background"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-bold">{caseItem.title}</p>
                        <span className="shrink-0 text-[11px] tabular-nums text-foreground/50">
                          {new Date(caseItem.created_at).toLocaleDateString("es-DO", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-foreground/65">
                        <span className="shrink-0 font-semibold">{caseItem.case_number}</span>
                        {caseItem.client_name && <span className="min-w-0 truncate">· {caseItem.client_name}</span>}
                      </div>
                      {caseItem.user_id != null && (
                        <div className="mt-1">
                          <UserBadge userId={caseItem.user_id} />
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Case Detail */}
      <div
        className={`flex flex-1 flex-col overflow-hidden bg-background ${
          !showRightPanel ? "hidden md:flex" : "flex"
        }`}
      >
        {!selectedCase ? (
          <div className="flex flex-1 items-center justify-center text-foreground/50">
            <p className="text-lg font-base">Selecciona un caso</p>
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <div className="flex flex-shrink-0 items-center gap-3 border-b-2 border-border bg-secondary-background px-6 py-4">
              <NeoButton
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => {
                  setShowRightPanel(false);
                  setSelectedCase(null);
                }}
              >
                <ChevronLeft size={24} />
              </NeoButton>

              <div className="flex-1 min-w-0">
                <p className="truncate font-heading text-lg">
                  {selectedCase.case_number}
                </p>
                <p className="truncate text-base text-foreground/70 mt-1">
                  {selectedCase.title}
                </p>
              </div>

              {selectedCase.status !== 'resolved' && selectedCase.status !== 'paid' && (
                <NeoButton
                  onClick={async () => {
                    try {
                      const response = await fetch(`${getAPIUrl()}/api/cases/${selectedCase.id}/resolve`, {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${getAuthToken()}`,
                        },
                      });
                      const data = await response.json().catch(() => ({}));
                      if (response.ok) {
                        setSelectedCase(data.case);
                      } else {
                        console.error('Error resolving case:', response.status, data);
                        notify(`Error: ${data.error || response.statusText} (${response.status})`);
                      }
                    } catch (err: any) {
                      console.error('Error resolving case:', err);
                      notify(`Error: ${err.message}`);
                    }
                  }}
                >
                  ✓ Resolver
                </NeoButton>
              )}
              {selectedCase.status === 'resolved' && (
                <NeoButton
                  variant="neutral"
                  onClick={async () => {
                    try {
                      const response = await fetch(`${getAPIUrl()}/api/cases/${selectedCase.id}/reopen`, {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${getAuthToken()}`,
                        },
                      });
                      const data = await response.json().catch(() => ({}));
                      if (response.ok) {
                        setSelectedCase(data.case);
                      } else {
                        console.error('Error reopening case:', response.status, data);
                        notify(`Error: ${data.error || response.statusText} (${response.status})`);
                      }
                    } catch (err: any) {
                      console.error('Error reopening case:', err);
                      notify(`Error: ${err.message}`);
                    }
                  }}
                >
                  ↻ Re-abrir
                </NeoButton>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 custom-scroll space-y-6">
              {/* Title & Status */}
              <div>
                <h2 className="font-heading text-xl md:text-2xl font-bold mb-3">{selectedCase.title}</h2>
                <p className="text-base text-foreground/80 leading-relaxed">{selectedCase.description}</p>
              </div>

              {/* Admin / assigned employee actions */}
              {(isAdmin || selectedCase.user_id === user?.id) && (
                <NeoCard variant="outline" className="space-y-3 p-4">
                  <p className="font-base text-sm font-black uppercase tracking-wider text-foreground/60">
                    {isAdmin ? "Acciones de administrador" : "Acciones del caso"}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {isAdmin && (
                      <div className="flex-1">
                        <label className="mb-1 block text-sm text-foreground/60">Asignar caso a</label>
                        <select
                          disabled={assigning}
                          value={selectedCase.user_id || ""}
                          onChange={(e) => handleAssignCase(e.target.value ? Number(e.target.value) : null)}
                          className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-base text-foreground focus:outline-none focus:ring-2 focus:ring-main"
                        >
                          <option value="">Sin asignar</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {selectedCase.status !== 'paid' && selectedCase.status !== 'resolved' && (
                      <NeoButton
                        onClick={handleCloseCase}
                        disabled={closing}
                        className="self-end"
                      >
                        {closing ? <RefreshCw size={14} className="mr-1 animate-spin" /> : "💰"}
                        Cerrar caso (pagado)
                      </NeoButton>
                    )}
                  </div>
                </NeoCard>
              )}

              {/* Message Source Reference */}
              {selectedCase.tags && selectedCase.tags.some(t => t.tag_type === 'source_phone') && (
                <NeoCard variant="main">
                  <p className="text-base font-base text-main-foreground/80 mb-3">Origen del reclamo</p>
                  <NeoButton
                    onClick={() => {
                      const sourcePhone = selectedCase.tags.find(t => t.tag_type === 'source_phone')?.tag_value;
                      if (sourcePhone) {
                        localStorage.setItem('openChatPhone', sourcePhone);
                        window.location.href = '/dashboard/bot-messages';
                      }
                    }}
                  >
                    💬 Ver mensaje original
                  </NeoButton>
                </NeoCard>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <NeoCard variant="neutral" className="p-4">
                  <p className="text-base text-foreground/60 mb-1">Estado</p>
                  <NeoBadge variant={selectedCase.status === 'resolved' ? 'neutral' : 'main'} className="text-base">
                    {selectedCase.status}
                  </NeoBadge>
                </NeoCard>

                <NeoCard variant="neutral" className="p-4">
                  <p className="text-base text-foreground/60 mb-1">Caso #</p>
                  <p className="text-base font-semibold">{selectedCase.case_number}</p>
                </NeoCard>

                {selectedCase.court && (
                  <NeoCard variant="neutral" className="p-4">
                    <p className="text-base text-foreground/60 mb-1">Juzgado</p>
                    <p className="text-base font-semibold">{selectedCase.court}</p>
                  </NeoCard>
                )}

                <NeoCard variant="neutral" className="p-4">
                  <p className="text-base text-foreground/60 mb-1">Creado</p>
                  <p className="text-base font-semibold">
                    {new Date(selectedCase.created_at).toLocaleDateString("es-DO")}
                  </p>
                </NeoCard>
              </div>

              {/* Client Info */}
              {selectedCase.client_name && (
                <NeoCard variant="neutral" className="p-4">
                  <p className="text-base text-foreground/60 mb-3">Cliente</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-main text-sm font-bold text-main-foreground">
                      {selectedCase.client_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-base">
                        {selectedCase.client_name}
                      </p>
                      <p className="text-base text-foreground/70">{selectedCase.client_phone}</p>
                    </div>
                  </div>
                </NeoCard>
              )}

              {/* Tags */}
              {selectedCase.tags.length > 0 && (
                <div>
                  <p className="text-base text-foreground/60 mb-3 flex items-center gap-2">
                    <Tag size={16} />
                    Etiquetas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCase.tags.map((tag, i) => (
                      <NeoBadge key={i} variant="outline" className="text-base">
                        {tag.tag_value}
                      </NeoBadge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Cases;
