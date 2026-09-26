import React, { useState, useMemo, useEffect } from "react";
import { ExcelRow, WorkerKey } from "../../services/excelService";
import { servicesAPI } from "../../services/api";
import { NeoButton } from "@guru/ui";
import { NeoInput } from "@guru/ui";
import {
  Trash2,
  MessageCircle,
  Sparkles,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "../../utils";
import { useUserColors } from "../../context/UserColorsContext";
import { generateInsight } from "../../services/ai";

// --- TIPOS ---
interface AdminDataTableProps {
  data: ExcelRow[];
  onSort: (column: string, direction: "asc" | "desc") => void;
  onServiceDeleted?: () => void;
  employeePercentage: number;
  isEmployeeView?: boolean;
  currentEmployee?: string;
  workers: string[];
  inactiveWorkers?: Set<string>;
}

interface UserServiceEntry {
  service: string;
  earnings: number;
  client: string;
  time: string;
  comment?: string;
  id?: number;
}

type GroupedUserData = Record<WorkerKey, UserServiceEntry[]>;


const AdminDataTable: React.FC<AdminDataTableProps> = ({
  data,
  onServiceDeleted,
  employeePercentage,
  isEmployeeView = false,
  currentEmployee,
  workers,
  inactiveWorkers,
}) => {
  const { appearanceOfColumn } = useUserColors();
  // --- ESTADOS ---
  const [activeUser, setActiveUser] = useState<WorkerKey | "all">(
    isEmployeeView && currentEmployee ? (currentEmployee as WorkerKey) : "all",
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>("");

  // Pagination state
  const ITEMS_PER_PAGE = 10;
  const [pageByUser, setPageByUser] = useState<Record<WorkerKey, number>>({});

  const getCurrentPage = (user: WorkerKey) => pageByUser[user] || 1;

  const getTotalPages = (user: WorkerKey) =>
    Math.max(1, Math.ceil((groupedData[user] ?? []).length / ITEMS_PER_PAGE));

  const getPaginatedData = (user: WorkerKey) => {
    const all = groupedData[user] ?? [];
    const page = Math.min(getCurrentPage(user), getTotalPages(user));
    const start = (page - 1) * ITEMS_PER_PAGE;
    return all.slice(start, start + ITEMS_PER_PAGE);
  };

  // Estados IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInsight, setAiInsight] = useState("");

  // --- LÓGICA DE DATOS ---
  const groupDataByUser = (): GroupedUserData => {
    const groupedData = workers.reduce<GroupedUserData>((acc, user) => {
      acc[user] = [];
      return acc;
    }, {} as GroupedUserData);

    const findDetailValue = (
      currentIndex: number,
      detailType: string,
      user: WorkerKey,
    ) => {
      const searchOffsets = [1, 2, 3, 4];
      for (const offset of searchOffsets) {
        const candidate = data[currentIndex + offset];
        if (candidate && candidate.DETALLE === detailType)
          return candidate[user];
      }
      return undefined;
    };

    const findServiceId = (
      currentIndex: number,
      user: WorkerKey,
    ): number | undefined => {
      const searchOffsets = [-3, -2, -1, 0, 1, 2, 3];
      const userIdKey = `${user}_id`;
      for (const offset of searchOffsets) {
        const candidate = data[currentIndex + offset];
        if (candidate && candidate.DETALLE === "SERVICIO" && candidate[user]) {
          if (candidate[userIdKey]) return Number(candidate[userIdKey]);
          if (candidate.id) return Number(candidate.id);
        }
      }
      return undefined;
    };

    data.forEach((row, index) => {
      if (row.DETALLE !== "SERVICIO") return;

      workers.forEach((user) => {
        const serviceValue = row[user];
        if (!serviceValue) return;

        const earnings = Number(findDetailValue(index, "GANANCIA", user)) || 0;
        const clientValue = findDetailValue(index, "CLIENTE", user);
        const timeValue = findDetailValue(index, "HORA", user);
        const commentValue = findDetailValue(index, "NOTA", user);

        let serviceId = row[`${user}_id`]
          ? Number(row[`${user}_id`])
          : row.id
            ? Number(row.id)
            : findServiceId(index, user);

        groupedData[user].push({
          service: String(serviceValue),
          earnings,
          client: clientValue ? String(clientValue) : "",
          time: timeValue ? String(timeValue) : "",
          comment: commentValue ? String(commentValue) : "",
          id: serviceId,
        });
      });
    });
    return groupedData;
  };

  const groupedData = useMemo(() => groupDataByUser(), [data, workers]);

  // Clamp pages when data changes to avoid empty pages after deletions
  useEffect(() => {
    setPageByUser((prev) => {
      const next: Record<WorkerKey, number> = { ...prev };
      workers.forEach((user) => {
        const total = Math.max(1, Math.ceil((groupedData[user] ?? []).length / ITEMS_PER_PAGE));
        next[user] = Math.min(prev[user] || 1, total);
      });
      return next;
    });
  }, [groupedData]);

  const calculateUserTotals = () => {
    const totals: any = {};
    workers.forEach((user) => {
      const total = (groupedData[user] ?? []).reduce(
        (acc, s) => acc + (Number(s.earnings) || 0),
        0,
      );
      totals[user] = {
        total,
        adminShare: total * (1 - employeePercentage / 100),
        userShare: total * (employeePercentage / 100),
      };
    });
    return totals;
  };

  const userTotals = useMemo(
    () => calculateUserTotals(),
    [groupedData, employeePercentage],
  );

  const adminTotal = workers.reduce(
    (acc, user) => acc + (userTotals[user]?.adminShare ?? 0),
    0,
  );

  // --- HANDLERS ---
  const handleDelete = async (serviceId: number | undefined) => {
    if (!serviceId) return;
    if (!window.confirm("¿Eliminar servicio?")) return;
    try {
      setDeletingId(serviceId);
      await servicesAPI.deleteService(serviceId);
      onServiceDeleted?.();
    } catch (error) {
      console.error(error);
      alert("Error al eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditComment = (id: string, current: string) => {
    setEditingCommentId(id);
    setCommentText(current);
  };

  const handleSaveComment = async (
    serviceId: number | undefined,
    userId: string,
    index: number,
  ) => {
    if (!serviceId) return;
    try {
      await servicesAPI.updateComment(serviceId, commentText);
      setEditingCommentId(null);
      onServiceDeleted?.();
    } catch (error) {
      console.error(error);
    }
  };

  // --- GEMINI AI HANDLER ---
  const handleGenerateInsights = async () => {
    setAiModalOpen(true);
    setAiLoading(true);
    setAiInsight("");

    const userToAnalyze =
      activeUser === "all" ? "Todos los usuarios" : activeUser;
    const statsText =
      activeUser === "all"
        ? `Total Global: ${adminTotal}`
        : `Usuario: ${activeUser}, Total: ${userTotals[activeUser]?.total ?? 0}`;

    const contextData =
      activeUser === "all"
        ? workers.map((u) => ({
            user: u,
            total: userTotals[u]?.total ?? 0,
            count: (groupedData[u] ?? []).length,
          }))
        : (groupedData[activeUser] ?? []).map((s) => ({ s: s.service, m: s.earnings }));

    const prompt = `
      Actúa como gerente de "Gurú Soluciones". Analiza estos datos del día:
      Contexto: ${userToAnalyze}. Estadísticas: ${statsText}.
      Detalle simplificado: ${JSON.stringify(contextData).slice(0, 1000)}...
      
      Dame 3 puntos clave muy breves (con emojis):
      1. Rendimiento general.
      2. Servicio destacado o empleado destacado.
      3. Una recomendación corta.
    `;

    try {
      setAiInsight(await generateInsight(prompt));
    } finally {
      setAiLoading(false);
    }
  };

  // --- RENDER ---
  const usersToRender = activeUser === "all" || !workers.includes(activeUser) ? workers : [activeUser];

  return (
    <div className="animate-in fade-in space-y-8 duration-500">
      {/* 1. HEADER: Tabs y Botón IA */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-base border-2 border-border bg-main p-5 shadow-shadow md:flex-row">
        {!isEmployeeView && (
          <div className="flex w-full flex-wrap gap-2 md:w-auto">
            <NeoButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveUser("all")}
              className={
                activeUser === "all"
                  ? "bg-main text-main-foreground border-border hover:bg-main"
                  : "bg-white text-foreground border-border hover:bg-secondary-background"
              }
            >
              Todos
            </NeoButton>
            {workers.map((user) => {
              const a = appearanceOfColumn(user);
              const active = activeUser === user;
              return (
                <NeoButton
                  key={user}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveUser(user)}
                  style={
                    active
                      ? { backgroundColor: a.color.bg, color: a.color.text }
                      : { backgroundColor: "#ffffff", color: "#000000", borderColor: a.color.bg }
                  }
                >
                  {a.emoji && <span className="mr-1">{a.emoji}</span>}
                  {user.replace("_", " ")}
                </NeoButton>
              );
            })}
          </div>
        )}

        <NeoButton
          type="button"
          variant="reverse"
          onClick={handleGenerateInsights}
        >
          <Sparkles size={18} />
          Insights IA
        </NeoButton>
      </div>

      {/* 2. TABLAS / LISTAS DE SERVICIOS */}
      {usersToRender.map((user) => {
        const a = appearanceOfColumn(user);
        return (
        <div
          key={user}
          className="overflow-hidden rounded-base border-2 border-border bg-background shadow-shadow"
        >
          {/* Header de la Tabla */}
          <div
            className="flex flex-col gap-3 border-b-2 border-border p-5 sm:flex-row sm:items-center sm:justify-between"
            style={{ backgroundColor: a.color.bg, color: a.color.text }}
          >
            <h3 className="font-heading text-lg font-black uppercase tracking-wider md:text-xl">
              {a.emoji && <span className="mr-2">{a.emoji}</span>}
              {user.replace("_", " ")}
              {inactiveWorkers?.has(user) && (
                <span className="ml-3 rounded-full border-2 border-current px-2 py-0.5 align-middle text-xs normal-case tracking-normal">
                  Desactivado
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-4 font-mono text-sm">
              <span className="font-bold uppercase tracking-widest opacity-90">
                Total:{" "}
                <span>{formatCurrency(userTotals[user].total)}</span>
              </span>
              <span className="font-bold uppercase tracking-widest opacity-90">
                Admin:{" "}
                <span>{formatCurrency(userTotals[user].adminShare)}</span>
              </span>
            </div>
          </div>

          {/* VISTA ESCRITORIO (Tabla) */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="border-b-2 border-border bg-secondary-background">
                <tr>
                  <th className="p-5 text-xs font-black uppercase tracking-wider text-foreground/70">
                    Hora
                  </th>
                  <th className="p-5 text-xs font-black uppercase tracking-wider text-foreground/70">
                    Servicio / Cliente
                  </th>
                  <th className="p-5 text-xs font-black uppercase tracking-wider text-foreground/70">
                    Ganancia
                  </th>
                  <th className="p-5 text-xs font-black uppercase tracking-wider text-foreground/70">
                    Participación
                  </th>
                  <th className="p-5 text-xs font-black uppercase tracking-wider text-foreground/70">
                    Nota
                  </th>
                  <th className="p-5 text-center text-xs font-black uppercase tracking-wider text-foreground/70">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(groupedData[user] ?? []).length > 0 ? (
                  getPaginatedData(user).map((item, idx) => {
                    const isEditing = editingCommentId === `${user}-${idx}`;
                    return (
                      <tr
                        key={`${user}-${idx}`}
                        className="transition-colors hover:bg-secondary-background"
                      >
                        <td className="p-5 font-mono text-base text-foreground/70">
                          {item.time || "--:--"}
                        </td>
                        <td className="p-5">
                          <div className="text-base font-bold text-foreground">
                            {item.service}
                          </div>
                          <div className="mt-1 text-base text-foreground/70">
                            {item.client || "Cliente General"}
                          </div>
                        </td>
                        <td className="p-5 font-mono text-base font-bold text-foreground">
                          {formatCurrency(item.earnings)}
                        </td>
                        <td className="p-5">
                          <div className="flex flex-col gap-1 font-mono text-sm">
                            <span className="font-bold tracking-widest text-foreground/60 uppercase">
                              Admin:{" "}
                              <span className="text-foreground">
                                {formatCurrency(
                                  item.earnings *
                                    (1 - employeePercentage / 100),
                                )}
                              </span>
                            </span>
                            <span className="font-bold tracking-widest text-foreground/60 uppercase">
                              User:{" "}
                              <span className="text-main">
                                {formatCurrency(
                                  item.earnings * (employeePercentage / 100),
                                )}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="p-5">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <NeoInput
                                autoFocus
                                className="h-9 px-2 py-1 text-sm"
                                value={commentText}
                                onChange={(e) =>
                                  setCommentText(e.target.value)
                                }
                              />
                              <NeoButton
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  handleSaveComment(item.id, user, idx)
                                }
                              >
                                <Check size={16} />
                              </NeoButton>
                              <NeoButton
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => setEditingCommentId(null)}
                              >
                                <X size={16} />
                              </NeoButton>
                            </div>
                          ) : (
                            <div
                              onClick={() =>
                                handleEditComment(
                                  `${user}-${idx}`,
                                  item.comment || "",
                                )
                              }
                              className="group/edit flex cursor-pointer items-center gap-2 text-base text-foreground/70 transition-colors hover:text-foreground"
                            >
                              <span className="max-w-[180px] truncate italic">
                                {item.comment || "Agregar nota..."}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <NeoButton
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                            >
                              <MessageCircle size={16} />
                            </NeoButton>
                            <NeoButton
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 hover:border-red-600 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingId === item.id}
                            >
                              {deletingId === item.id ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </NeoButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-base text-foreground/60 italic"
                    >
                      Sin servicios registrados hoy
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* VISTA MÓVIL (Tarjetas) */}
          <div className="divide-y divide-border md:hidden">
            {(groupedData[user] ?? []).length > 0 ? (
              getPaginatedData(user).map((item, idx) => (
                <div key={`${user}-m-${idx}`} className="bg-background p-5">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold break-words leading-tight text-foreground">
                        {item.service}
                      </p>
                      <p className="mt-1 text-base text-foreground/60">
                        {item.client || "Cliente General"}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-lg font-black text-foreground">
                      {formatCurrency(item.earnings)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-mono text-sm text-foreground/60">
                      <span className="whitespace-nowrap">
                        {item.time || "--:--"}
                      </span>
                      {item.comment && (
                        <span className="truncate rounded-base border border-border bg-secondary-background px-3 py-1.5 text-foreground/90">
                          {item.comment}
                        </span>
                      )}
                    </div>
                    <NeoButton
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 hover:border-red-600 hover:bg-red-50 hover:text-red-600"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </NeoButton>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-base text-foreground/60 italic">
                Sin servicios registrados hoy
              </div>
            )}
          </div>

          {/* Pagination */}
          {(groupedData[user] ?? []).length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between border-t-2 border-border bg-secondary-background p-4">
              <span className="text-sm font-bold text-foreground/70">
                Página {getCurrentPage(user)} de {getTotalPages(user)}
              </span>
              <div className="flex gap-2">
                <NeoButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPageByUser((prev) => ({ ...prev, [user]: Math.max(1, getCurrentPage(user) - 1) }))}
                  disabled={getCurrentPage(user) <= 1}
                >
                  Anterior
                </NeoButton>
                <NeoButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPageByUser((prev) => ({ ...prev, [user]: Math.min(getTotalPages(user), getCurrentPage(user) + 1) }))}
                  disabled={getCurrentPage(user) >= getTotalPages(user)}
                >
                  Siguiente
                </NeoButton>
              </div>
            </div>
          )}
        </div>
        );
      })}

      {/* MODAL IA */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div className="w-full max-w-lg rounded-base border-2 border-border bg-background p-6 shadow-shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-heading text-2xl font-black text-foreground">
                <Sparkles className="text-main" size={24} /> Análisis IA
              </h3>
              <NeoButton
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAiModalOpen(false)}
              >
                <X size={18} />
              </NeoButton>
            </div>
            <div className="min-h-[150px] rounded-base border-2 border-border bg-secondary-background p-5 text-base leading-relaxed whitespace-pre-wrap text-foreground">
              {aiLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground/60">
                  <Loader2 className="animate-spin text-main" size={32} />
                  <p>Analizando transacciones...</p>
                </div>
              ) : (
                aiInsight
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDataTable;
