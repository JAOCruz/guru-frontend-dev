import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Users,
  Tag,
  Play,
  Download,
  X,
  Loader2,
  ArrowLeft,
  Brain,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import api from "../services/api";
import {
  NeoCard,
  NeoCardContent,
  NeoCardHeader,
  NeoCardTitle,
} from "@guru/ui";
import { NeoButton } from "@guru/ui";
import { NeoInput } from "@guru/ui";
import { NeoBadge } from "@guru/ui";
import { notify } from "../lib/dialogs";

interface DocCategory {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  templates: DocTemplate[] | null;
}

interface DocTemplate {
  id: number;
  name: string;
  slug: string;
  description: string;
  doc_type: string;
  required_roles: string[];
  category_name?: string;
}

interface DocVariable {
  tag: string;
  description: string;
  is_rol_dynamic: boolean;
  rol_type: string;
}

/* ── Neo-Brutalist Category Styles ── */
const CAT_STYLES: Record<string, { emoji: string; tagline: string }> = {
  notificaciones: {
    emoji: "📢",
    tagline: "¡Avisos oficiales con estilo!",
  },
  "contratos-civiles": {
    emoji: "📜",
    tagline: "Papelitos que salvan vidas 💼",
  },
  "instancias-y-escritos": {
    emoji: "⚖️",
    tagline: "Justicia digital al instante",
  },
};

const SUBCAT_EMOJIS: Record<string, string> = {
  "contratos-bajo-firma-privada": "✍️",
  "contratos-autenticos": "🔏",
  instancias: "📨",
  recursos: "📤",
  demandas: "⚔️",
  avisos: "📰",
  "bienes-traslativos": "🚗",
  "rentas-o-alquileres": "🏠",
  laboral: "💼",
  comerciales: "🏪",
  financieros: "💰",
  acuerdos: "🤝",
  "protocolo-notarial": "📜",
  inmobiliaria: "🏗️",
  natalidad: "👶",
  "poderes-y-autorizaciones-especiales": "⚡",
  "estado-civil": "💍",
  "herencia-o-familiaridad": "👨‍👩‍👧‍👦",
  vehiculos: "🚙",
  "embarcacion-nave-maritima": "⛵",
  ganado: "🐄",
  inmuebles: "🏡",
  "punto-comercial": "🏬",
  "maquina-industrial": "⚙️",
  agrimensura: "📐",
};

const DEFAULT_SUBCAT_EMOJI = "📁";

/* ── Tree Helpers ── */
const getDescendants = (parentId: number, allCats: DocCategory[]): DocCategory[] => {
  const children = allCats.filter((c) => c.parent_id === parentId);
  const grandchildren = children.flatMap((c) => getDescendants(c.id, allCats));
  return [...children, ...grandchildren];
};

const getTemplateEmoji = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes("VEHICULO") || n.includes("AUTO")) return "🚗";
  if (n.includes("INMUEBLE") || n.includes("CASA") || n.includes("APARTAMENTO"))
    return "🏠";
  if (n.includes("ALQUILER") || n.includes("ARRIENDO")) return "🔑";
  if (n.includes("PODER")) return "⚡";
  if (n.includes("HERENCIA") || n.includes("FAMILIAR")) return "👨‍👩‍👧‍👦";
  if (n.includes("NOTARIO") || n.includes("NOTARIAL")) return "📜";
  if (n.includes("ALGUACIL") || n.includes("NOTIFICACION")) return "📢";
  if (n.includes("DEMANDA") || n.includes("DEMANDO")) return "⚔️";
  if (n.includes("INSTANCIA") || n.includes("SOLICITUD")) return "📨";
  if (n.includes("ACUERDO") || n.includes("TRANSACCION")) return "🤝";
  if (n.includes("COMODATO") || n.includes("USO GRATUITO")) return "🎁";
  if (n.includes("COMPRA") || n.includes("VENTA")) return "💵";
  if (n.includes("CONTRATO")) return "📄";
  return "📋";
};

export default function MotherBrain() {
  /* ── State ── */
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocTemplate | null>(null);
  const [templateDetail, setTemplateDetail] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Test generation modal
  const [showModal, setShowModal] = useState(false);
  const [testData, setTestData] = useState<Record<string, string>>({});
  const [testRoles, setTestRoles] = useState<Record<string, Record<string, string>>>({});
  const [generating, setGenerating] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<string | null>(null);
  const [generatedSessionId, setGeneratedSessionId] = useState<number | null>(null);

  /* ── Derived: parent/child grouping ── */
  const parentCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null),
    [categories]
  );

  const activeParent = useMemo(
    () => parentCategories.find((c) => c.slug === selectedCategory) || null,
    [parentCategories, selectedCategory]
  );

  const activeDescendants = useMemo(() => {
    if (!activeParent) return [];
    return getDescendants(activeParent.id, categories);
  }, [activeParent, categories]);

  // Leaf categories = categories that actually have templates (any level)
  const leafCategories = useMemo(() => {
    if (!activeParent) return [];
    const allInTree = activeParent.templates?.length
      ? [activeParent, ...activeDescendants]
      : activeDescendants;
    return allInTree.filter((c) => (c.templates?.length || 0) > 0);
  }, [activeParent, activeDescendants]);

  // Templates to display
  const displayedTemplates = useMemo(() => {
    if (!activeParent) return [];
    let source: DocCategory[];
    if (selectedSubcategory) {
      const cat = categories.find((c) => c.slug === selectedSubcategory);
      source = cat ? [cat] : [];
    } else {
      // "Todos" — show all templates from entire subtree
      source = activeParent.templates?.length
        ? [activeParent, ...activeDescendants]
        : activeDescendants;
    }
    const all: DocTemplate[] = [];
    source.forEach((c) => {
      if (c.templates) all.push(...c.templates);
    });
    if (search) {
      return all.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
    }
    return all;
  }, [activeParent, activeDescendants, categories, selectedSubcategory, search]);

  /* ── Effects ── */
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get("/docgen/categories");
      // Normalize null templates to []
      const normalized = (res.data.categories || []).map((c: DocCategory) => ({
        ...c,
        templates: c.templates || [],
      }));
      setCategories(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectCategory = (slug: string) => {
    setSelectedCategory(slug);
    setSelectedSubcategory(null);
    setSelectedTemplate(null);
    setTemplateDetail(null);
    setSearch("");
  };

  const selectSubcategory = (slug: string) => {
    setSelectedSubcategory(slug);
    setSelectedTemplate(null);
    setTemplateDetail(null);
  };

  const selectTemplate = async (t: DocTemplate) => {
    setSelectedTemplate(t);
    setGeneratedFile(null);
    try {
      const res = await api.get(`/docgen/templates/${t.id}`);
      setTemplateDetail(res.data);
      const initData: Record<string, string> = {};
      const initRoles: Record<string, Record<string, string>> = {};
      if (res.data.variables) {
        res.data.variables.forEach((v: DocVariable) => {
          if (!v.is_rol_dynamic) initData[v.tag] = "";
        });
      }
      if (res.data.requiredRoles) {
        Object.keys(res.data.requiredRoles).forEach((role: string) => {
          initRoles[role] = {};
          res.data.requiredRoles[role].forEach((field: string) => {
            initRoles[role][field] = "";
          });
        });
      }
      setTestData(initData);
      setTestRoles(initRoles);
    } catch (err) {
      console.error(err);
    }
  };

  const openTestModal = () => {
    setShowModal(true);
    setGeneratedFile(null);
  };

  const runTestGeneration = async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    try {
      const sessionRes = await api.post("/docgen/sessions", {
        templateId: selectedTemplate.id,
      });
      const sessionId = sessionRes.data.session.id;
      await api.put(`/docgen/sessions/${sessionId}/data`, {
        collectedData: testData,
        assignedRoles: testRoles,
      });
      const genRes = await api.post(`/docgen/sessions/${sessionId}/generate`);
      setGeneratedFile(genRes.data.fileName);
      setGeneratedSessionId(sessionId);
    } catch (err: any) {
      console.error("Generation failed:", err);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.details ||
        err.message ||
        "Error desconocido";
      notify(`Error generando documento: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  const downloadGeneratedFile = async () => {
    if (!generatedSessionId) return;
    try {
      const res = await api.get(`/docgen/sessions/${generatedSessionId}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", generatedFile || "documento.docx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Download failed:", err);
      notify("Error descargando documento. Revisa la consola.");
    }
  };

  const clearSelection = () => {
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSelectedTemplate(null);
    setTemplateDetail(null);
    setSearch("");
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-main">
        <Loader2 className="h-10 w-10 animate-spin" />
        <span className="ml-3 text-lg font-base font-bold">Cargando Mother Brain...</span>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     HOME VIEW — 3 Big Neo-Brutalist Category Cards
     ═══════════════════════════════════════════════════════════════ */
  const HomeView = () => (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="text-center">
        <NeoCard variant="main" className="inline-flex w-auto flex-row items-center gap-3 px-6 py-3">
          <Brain className="h-8 w-8" />
          <h1 className="font-heading text-4xl uppercase tracking-wider md:text-5xl">
            Mother Brain
          </h1>
          <Sparkles className="h-6 w-6" />
        </NeoCard>
        <p className="mt-4 text-base font-base font-bold text-foreground/70">
          🧠 Sistema de Generación de Documentos Legales
        </p>
        <p className="text-sm font-base text-foreground/50">
          161 plantillas · 3 categorías · 1 cerebro
        </p>
      </div>

      {/* 3 Category Cards */}
      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
        {parentCategories.map((cat) => {
          const style = CAT_STYLES[cat.slug] || CAT_STYLES["notificaciones"];
          const descendants = getDescendants(cat.id, categories);
          const leafCount = descendants.filter(
            (c) => (c.templates?.length || 0) > 0
          ).length;
          const tmplCount =
            (cat.templates?.length || 0) +
            descendants.reduce(
              (sum, c) => sum + (c.templates?.length || 0),
              0
            );

          return (
            <NeoCard
              key={cat.id}
              variant="main"
              className="group flex h-full cursor-pointer flex-col items-center gap-4 p-6 text-center transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none"
              onClick={() => selectCategory(cat.slug)}
            >
              <span className="flex h-20 items-center justify-center text-5xl transition-transform group-hover:scale-110">
                {style.emoji}
              </span>
              <h2 className="line-clamp-2 min-h-[4rem] font-heading text-xl uppercase tracking-wide md:text-2xl">
                {cat.name}
              </h2>
              <p className="line-clamp-2 min-h-[3.5rem] text-base font-base opacity-80">
                {style.tagline}
              </p>
              <div className="mt-auto flex w-full flex-wrap items-center justify-center gap-2">
                <NeoBadge variant="main" className="px-4 py-2">{tmplCount} docs</NeoBadge>
                {leafCount > 0 && (
                  <NeoBadge variant="outline" className="px-4 py-2">{leafCount} subcat</NeoBadge>
                )}
              </div>
              <ChevronRight className="mt-1 h-6 w-6 opacity-60 transition-opacity group-hover:opacity-100" />
            </NeoCard>
          );
        })}
      </div>

      {/* Decorative footer */}
      <div className="flex justify-center gap-2">
        {["🔵", "🟦", "🔷", "💠", "🔹"].map((e, i) => (
          <span key={i} className="text-xl opacity-40">
            {e}
          </span>
        ))}
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════
     CATEGORY VIEW — Subcategories + Templates
     ═══════════════════════════════════════════════════════════════ */
  const CategoryView = () => {
    if (!activeParent) return null;
    const style = CAT_STYLES[activeParent.slug] || CAT_STYLES["notificaciones"];

    return (
      <div className="flex flex-col gap-6">
        {/* Category Header */}
        <div className="flex flex-wrap items-center gap-4">
          <NeoButton variant="neutral" size="sm" onClick={clearSelection}>
            <ArrowLeft size={16} />
            Volver
          </NeoButton>
          <NeoCard variant="main" className="inline-flex w-auto flex-row items-center gap-3 px-5 py-3">
            <span className="text-3xl">{style.emoji}</span>
            <div>
              <h2 className="font-heading text-xl uppercase md:text-2xl">{activeParent.name}</h2>
              <p className="text-sm font-base opacity-70">
                {displayedTemplates.length} documentos
              </p>
            </div>
          </NeoCard>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/50" />
          <NeoInput
            type="text"
            placeholder="🔍 Buscar plantilla..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12"
          />
        </div>

        {/* Subcategory Chips — show ALL leaf categories with templates */}
        {leafCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <NeoButton
              variant={!selectedSubcategory ? "default" : "neutral"}
              size="sm"
              onClick={() => setSelectedSubcategory(null)}
            >
              🗂️ Todos
            </NeoButton>
            {leafCategories.map((child) => {
              const isActive = selectedSubcategory === child.slug;
              const emoji = SUBCAT_EMOJIS[child.slug] || DEFAULT_SUBCAT_EMOJI;
              return (
                <NeoButton
                  key={child.id}
                  variant={isActive ? "default" : "neutral"}
                  size="sm"
                  onClick={() => selectSubcategory(child.slug)}
                >
                  {emoji} {child.name}
                </NeoButton>
              );
            })}
          </div>
        )}

        {/* Templates Grid */}
        {displayedTemplates.length === 0 ? (
          <NeoCard variant="outline" className="items-center p-12 text-center">
            <span className="text-4xl">🕸️</span>
            <p className="mt-2 text-base font-base font-bold text-foreground/70">
              No hay documentos aquí
            </p>
            <p className="text-sm font-base text-foreground/50">
              Prueba con otra búsqueda o subcategoría
            </p>
          </NeoCard>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {displayedTemplates.map((t) => {
              const emoji = getTemplateEmoji(t.name);
              const isSelected = selectedTemplate?.id === t.id;
              return (
                <NeoCard
                  key={t.id}
                  variant={isSelected ? "main" : "neutral"}
                  className="cursor-pointer gap-3 p-5 text-left transition-all hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none active:translate-x-boxShadowX active:translate-y-boxShadowY active:shadow-none"
                  onClick={() => selectTemplate(t)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-base font-bold">
                        {t.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {t.required_roles?.length > 0 && (
                          <NeoBadge variant="main" className="px-3 py-1.5">
                            <Users size={10} className="mr-1" />
                            {t.required_roles.length} roles
                          </NeoBadge>
                        )}
                        <NeoBadge variant="outline" className="px-3 py-1.5">{t.doc_type}</NeoBadge>
                      </div>
                    </div>
                  </div>
                </NeoCard>
              );
            })}
          </div>
        )}

        {/* Template Detail Panel (inline when selected) */}
        {selectedTemplate && templateDetail && (
          <NeoCard variant="main">
            <NeoCardHeader className="flex-row items-start justify-between">
              <div>
                <div className="text-sm font-base font-black uppercase tracking-wider opacity-80">
                  {templateDetail.template?.category_name}
                </div>
                <NeoCardTitle>{selectedTemplate.name}</NeoCardTitle>
                <p className="mt-1 text-base font-base opacity-80">
                  {selectedTemplate.description || "Sin descripción"}
                </p>
              </div>
              <NeoButton
                variant="neutral"
                size="icon"
                onClick={() => {
                  setSelectedTemplate(null);
                  setTemplateDetail(null);
                }}
              >
                <X size={16} />
              </NeoButton>
            </NeoCardHeader>

            <NeoCardContent className="gap-4">
              {/* Required Roles */}
              {templateDetail.requiredRoles &&
                Object.keys(templateDetail.requiredRoles).length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-base font-base font-black">
                      <Users size={16} />
                      Roles Requeridos
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(templateDetail.requiredRoles).map(
                        ([role, fields]: [string, any]) => (
                          <NeoBadge key={role} variant="main" className="px-3 py-1.5">
                            {role}
                            <span className="ml-1 opacity-70">({fields.length} campos)</span>
                          </NeoBadge>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* Variables */}
              {templateDetail.variables && templateDetail.variables.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-base font-base font-black">
                    <Tag size={16} />
                    Variables ({templateDetail.variables.length})
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {templateDetail.variables.map((v: DocVariable) => (
                      <NeoCard
                        key={v.tag}
                        variant={v.is_rol_dynamic ? "main" : "neutral"}
                        className="p-4"
                      >
                        <div className="font-mono text-sm font-bold">{v.tag}</div>
                        {v.description && (
                          <div className="mt-1 text-xs font-base opacity-70">
                            {v.description}
                          </div>
                        )}
                      </NeoCard>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <NeoButton variant="reverse" size="sm" onClick={openTestModal}>
                  <Play size={16} />
                  Probar Generación
                </NeoButton>
                {generatedSessionId && (
                  <NeoButton variant="neutral" size="sm" onClick={downloadGeneratedFile}>
                    <Download size={16} />
                    Descargar Último
                  </NeoButton>
                )}
              </div>
            </NeoCardContent>
          </NeoCard>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="custom-scroll flex h-full flex-col gap-6 overflow-y-auto p-6">
      {selectedCategory ? <CategoryView /> : <HomeView />}

      {/* Test Generation Modal */}
      {showModal && selectedTemplate && templateDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <NeoCard className="max-h-[90vh] w-full max-w-3xl overflow-hidden p-0">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-border bg-secondary-background p-5">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🧪</span>
                <div>
                  <h3 className="font-heading text-lg md:text-xl">
                    Probar: {selectedTemplate.name}
                  </h3>
                  <p className="text-sm font-base text-foreground/70">
                    Llena los datos de prueba y genera el documento
                  </p>
                </div>
              </div>
              <NeoButton
                variant="neutral"
                size="icon"
                onClick={() => setShowModal(false)}
              >
                <X size={18} />
              </NeoButton>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 custom-scroll">
              {/* Role inputs */}
              {Object.entries(templateDetail.requiredRoles || {}).map(
                ([role, fields]: [string, any]) => (
                  <div key={role} className="mb-6">
                    <div className="mb-3 flex items-center gap-2 text-base font-base font-black">
                      <span>👤</span> {role}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {fields.map((field: string) => (
                        <div key={`${role}-${field}`}>
                          <label className="mb-1 block text-xs font-black uppercase tracking-wider text-foreground/60">
                            {field}
                          </label>
                          <NeoInput
                            type="text"
                            value={testRoles[role]?.[field] || ""}
                            onChange={(e) =>
                              setTestRoles((prev) => ({
                                ...prev,
                                [role]: { ...prev[role], [field]: e.target.value },
                              }))
                            }
                            placeholder={`${field}...`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* Field inputs */}
              {templateDetail.variables?.filter((v: DocVariable) => !v.is_rol_dynamic)
                .length > 0 && (
                <div className="mb-6">
                  <div className="mb-3 flex items-center gap-2 text-base font-base font-black">
                    <span>📝</span> Datos Adicionales
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {templateDetail.variables
                      .filter((v: DocVariable) => !v.is_rol_dynamic)
                      .map((v: DocVariable) => (
                        <div key={v.tag}>
                          <label className="mb-1 block text-xs font-black uppercase tracking-wider text-foreground/60">
                            {v.tag}
                          </label>
                          <NeoInput
                            type="text"
                            value={testData[v.tag] || ""}
                            onChange={(e) =>
                              setTestData((prev) => ({
                                ...prev,
                                [v.tag]: e.target.value,
                              }))
                            }
                            placeholder={v.description || v.tag}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Generated file */}
              {generatedFile && generatedSessionId && (
                <NeoCard variant="neutral" className="mb-4 p-5">
                  <div className="flex items-center gap-2 text-base font-base font-black">
                    <Download size={16} />
                    Documento generado: {generatedFile}
                  </div>
                  <NeoButton
                    variant="default"
                    size="sm"
                    onClick={downloadGeneratedFile}
                    className="mt-3"
                  >
                    <Download size={16} />
                    Descargar Documento .docx
                  </NeoButton>
                </NeoCard>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 border-t-2 border-border bg-secondary-background p-5">
              <NeoButton
                variant="default"
                size="lg"
                onClick={runTestGeneration}
                disabled={generating}
                className="flex-1"
              >
                {generating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    Generar Documento
                  </>
                )}
              </NeoButton>
            </div>
          </NeoCard>
        </div>
      )}
    </div>
  );
}
