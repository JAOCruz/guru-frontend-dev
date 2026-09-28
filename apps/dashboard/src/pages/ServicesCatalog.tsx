import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, Plus, Pencil, Trash2, X, Save, ChevronDown, ChevronUp,
  DollarSign, Layers, AlertTriangle, Package, ArrowLeft, Sparkles,
} from "lucide-react";
import { serviceCatalogAPI } from "../services/api";
import { preventDecimalInput } from "../utils";
import { useAuth } from "../context/AuthContext";
import { NeoCard, NeoButton, NeoInput, NeoSelect, NeoBadge } from "@guru/ui";

interface PriceTier { min: number; max: number | null; label: string; price: number; }
interface Service {
  id: number; name: string; description: string | null;
  category_id: number | null; category_name: string | null;
  digitacion_price: string | number | null;
  notarizacion_price: string | number | null;
  price_tiers: PriceTier[] | null;
  unit_type: string | null; active: boolean;
}
interface Category { id: number; name: string; }

const DEFAULT_TIER: PriceTier = { min: 0, max: null, label: "", price: 0 };

/* ── 3 Big Groups ── */
const GROUP_MAP: Record<string, string[]> = {
  "Papelería o Consumibles": ["Papelería", "Consumibles"],
  Digitación: [
    "Redactar o digitar un documento", "Creación De Un Correo",
    "Modificación de un Documento", "Revisión de contrato",
    "Scanner de documentos", "Notarización",
    "Solicitud de Certificaciones", "Redactar y Certificar una Traducción",
    "Impresión", "Fotos 2x2", "Legalización",
    "Corrección de Documento", "Máquina de escribir",
  ],
  Mensajería: ["Mensajería", "Compra de Impuestos"],
};

const GROUP_EMOJIS: Record<string, string> = {
  "Papelería o Consumibles": "📦",
  Digitación: "⌨️",
  Mensajería: "📨",
};

const CATEGORY_EMOJIS: Record<string, string> = {
  Papelería: "📄", Consumibles: "🍽️", Impresión: "🖨️",
  "Modificación de un Documento": "✏️",
  "Redactar o digitar un documento": "⌨️",
  Notarización: "✍️",
  "Redactar y Certificar una Traducción": "🌐",
  "Solicitud de Certificaciones": "📜",
  "Scanner de documentos": "📠",
  "Fotos 2x2": "📷",
  "Creación De Un Correo": "📧",
  "Compra de Impuestos": "💰",
  Mensajería: "📨", Legalización: "⚖️",
  "Revisión de contrato": "🔍",
  "Corrección de Documento": "📝",
  "Máquina de escribir": "⌨️",
};

const getCategoryEmoji = (name: string | null) =>
  name ? CATEGORY_EMOJIS[name] || "⭐" : "📋";

const STORAGE_KEY = "guru-services-catalog";

const LOCAL_CATEGORIES: Category[] = Array.from(
  new Set(Object.values(GROUP_MAP).flat())
).map((name, i) => ({ id: i + 1, name }));

const sampleServices: Service[] = [
  { id: 1, name: "Acto de Venta - Bien Inmueble", description: "Redacción de contrato de compraventa de inmueble.", category_id: 2, category_name: "Redactar o digitar un documento", digitacion_price: 3500, notarizacion_price: 0, price_tiers: [{ min: 0, max: 5000000, label: "Hasta 5M", price: 3500 }, { min: 5000001, max: 15000000, label: "5M - 15M", price: 5500 }, { min: 15000001, max: null, label: "Más de 15M", price: 8500 }], unit_type: "por acto", active: true },
  { id: 2, name: "Poder General", description: "Poder amplio para actos de administración y disposición.", category_id: 2, category_name: "Redactar o digitar un documento", digitacion_price: 2500, notarizacion_price: 1200, price_tiers: [], unit_type: "por documento", active: true },
  { id: 3, name: "Traducción Jurada", description: "Traducción certificada de documentos.", category_id: 8, category_name: "Redactar y Certificar una Traducción", digitacion_price: 1500, notarizacion_price: 0, price_tiers: [], unit_type: "por página", active: true },
  { id: 4, name: "Impresión Certificada", description: "Impresión en papel certificado.", category_id: 13, category_name: "Impresión", digitacion_price: 25, notarizacion_price: 0, price_tiers: [], unit_type: "por hoja", active: true },
  { id: 5, name: "Mensajería Local", description: "Entrega de documentos en zona metropolitana.", category_id: 27, category_name: "Mensajería", digitacion_price: 300, notarizacion_price: 0, price_tiers: [], unit_type: "por envío", active: true },
];

const loadLocalServices = (): Service[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return sampleServices;
};

const saveLocalServices = (list: Service[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
};

const fmtMoney = (v: string | number | null) => {
  const n = Number(v) || 0;
  return `RD$ ${n.toLocaleString("es-DO")}`;
};
const hasNota = (svc: Service) => {
  const n = Number(svc.notarizacion_price);
  return !isNaN(n) && n > 0;
};
const hasTiers = (svc: Service) =>
  Array.isArray(svc.price_tiers) && svc.price_tiers.length > 0;

export default function ServicesCatalog() {
  const { isAdmin } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedSubcat, setSelectedSubcat] = useState<string>("all");
  const [expandedTiers, setExpandedTiers] = useState<Set<number>>(new Set());

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState<Partial<Service> & { price_tiers: PriceTier[] }>({
    name: "", description: "", category_id: null,
    digitacion_price: 0, notarizacion_price: 0, price_tiers: [], unit_type: "por documento",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [svcRes, catRes] = await Promise.all([
        serviceCatalogAPI.getAll(), serviceCatalogAPI.getCategories(),
      ]);
      const apiServices = svcRes.data.services || [];
      const apiCategories = catRes.data.categories || [];
      if (apiServices.length > 0) {
        setServices(apiServices);
        setCategories(apiCategories.length > 0 ? apiCategories : LOCAL_CATEGORIES);
        saveLocalServices(apiServices);
      } else {
        throw new Error("Empty API response");
      }
    } catch (err) {
      console.error("[ServicesCatalog] API failed, using local fallback:", err);
      setServices(loadLocalServices());
      setCategories(LOCAL_CATEGORIES);
    } finally { setLoading(false); }
  };

  const servicesByGroup = useMemo(() => {
    const map: Record<string, Service[]> = {};
    Object.keys(GROUP_MAP).forEach((g) => (map[g] = []));
    services.forEach((s) => {
      const cat = s.category_name || "Sin categoría";
      for (const [group, members] of Object.entries(GROUP_MAP)) {
        if (members.includes(cat)) { map[group].push(s); break; }
      }
    });
    return map;
  }, [services]);

  const groupStats = useMemo(() => {
    const stats: Record<string, { count: number; min: number; max: number; hasNota: boolean; hasTiers: boolean; subcats: string[] }> = {};
    Object.entries(servicesByGroup).forEach(([group, svcs]) => {
      const prices = svcs.map((s) => Number(s.digitacion_price) || 0);
      const subcats = Array.from(new Set(svcs.map((s) => s.category_name).filter(Boolean)));
      stats[group] = {
        count: svcs.length, min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0,
        hasNota: svcs.some(hasNota), hasTiers: svcs.some(hasTiers), subcats,
      };
    });
    return stats;
  }, [servicesByGroup]);

  const filteredServices = useMemo(() => {
    if (!selectedGroup) return [];
    let result = servicesByGroup[selectedGroup] || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q));
    }
    if (selectedSubcat !== "all") result = result.filter((s) => s.category_name === selectedSubcat);
    return [...result].sort((a, b) => (a.category_name || "").localeCompare(b.category_name || ""));
  }, [servicesByGroup, selectedGroup, search, selectedSubcat]);

  const servicesBySubcat = useMemo(() => {
    const map: Record<string, Service[]> = {};
    filteredServices.forEach((s) => {
      const c = s.category_name || "Sin categoría";
      if (!map[c]) map[c] = []; map[c].push(s);
    });
    return map;
  }, [filteredServices]);

  const openCreate = () => {
    setEditingService(null);
    setForm({ name: "", description: "", category_id: categories[0]?.id || null, digitacion_price: 0, notarizacion_price: 0, price_tiers: [], unit_type: "por documento" });
    setShowModal(true);
  };
  const openEdit = (svc: Service) => {
    setEditingService(svc);
    setForm({
      name: svc.name, description: svc.description || "", category_id: svc.category_id,
      digitacion_price: Number(svc.digitacion_price) || 0, notarizacion_price: Number(svc.notarizacion_price) || 0,
      price_tiers: Array.isArray(svc.price_tiers) ? svc.price_tiers.map((t) => ({ min: Number(t.min) || 0, max: t.max === null || t.max === undefined ? null : Number(t.max), label: t.label || "", price: Number(t.price) || 0 })) : [],
      unit_type: svc.unit_type || "por documento",
    });
    setShowModal(true);
  };
  const handleSave = async () => {
    if (!form.name || form.digitacion_price === undefined) { alert("Nombre y precio son requeridos."); return; }
    try {
      setSaving(true);
      const category = categories.find((c) => c.id === Number(form.category_id));
      const payload: Service = {
        id: editingService ? editingService.id : Date.now(),
        name: form.name || "",
        description: form.description || null,
        category_id: form.category_id || null,
        category_name: category?.name || null,
        digitacion_price: Number(form.digitacion_price),
        notarizacion_price: Number(form.notarizacion_price) || 0,
        price_tiers: form.price_tiers.map((t) => ({ min: Number(t.min), max: t.max === null || t.max === undefined ? null : Number(t.max), label: t.label, price: Number(t.price) })),
        unit_type: form.unit_type || "por documento",
        active: true,
      };

      // Try API first, fallback to local state
      try {
        if (editingService) await serviceCatalogAPI.update(editingService.id, payload); else await serviceCatalogAPI.create(payload);
      } catch {
        // Local fallback
        setServices((prev) => {
          let next;
          if (editingService) {
            next = prev.map((s) => (s.id === editingService.id ? payload : s));
          } else {
            next = [...prev, payload];
          }
          saveLocalServices(next);
          return next;
        });
      }

      await fetchData();
      setShowModal(false);
    } catch (err) { alert((err as any)?.response?.data?.error || "Error guardando."); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar?")) return;
    try {
      try {
        await serviceCatalogAPI.delete(id);
      } catch {
        setServices((prev) => {
          const next = prev.filter((s) => s.id !== id);
          saveLocalServices(next);
          return next;
        });
      }
      await fetchData();
    } catch { alert("Error eliminando."); }
  };
  const addTier = () => setForm((p) => ({ ...p, price_tiers: [...(p.price_tiers || []), { ...DEFAULT_TIER }] }));
  const removeTier = (idx: number) => setForm((p) => ({ ...p, price_tiers: (p.price_tiers || []).filter((_, i) => i !== idx) }));
  const updateTier = (idx: number, field: keyof PriceTier, value: any) => setForm((p) => { const tiers = [...(p.price_tiers || [])]; tiers[idx] = { ...tiers[idx], [field]: value }; return { ...p, price_tiers: tiers }; });
  const toggleTiers = (id: number) => setExpandedTiers((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center py-20 text-main">
      <AlertTriangle size={48} className="mb-4 text-main" />
      <p className="text-xl md:text-2xl font-black">Acceso restringido</p>
    </div>
  );

  /* ── Service Card ── */
  const ServiceCard = ({ svc, idx }: { svc: Service; idx: number }) => {
    const showNota = hasNota(svc);
    const showTiers = hasTiers(svc);
    const tiersOpen = expandedTiers.has(svc.id);
    return (
      <motion.div
        key={svc.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: idx * 0.03 }}
      >
        <NeoCard variant="main" className="p-6">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="text-base md:text-lg font-heading font-black leading-tight text-main-foreground">{svc.name}</h3>
            {svc.category_name && selectedSubcat === "all" && (
              <NeoBadge variant="neutral" className="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs">
                {getCategoryEmoji(svc.category_name)} {svc.category_name}
              </NeoBadge>
            )}
          </div>
          {svc.description && <p className="mb-3 text-base text-main-foreground/70 line-clamp-2">{svc.description}</p>}

          {showNota ? (
            <div className="grid grid-cols-2 gap-2">
              <NeoCard className="p-5 text-center">
                <p className="text-xs font-black uppercase tracking-wider text-foreground/60">Digitación</p>
                <p className="mt-1 text-lg font-black text-foreground">{fmtMoney(svc.digitacion_price)}</p>
              </NeoCard>
              <NeoCard className="p-5 text-center">
                <p className="text-xs font-black uppercase tracking-wider text-foreground/60">Notarización</p>
                <p className="mt-1 text-lg font-black text-foreground">{fmtMoney(svc.notarizacion_price)}</p>
              </NeoCard>
            </div>
          ) : (
            <NeoCard className="p-5 text-center">
              <p className="text-xs font-black uppercase tracking-wider text-foreground/60">Precio</p>
              <p className="mt-1 text-xl font-black text-foreground">{fmtMoney(svc.digitacion_price)}</p>
            </NeoCard>
          )}

          {showTiers && (
            <NeoButton
              variant="neutral"
              size="sm"
              onClick={() => toggleTiers(svc.id)}
              className="mt-3 self-start"
            >
              <Layers size={14} /> {svc.price_tiers!.length} rangos {tiersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </NeoButton>
          )}

          <AnimatePresence>
            {tiersOpen && showTiers && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                <NeoCard className="mt-3 p-4 space-y-3">
                  {svc.price_tiers!.map((t, i) => (
                    <NeoCard key={i} variant="main" className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-base font-black text-main-foreground">{t.label || `Rango ${i + 1}`}</span>
                          <span className="text-sm text-main-foreground/70">{t.min.toLocaleString("es-DO")} — {t.max === null || t.max === undefined ? "∞" : t.max.toLocaleString("es-DO")}</span>
                        </div>
                        <span className="text-base font-black text-main-foreground">RD$ {t.price.toLocaleString("es-DO")}</span>
                      </div>
                    </NeoCard>
                  ))}
                </NeoCard>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1" />
          <div className="mt-4 flex items-center justify-end gap-2 border-t-2 border-main-foreground/30 pt-3">
            <NeoButton variant="neutral" size="sm" onClick={() => openEdit(svc)}><Pencil size={14} /> Editar</NeoButton>
            <NeoButton variant="outline" size="sm" onClick={() => handleDelete(svc.id)}><Trash2 size={14} /> Eliminar</NeoButton>
          </div>
        </NeoCard>
      </motion.div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     HOME VIEW
     ═══════════════════════════════════════════════════════════════ */
  const HomeView = () => (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <NeoCard variant="main" className="inline-flex max-w-full flex-row items-center gap-3 px-4 py-3 sm:px-6">
          <Sparkles className="h-8 w-8 text-main-foreground" />
          <div className="min-w-0 text-left">
            <h1 className="break-words font-heading text-2xl font-black uppercase tracking-wide text-main-foreground sm:text-4xl sm:tracking-wider md:text-5xl">Catálogo de Precios</h1>
            <p className="text-base font-black text-main-foreground/70">Servicios y tarifas</p>
          </div>
        </NeoCard>
        <p className="mt-3 text-base font-bold text-main">{services.length} servicios · 3 categorías</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {Object.keys(GROUP_MAP).map((group) => {
          const stats = groupStats[group];
          return (
            <button
              key={group}
              onClick={() => { setSelectedGroup(group); setSelectedSubcat("all"); setSearch(""); }}
              className="group flex flex-col items-center gap-4 rounded-base border-2 border-border bg-main p-8 text-main-foreground shadow-shadow transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none"
            >
              <span className="text-6xl drop-shadow-lg transition-transform group-hover:scale-110">{GROUP_EMOJIS[group]}</span>
              <h2 className="text-center text-xl md:text-2xl font-black uppercase tracking-wide">{group}</h2>
              <div className="flex flex-wrap justify-center gap-1">
                {stats?.subcats.slice(0, 4).map((sub) => (
                  <NeoBadge key={sub} variant="neutral" className="px-3 py-1.5 text-xs">
                    {getCategoryEmoji(sub)} {sub}
                  </NeoBadge>
                ))}
                {(stats?.subcats.length || 0) > 4 && <NeoBadge variant="outline" className="px-3 py-1.5 text-xs">+{(stats?.subcats.length || 0) - 4}</NeoBadge>}
              </div>
              <div className="flex gap-2">
                <NeoBadge variant="neutral" className="px-4 py-2 text-xs">{stats?.count || 0} servicios</NeoBadge>
                {stats?.hasNota && <NeoBadge variant="neutral" className="px-4 py-2 text-xs">✍️ Nota</NeoBadge>}
              </div>
              {stats && stats.count > 0 && <p className="text-base font-bold text-main-foreground/60">{fmtMoney(stats.min)} — {fmtMoney(stats.max)}</p>}
            </button>
          );
        })}
      </div>
      <div className="flex justify-center gap-2">
        {["💎", "🔵", "🟦", "🔷", "💠"].map((e, i) => <span key={i} className="text-xl opacity-40">{e}</span>)}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     GROUP VIEW
     ═══════════════════════════════════════════════════════════════ */
  const GroupView = () => {
    if (!selectedGroup) return null;
    const stats = groupStats[selectedGroup];
    const subcatKeys = Object.keys(servicesBySubcat).sort();

    return (
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4">
          <NeoButton variant="neutral" onClick={() => { setSelectedGroup(null); setSelectedSubcat("all"); }}>
            <ArrowLeft size={16} /> Volver
          </NeoButton>
          <NeoCard variant="main" className="flex flex-row items-center gap-3 px-5 py-3">
            <span className="text-3xl">{GROUP_EMOJIS[selectedGroup]}</span>
            <div>
              <h2 className="font-heading text-xl md:text-2xl font-black uppercase text-main-foreground">{selectedGroup}</h2>
              <p className="text-base font-bold text-main-foreground/70">{filteredServices.length} de {stats?.count || 0} servicios</p>
            </div>
          </NeoCard>
          <NeoButton onClick={openCreate} className="ml-auto"><Plus size={18} /> Nuevo</NeoButton>
        </div>

        {/* Sub-category chips */}
        <div className="flex flex-wrap gap-2">
          <NeoButton
            variant={selectedSubcat === "all" ? "default" : "neutral"}
            size="sm"
            onClick={() => setSelectedSubcat("all")}
          >
            🗂️ Todos
          </NeoButton>
          {stats?.subcats.map((sub) => (
            <NeoButton
              key={sub}
              variant={selectedSubcat === sub ? "default" : "neutral"}
              size="sm"
              onClick={() => setSelectedSubcat((p) => (p === sub ? "all" : sub))}
            >
              {getCategoryEmoji(sub)} {sub}
            </NeoButton>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50" />
          <NeoInput
            type="text"
            placeholder={`Buscar en ${selectedGroup}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12"
          />
        </div>

        {/* Services */}
        {filteredServices.length === 0 ? (
          <NeoCard variant="outline" className="border-dashed p-12 text-center">
            <span className="text-4xl">🕸️</span>
            <p className="mt-2 text-lg font-bold text-foreground">No hay servicios aquí</p>
            <p className="text-base text-foreground/70">Prueba con otra búsqueda o subcategoría</p>
          </NeoCard>
        ) : selectedSubcat !== "all" ? (
          /* Single sub-category — flat grid */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>{filteredServices.map((svc, idx) => <ServiceCard key={svc.id} svc={svc} idx={idx} />)}</AnimatePresence>
          </div>
        ) : (
          /* "All" — grouped by sub-category with section headers */
          <div className="flex flex-col gap-8">
            {subcatKeys.map((subcat) => (
              <div key={subcat} className="flex flex-col gap-3">
                {/* Section header */}
                <div className="flex items-center gap-3">
                  <div className="h-1 flex-1 bg-main" />
                  <NeoButton
                    variant="default"
                    onClick={() => setSelectedSubcat(subcat)}
                  >
                    <span className="text-lg">{getCategoryEmoji(subcat)}</span> {subcat}
                    <NeoBadge variant="neutral" className="ml-1 px-3 py-1.5 text-xs">{servicesBySubcat[subcat].length}</NeoBadge>
                  </NeoButton>
                  <div className="h-1 flex-1 bg-main" />
                </div>
                {/* Cards */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence>{servicesBySubcat[subcat].map((svc, idx) => <ServiceCard key={svc.id} svc={svc} idx={idx} />)}</AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     MODAL
     ═══════════════════════════════════════════════════════════════ */
  const Modal = () => {
    if (!showModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
        <NeoCard className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between border-b-2 border-border pb-4">
            <h3 className="font-heading text-xl md:text-2xl font-black text-foreground">{editingService ? "✏️ Editar Servicio" : "➕ Nuevo Servicio"}</h3>
            <NeoButton variant="ghost" size="icon" onClick={() => setShowModal(false)}><X size={20} /></NeoButton>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-base font-black uppercase tracking-wider text-foreground/60">Nombre del servicio *</label>
              <NeoInput type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Acto de Venta - Bien Inmueble" />
            </div>
            <div>
              <label className="mb-1 block text-base font-black uppercase tracking-wider text-foreground/60">Categoría</label>
              <NeoSelect value={form.category_id || ""} onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value ? Number(e.target.value) : null }))}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{getCategoryEmoji(c.name)} {c.name}</option>)}
              </NeoSelect>
            </div>
            <div>
              <label className="mb-1 block text-base font-black uppercase tracking-wider text-foreground/60">Descripción</label>
              
                <textarea className="flex min-h-[80px] w-full rounded-base border-2 border-border bg-secondary-background px-4 py-2 text-base font-base text-foreground placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2" value={form.description || ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descripción opcional..." />
              
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-base font-black uppercase tracking-wider text-foreground/60">Precio / Digitación (RD$) *</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground/50" />
                  <NeoInput type="number" min={0} step="1" onKeyDown={preventDecimalInput} value={form.digitacion_price} onChange={(e) => setForm((p) => ({ ...p, digitacion_price: Number(e.target.value) }))} className="pl-9" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-base font-black uppercase tracking-wider text-foreground/60">Notarización (RD$)</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground/50" />
                  <NeoInput type="number" min={0} step="1" onKeyDown={preventDecimalInput} value={form.notarizacion_price} onChange={(e) => setForm((p) => ({ ...p, notarizacion_price: Number(e.target.value) }))} className="pl-9" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-base font-black uppercase tracking-wider text-foreground/60">Unidad</label>
                <div className="relative">
                  <Package size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-foreground/50" />
                  <NeoInput type="text" value={form.unit_type || ""} onChange={(e) => setForm((p) => ({ ...p, unit_type: e.target.value }))} className="pl-9" placeholder="por documento" />
                </div>
              </div>
            </div>
            <NeoCard variant="outline" className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-base font-black uppercase tracking-wider text-foreground/60">Rangos de precio (por valor del bien)</label>
                <NeoButton size="sm" onClick={addTier}><Plus size={14} /> Agregar rango</NeoButton>
              </div>
              {(form.price_tiers || []).length === 0 ? <p className="text-base text-foreground/50">Sin rangos. El precio será fijo.</p> : (
                <div className="space-y-3">
                  {(form.price_tiers || []).map((tier, idx) => (
                    <div key={idx} className="grid grid-cols-1 gap-2 rounded-base border-2 border-border bg-secondary-background p-4 sm:grid-cols-5">
                      <NeoInput type="text" placeholder="Etiqueta" value={tier.label} onChange={(e) => updateTier(idx, "label", e.target.value)} className="sm:col-span-2" />
                      <NeoInput type="number" step="1" onKeyDown={preventDecimalInput} placeholder="Mín" value={tier.min} onChange={(e) => updateTier(idx, "min", Number(e.target.value))} />
                      <NeoInput type="number" step="1" onKeyDown={preventDecimalInput} placeholder="Máx (vacío = ∞)" value={tier.max === null || tier.max === undefined ? "" : tier.max} onChange={(e) => { const val = e.target.value; updateTier(idx, "max", val === "" ? null : Number(val)); }} />
                      <div className="flex items-center gap-2">
                        <NeoInput type="number" step="1" onKeyDown={preventDecimalInput} placeholder="Precio" value={tier.price} onChange={(e) => updateTier(idx, "price", Number(e.target.value))} className="flex-1" />
                        <NeoButton variant="outline" size="icon" onClick={() => removeTier(idx)}><Trash2 size={14} /></NeoButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </NeoCard>
          </div>
          <div className="mt-6 flex items-center justify-end gap-3 border-t-2 border-border pt-4">
            <NeoButton variant="outline" onClick={() => setShowModal(false)}>Cancelar</NeoButton>
            <NeoButton onClick={handleSave} disabled={saving}><Save size={16} /> {saving ? "Guardando..." : "Guardar"}</NeoButton>
          </div>
        </NeoCard>
      </div>
    );
  };

  return (
    <div className="custom-scroll flex h-full flex-col gap-6 overflow-y-auto p-6">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-main">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-border border-t-main" />
          <p className="text-xl md:text-2xl font-black">Cargando precios...</p>
        </div>
      ) : selectedGroup ? <GroupView /> : <HomeView />}
      <Modal />
    </div>
  );
}
