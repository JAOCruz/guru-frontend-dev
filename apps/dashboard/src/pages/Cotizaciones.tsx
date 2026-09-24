import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  Download,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  FileText,
  Calendar,
  User,
  Phone,
  Printer,
  RefreshCw,
  Maximize2,
  X,
  Plus,
  Trash2,
  Send,
  MessageSquare,
} from "lucide-react";
import api, { getAPIUrl } from "../services/api";
import { botAPI, BotClient } from "../services/botApi";
import { useAuth } from "../context/AuthContext";
import { NeoCard, NeoButton, NeoBadge } from "@guru/ui";
import { fetchAuthenticatedFile, preventDecimalInput } from "../utils";

interface QuotationItem {
  desc?: string;
  name?: string;
  cantidad?: number;
  quantity?: number;
  precio?: number;
  unitPrice?: number;
  itbis?: boolean;
}

interface Quotation {
  id: number;
  doc_number: string;
  client_name: string;
  client_phone: string;
  client_id?: number | null;
  type: string;
  items: QuotationItem[];
  total: number;
  subtotal?: number;
  itbis?: number;
  discount_type?: "percentage" | "fixed" | "coupon" | null;
  discount_value?: number;
  discount_amount?: number;
  discount_code?: string | null;
  discount_reason?: string | null;
  status: "draft" | "pending_approval" | "approved" | "sent" | "paid" | "rejected";
  pdf_path: string;
  created_at: string;
  created_by?: number;
  created_by_name?: string;
  rejected_by?: number;
  rejected_by_name?: string;
  rejected_at?: string;
  notes?: string;
  payment_method?: string | null;
  payment_reference?: string | null;
}

export default function Cotizaciones() {
  const { isAdmin, user } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfFullscreen, setPdfFullscreen] = useState(false);
  // Payment confirmation modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");

  // Create / edit invoice/quotation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [createType, setCreateType] = useState<"COTIZACIÓN" | "FACTURA">("COTIZACIÓN");
  const [createClientName, setCreateClientName] = useState("");
  const [createClientPhone, setCreateClientPhone] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createItems, setCreateItems] = useState<QuotationItem[]>([
    { desc: "", cantidad: 1, precio: 0, itbis: false },
  ]);
  // Discounts are admin-only
  const [createDiscountType, setCreateDiscountType] = useState<"percentage" | "fixed" | "coupon" | "">("");
  const [createDiscountValue, setCreateDiscountValue] = useState<string>("");
  const [createDiscountCode, setCreateDiscountCode] = useState<string>("");
  const [createDiscountReason, setCreateDiscountReason] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Client selection for linking the invoice/quotation
  const [clients, setClients] = useState<BotClient[]>([]);
  const [createClientId, setCreateClientId] = useState<string | "">("");
  const [loadingClients, setLoadingClients] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<"ALL" | "COTIZACIÓN" | "FACTURA">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Quotation["status"]>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);

  // Reject / delete
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchQuotations();
  }, []);

  useEffect(() => {
    if (!showCreateModal && !editingQuotation) return;
    const loadClients = async () => {
      setLoadingClients(true);
      try {
        const { data } = await botAPI.getAllClients();
        setClients(data.clients || []);
      } catch (err) {
        console.error("Failed to load clients", err);
      } finally {
        setLoadingClients(false);
      }
    };
    loadClients();
  }, [showCreateModal, editingQuotation]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadUsers = async () => {
      try {
        const { data } = await api.get("/users");
        setUsers(data.users || data || []);
      } catch (err) {
        console.error("Failed to load users", err);
      }
    };
    loadUsers();
  }, [isAdmin]);

  const fetchQuotations = async (): Promise<Quotation[]> => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (typeFilter !== "ALL") params.type = typeFilter;
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (creatorFilter !== "ALL") params.created_by = creatorFilter;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const { data } = await api.get("/invoices", { params });
      const list: Quotation[] = data.invoices || [];
      setQuotations(list);
      setError(null);
      return list;
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Error loading quotations");
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchQuotations();
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, searchQuery, creatorFilter, dateFrom, dateTo]);

  const resetCreateForm = () => {
    setCreateType("COTIZACIÓN");
    setCreateClientId("");
    setCreateClientName("");
    setCreateClientPhone("");
    setCreateNotes("");
    setCreateItems([{ desc: "", cantidad: 1, precio: 0, itbis: false }]);
    setCreateDiscountType("");
    setCreateDiscountValue("");
    setCreateDiscountCode("");
    setCreateDiscountReason("");
    setCreateError(null);
  };

  const addCreateItem = () => {
    setCreateItems((prev) => [...prev, { desc: "", cantidad: 1, precio: 0, itbis: false }]);
  };

  const removeCreateItem = (idx: number) => {
    setCreateItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCreateItem = (idx: number, field: keyof QuotationItem, value: any) => {
    setCreateItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const createTotals = useMemo(() => {
    const subtotal = createItems.reduce(
      (sum, item) => sum + (Number(item.cantidad) || 0) * (Number(item.precio) || 0),
      0
    );
    const itbis = createItems.some((item) => item.itbis)
      ? createItems.reduce(
          (sum, item) =>
            item.itbis
              ? sum + (Number(item.cantidad) || 0) * (Number(item.precio) || 0) * 0.18
              : sum,
          0
        )
      : 0;
    const discountValueNum = Number(createDiscountValue) || 0;
    let discountAmount = 0;
    if (isAdmin && createDiscountType === "percentage") {
      discountAmount = subtotal * (discountValueNum / 100);
    } else if (isAdmin && (createDiscountType === "fixed" || createDiscountType === "coupon")) {
      discountAmount = discountValueNum;
    }
    discountAmount = Math.min(discountAmount, subtotal);
    return { subtotal, itbis, discountAmount, total: Math.max(0, subtotal + itbis - discountAmount) };
  }, [createItems, createDiscountType, createDiscountValue, isAdmin]);

  const handleCreate = async () => {
    if (!createClientName.trim()) {
      setCreateError("El nombre del cliente es obligatorio");
      return;
    }
    const validItems = createItems.filter(
      (item) => item.desc?.trim() && (Number(item.precio) || 0) > 0
    );
    if (validItems.length === 0) {
      setCreateError("Agrega al menos un artículo válido");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const payload: any = {
        type: createType,
        clientId: createClientId ? Number(createClientId) : undefined,
        clientName: createClientName.trim(),
        clientPhone: createClientPhone.trim() || undefined,
        items: validItems.map((item) => ({
          desc: item.desc,
          cantidad: Number(item.cantidad) || 1,
          precio: Number(item.precio) || 0,
          itbis: !!item.itbis,
        })),
        notes: createNotes.trim() || undefined,
      };
      if (isAdmin && createDiscountType) {
        payload.discountType = createDiscountType;
        payload.discountValue = Number(createDiscountValue) || 0;
        if (createDiscountType === "coupon") {
          payload.discountCode = createDiscountCode.trim() || undefined;
        }
        payload.discountReason = createDiscountReason.trim() || undefined;
      }
      await api.post("/invoices", payload);
      setShowCreateModal(false);
      resetCreateForm();
      await fetchQuotations();
    } catch (err: any) {
      console.error(err);
      setCreateError(err?.response?.data?.error || "Error creando documento");
    } finally {
      setCreating(false);
    }
  };

  const handleSelectQuotation = (quote: Quotation) => {
    setSelectedQuotation(quote);
    setShowRightPanel(true);
  };

  const handleApprove = async () => {
    if (!selectedQuotation) return;
    try {
      await api.post(`/invoices/${selectedQuotation.id}/approve`);
      const list = await fetchQuotations();
      // Refresh selected quotation data (use the freshly returned list, not stale state)
      const refreshed = list.find((q) => q.id === selectedQuotation.id);
      if (refreshed) setSelectedQuotation(refreshed);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedQuotation) return;
    setConfirmingPayment(true);
    try {
      await api.post(`/invoices/${selectedQuotation.id}/confirm-payment`, {
        payment_method: "manual",
        payment_reference: paymentReference.trim() || undefined,
      });
      setShowPaymentModal(false);
      setPaymentReference("");
      const list = await fetchQuotations();
      const refreshed = list.find((q) => q.id === selectedQuotation.id);
      if (refreshed) setSelectedQuotation(refreshed);
      else setSelectedQuotation((prev) => (prev ? { ...prev, status: "paid" } : prev));
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Error confirmando pago");
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleEditOpen = (quote: Quotation) => {
    setEditingQuotation(quote);
    setCreateType(quote.type as "COTIZACIÓN" | "FACTURA");
    setCreateClientName(quote.client_name || "");
    setCreateClientPhone(quote.client_phone || "");
    setCreateNotes(quote.notes || "");
    setCreateItems(
      Array.isArray(quote.items) && quote.items.length > 0
        ? quote.items.map((item) => ({
            desc: item.desc || item.name || "",
            cantidad: item.cantidad || item.quantity || 1,
            precio: item.precio || item.unitPrice || 0,
            itbis: !!item.itbis,
          }))
        : [{ desc: "", cantidad: 1, precio: 0, itbis: false }]
    );
    setCreateDiscountType(quote.discount_type || "");
    setCreateDiscountValue(quote.discount_value ? String(quote.discount_value) : "");
    setCreateDiscountCode(quote.discount_code || "");
    setCreateDiscountReason(quote.discount_reason || "");
    if (quote.client_id && clients.length > 0) {
      setCreateClientId(String(quote.client_id));
    } else {
      setCreateClientId("");
    }
    setShowCreateModal(true);
  };

  const handleEdit = async () => {
    if (!editingQuotation) return;
    if (!createClientName.trim()) {
      setCreateError("El nombre del cliente es obligatorio");
      return;
    }
    const validItems = createItems.filter(
      (item) => item.desc?.trim() && (Number(item.precio) || 0) > 0
    );
    if (validItems.length === 0) {
      setCreateError("Agrega al menos un artículo válido");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const payload: any = {
        type: createType,
        clientName: createClientName.trim(),
        clientPhone: createClientPhone.trim() || undefined,
        items: validItems.map((item) => ({
          desc: item.desc,
          cantidad: Number(item.cantidad) || 1,
          precio: Number(item.precio) || 0,
          itbis: !!item.itbis,
        })),
        notes: createNotes.trim() || undefined,
      };
      if (isAdmin) {
        payload.discountType = createDiscountType || undefined;
        payload.discountValue = createDiscountType ? Number(createDiscountValue) || 0 : undefined;
        payload.discountCode = createDiscountType === "coupon" ? createDiscountCode.trim() || undefined : undefined;
        payload.discountReason = createDiscountReason.trim() || undefined;
      }
      await api.put(`/invoices/${editingQuotation.id}`, payload);
      setShowCreateModal(false);
      setEditingQuotation(null);
      resetCreateForm();
      const list = await fetchQuotations();
      const refreshed = list.find((q) => q.id === editingQuotation.id);
      if (refreshed) setSelectedQuotation(refreshed);
    } catch (err: any) {
      console.error(err);
      setCreateError(err?.response?.data?.error || "Error editando documento");
    } finally {
      setCreating(false);
    }
  };

  const handleReject = async () => {
    if (!selectedQuotation) return;
    setRejecting(true);
    try {
      await api.post(`/invoices/${selectedQuotation.id}/reject`, {
        reason: rejectReason.trim() || undefined,
      });
      setShowRejectModal(false);
      setRejectReason("");
      const list = await fetchQuotations();
      const refreshed = list.find((q) => q.id === selectedQuotation.id);
      if (refreshed) setSelectedQuotation(refreshed);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Error rechazando documento");
    } finally {
      setRejecting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedQuotation) return;
    setDeleting(true);
    try {
      await api.delete(`/invoices/${selectedQuotation.id}`);
      setShowDeleteModal(false);
      setSelectedQuotation(null);
      setShowRightPanel(false);
      await fetchQuotations();
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Error eliminando documento");
    } finally {
      setDeleting(false);
    }
  };

  const [sending, setSending] = useState(false);
  // Generate (or regenerate) the PDF for PREVIEW without changing the invoice status.
  // Available in any status — fixes invoices processed to paid without ever generating a PDF.
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const handleGeneratePdf = async () => {
    if (!selectedQuotation) return;
    setGeneratingPdf(true);
    try {
      await api.post(`/invoices/${selectedQuotation.id}/generate-pdf`);
      const list = await fetchQuotations();
      const refreshed = list.find((q) => q.id === selectedQuotation.id);
      if (refreshed) setSelectedQuotation(refreshed);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Error generando el PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };
  const handleSendInvoice = async () => {
    if (!selectedQuotation) return;
    setSending(true);
    try {
      await api.post(`/invoices/${selectedQuotation.id}/send`);
      const list = await fetchQuotations();
      const refreshed = list.find((q) => q.id === selectedQuotation.id);
      if (refreshed) setSelectedQuotation(refreshed);
      alert("Documento enviado y PDF generado.");
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Error enviando documento");
    } finally {
      setSending(false);
    }
  };

  const rawPdfUrl = useMemo(() => {
    if (!selectedQuotation?.pdf_path) return null;
    const filename = selectedQuotation.pdf_path.split("/").pop();
    return `${getAPIUrl()}/api/invoices/pdf/${filename}`;
  }, [selectedQuotation]);

  useEffect(() => {
    if (!rawPdfUrl) {
      setPdfBlobUrl(null);
      return;
    }

    let revoked = false;
    setPdfLoading(true);
    fetchAuthenticatedFile(rawPdfUrl)
      .then((url) => {
        if (!revoked) setPdfBlobUrl(url);
      })
      .catch((err) => {
        console.error("Failed to load PDF:", err);
        setPdfBlobUrl(null);
      })
      .finally(() => setPdfLoading(false));

    return () => {
      revoked = true;
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [rawPdfUrl]);

  const statusBadgeVariant: Record<Quotation["status"], "neutral" | "main" | "outline"> = {
    draft: "neutral",
    pending_approval: "main",
    approved: "main",
    sent: "outline",
    paid: "main",
    rejected: "outline",
  };

  const statusLabel: Record<Quotation["status"], string> = {
    draft: "Borrador",
    pending_approval: "Por aprobar",
    approved: "Aprobada",
    sent: "Enviada",
    paid: "Pagada",
    rejected: "Rechazada",
  };

  return (
    <div
      className="-m-3 md:-m-8 flex overflow-hidden bg-background text-foreground"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* ═══════ LEFT PANEL — Quotations List ═══════ */}
      <div
        className={`${
          showRightPanel ? "hidden md:flex" : "flex"
        } w-full md:w-80 flex-shrink-0 flex-col overflow-hidden border-r-2 border-border bg-secondary-background`}
      >
        <div className="border-b-2 border-border bg-secondary-background p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-base border-2 border-border bg-main text-main-foreground shadow-button">
              <FileText size={20} />
            </div>
            <h2 className="font-heading text-4xl md:text-5xl font-black">Cotizaciones</h2>
          </div>
          <p className="mt-2 text-base text-foreground/70">
            {quotations.length} documento{quotations.length !== 1 && "s"}
            {isAdmin && quotations.filter((q) => q.status === "pending_approval").length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-base border-2 border-orange-500 bg-orange-500/10 px-2 py-0.5 text-sm font-black text-orange-600">
                {quotations.filter((q) => q.status === "pending_approval").length} por aprobar
              </span>
            )}
          </p>

          {/* Search */}
          <div className="mt-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por número, cliente o teléfono..."
              className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
            />
          </div>

          {/* Type filter */}
          <div className="mt-3 flex gap-1">
            {(
              [
                ["ALL", "Todos"],
                ["COTIZACIÓN", "Cotizaciones"],
                ["FACTURA", "Facturas"],
              ] as const
            ).map(([val, label]) => (
              <NeoButton
                key={val}
                onClick={() => setTypeFilter(val)}
                variant={typeFilter === val ? "default" : "neutral"}
                size="sm"
                className="flex-1 text-xs"
              >
                {label}
              </NeoButton>
            ))}
          </div>

          {/* Status filter */}
          <div className="mt-3">
            <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">
              Estado
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Quotation["status"] | "ALL")}
              className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground outline-none focus:border-main"
            >
              <option value="ALL">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="pending_approval">Por aprobar</option>
              <option value="approved">Aprobada</option>
              <option value="sent">Enviada</option>
              <option value="paid">Pagada</option>
              <option value="rejected">Rechazada</option>
            </select>
          </div>

          {/* Creator filter (admin only) */}
          {isAdmin && users.length > 0 && (
            <div className="mt-3">
              <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">
                Creador
              </label>
              <select
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value)}
                className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground outline-none focus:border-main"
              >
                <option value="ALL">Todos los creadores</option>
                {users.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.name || `Usuario ${u.id}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date range */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">
                Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-base border-2 border-border bg-background px-2 py-2 font-base text-sm text-foreground outline-none focus:border-main"
              />
            </div>
            <div>
              <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">
                Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-base border-2 border-border bg-background px-2 py-2 font-base text-sm text-foreground outline-none focus:border-main"
              />
            </div>
          </div>

          {(typeFilter !== "ALL" ||
            statusFilter !== "ALL" ||
            searchQuery ||
            creatorFilter !== "ALL" ||
            dateFrom ||
            dateTo) && (
            <div className="mt-3">
              <NeoButton
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setTypeFilter("ALL");
                  setStatusFilter("ALL");
                  setSearchQuery("");
                  setCreatorFilter("ALL");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Limpiar filtros
              </NeoButton>
            </div>
          )}

          <NeoButton
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            className="mt-3 w-full"
            size="sm"
          >
            <Plus size={16} />
            Nueva cotización / factura
          </NeoButton>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-foreground/50">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-main" />
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-foreground">
            <NeoBadge variant="outline" className="text-base">{error}</NeoBadge>
          </div>
        ) : quotations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-foreground/50">
            <FileText size={40} className="mb-3 opacity-40" />
            <p className="text-base font-medium">No hay documentos</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scroll p-3 space-y-2">
            {quotations.map((quote) => (
              <button
                key={quote.id}
                onClick={() => handleSelectQuotation(quote)}
                className={`relative w-full text-left rounded-base border-2 p-4 transition-all ${
                  selectedQuotation?.id === quote.id
                    ? "border-border bg-secondary-background shadow-shadow"
                    : "border-transparent hover:border-border hover:bg-secondary-background"
                }`}
              >
                <div className="absolute right-2 top-2">
                  <NeoBadge variant={statusBadgeVariant[quote.status]} className="text-xs">
                    {statusLabel[quote.status]}
                  </NeoBadge>
                </div>
                <div className="flex items-center justify-between gap-2 pr-20">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">
                      {quote.doc_number}
                    </p>
                    <p className="truncate text-base text-foreground/70">
                      {quote.client_name}
                    </p>
                  </div>
                  {quote.client_phone && (
                    <Link
                      to={`/bot-messages?phone=${encodeURIComponent(quote.client_phone)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-base border-2 border-border bg-main text-main-foreground shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                      title="Ver chat"
                    >
                      <MessageSquare size={16} />
                    </Link>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-base">
                  <p className="font-medium text-foreground/90">
                    RD$ {quote.total.toLocaleString("es-DO")}
                  </p>
                  <p className="text-foreground/50">
                    {new Date(quote.created_at).toLocaleDateString("es-DO")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══════ RIGHT PANEL — PDF Showcase ═══════ */}
      {selectedQuotation && (
        <div
          className={`${
            !showRightPanel ? "hidden" : "flex"
          } flex-1 flex-col overflow-hidden bg-background`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-border bg-secondary-background px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <NeoButton
                variant="ghost"
                size="icon"
                onClick={() => setShowRightPanel(false)}
                className="md:hidden"
              >
                <ChevronLeft size={20} />
              </NeoButton>
              <div className="min-w-0">
                <h3 className="truncate font-heading text-lg">
                  {selectedQuotation.doc_number}
                </h3>
                <p className="truncate text-base text-foreground/70">
                  {selectedQuotation.client_name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Details (mobile / small screens) */}
              <NeoButton
                variant="outline"
                size="icon"
                onClick={() => setShowDetails((v) => !v)}
                className="lg:hidden"
                title={showDetails ? "Ocultar detalles" : "Ver detalles"}
              >
                {showDetails ? <EyeOff size={16} /> : <Eye size={16} />}
              </NeoButton>

              {/* Download */}
              {pdfBlobUrl && (
                <NeoButton
                  variant="neutral"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = pdfBlobUrl;
                    a.download = `${selectedQuotation.doc_number}.pdf`;
                    a.click();
                  }}
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Descargar</span>
                </NeoButton>
              )}

              {/* Fullscreen */}
              {pdfBlobUrl && (
                <NeoButton
                  variant="neutral"
                  size="sm"
                  onClick={() => setPdfFullscreen(true)}
                  title="Ver en pantalla completa"
                >
                  <Maximize2 size={14} />
                  <span className="hidden sm:inline">Ampliar</span>
                </NeoButton>
              )}

              {/* Print */}
              {pdfBlobUrl && (
                <NeoButton
                  variant="neutral"
                  size="sm"
                  onClick={() => window.open(pdfBlobUrl, "_blank")}
                >
                  <Printer size={14} />
                  <span className="hidden sm:inline">Imprimir</span>
                </NeoButton>
              )}

              <NeoBadge
                variant={statusBadgeVariant[selectedQuotation.status]}
                className="hidden sm:inline-flex text-xs"
              >
                {statusLabel[selectedQuotation.status]}
              </NeoBadge>
            </div>
          </div>

          {/* Content — Split View */}
          <div className="flex flex-1 overflow-hidden">
            {/* Details Sidebar */}
            <div
              className={`${
                showDetails ? "flex" : "hidden"
              } w-full flex-col overflow-y-auto border-r-2 border-border bg-secondary-background p-4 custom-scroll lg:flex lg:w-80`}
            >
              {/* Client Card */}
              <NeoCard className="mb-4 p-4">
                <p className="mb-2 text-base font-black uppercase tracking-widest text-foreground/60">
                  Cliente
                </p>
                <div className="flex items-center gap-2 text-base font-semibold">
                  <User size={16} className="text-main" />
                  {selectedQuotation.client_name}
                </div>
                {selectedQuotation.client_phone && (
                  <div className="mt-1.5 flex items-center gap-2 text-base text-foreground/70">
                    <Phone size={16} />
                    {selectedQuotation.client_phone}
                  </div>
                )}
                {selectedQuotation.client_phone ? (
                  <Link
                    to={`/bot-messages?phone=${encodeURIComponent(selectedQuotation.client_phone)}`}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-base border-2 border-border bg-main px-4 py-2.5 text-base font-black text-main-foreground shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                  >
                    <MessageSquare size={18} />
                    Ver chat con cliente
                  </Link>
                ) : (
                  <div className="mt-3 rounded-base border-2 border-border bg-secondary-background px-4 py-2.5 text-center text-sm font-semibold text-foreground/60">
                    Cliente sin teléfono registrado
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 text-base text-foreground/60">
                  <Calendar size={16} />
                  {new Date(selectedQuotation.created_at).toLocaleDateString("es-DO", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </NeoCard>

              {/* Items */}
              <div className="mb-4">
                <p className="mb-2 text-base font-black uppercase tracking-widest text-foreground/60">
                  Artículos ({selectedQuotation.items?.length || 0})
                </p>
                <div className="space-y-2">
                  {selectedQuotation.items?.map((item, i) => (
                    <NeoCard key={i} className="p-3">
                      <p className="text-base font-medium">
                        {item.desc || item.name || `Artículo ${i + 1}`}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-base text-foreground/70">
                        <span>
                          {item.cantidad || item.quantity || 1} x RD${" "}
                          {(item.precio || item.unitPrice || 0).toLocaleString("es-DO")}
                        </span>
                        <span className="font-semibold text-foreground">
                          RD${" "}
                          {(
                            (item.cantidad || item.quantity || 1) *
                            (item.precio || item.unitPrice || 0)
                          ).toLocaleString("es-DO")}
                        </span>
                      </div>
                    </NeoCard>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <NeoCard variant="main" className="mb-4 p-4">
                {selectedQuotation.subtotal !== undefined && (
                  <div className="mb-1 flex items-center justify-between text-base text-main-foreground/80">
                    <span>Subtotal</span>
                    <span>RD$ {selectedQuotation.subtotal.toLocaleString("es-DO")}</span>
                  </div>
                )}
                {selectedQuotation.itbis ? (
                  <div className="mb-1 flex items-center justify-between text-base text-main-foreground/80">
                    <span>ITBIS (18%)</span>
                    <span>RD$ {selectedQuotation.itbis.toLocaleString("es-DO")}</span>
                  </div>
                ) : (
                  <div className="mb-2 flex items-center justify-between text-base text-main-foreground/70 italic">
                    <span>ITBIS no aplicado</span>
                  </div>
                )}
                {(selectedQuotation.discount_amount || 0) > 0 && (
                  <div className="mb-2 flex items-center justify-between text-base text-main-foreground/90">
                    <span>
                      Descuento
                      {selectedQuotation.discount_type === "percentage" &&
                        selectedQuotation.discount_value &&
                        ` (${selectedQuotation.discount_value}%)`}
                      {selectedQuotation.discount_type === "coupon" &&
                        selectedQuotation.discount_code &&
                        ` (${selectedQuotation.discount_code})`}
                    </span>
                    <span>-RD$ {selectedQuotation.discount_amount.toLocaleString("es-DO")}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t-2 border-main-foreground/30 pt-2">
                  <span className="text-base font-black uppercase tracking-wider text-main-foreground/80">
                    Total
                  </span>
                  <span className="font-heading text-xl md:text-2xl font-bold text-main-foreground">
                    RD$ {selectedQuotation.total.toLocaleString("es-DO")}
                  </span>
                </div>
              </NeoCard>

              {/* Notes */}
              {selectedQuotation.notes && (
                <NeoCard variant="outline" className="mb-4 p-4">
                  <p className="mb-1 text-base font-black uppercase tracking-wider text-foreground/80">
                    Notas
                  </p>
                  <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/80">
                    {selectedQuotation.notes}
                  </p>
                </NeoCard>
              )}

              {/* Payment info */}
              {selectedQuotation.status === "paid" && (
                <NeoCard variant="outline" className="mb-4 p-4">
                  <p className="mb-1 text-base font-black uppercase tracking-wider text-foreground/80">
                    Pago registrado
                  </p>
                  <div className="space-y-1 text-base text-foreground/80">
                    {selectedQuotation.payment_method && (
                      <p>
                        <span className="font-semibold">Método:</span>{" "}
                        {selectedQuotation.payment_method === "manual"
                          ? "Manual"
                          : selectedQuotation.payment_method}
                      </p>
                    )}
                    {selectedQuotation.payment_reference && (
                      <p>
                        <span className="font-semibold">Comprobante:</span>{" "}
                        {selectedQuotation.payment_reference}
                      </p>
                    )}
                    {!selectedQuotation.payment_method && !selectedQuotation.payment_reference && (
                      <p className="text-foreground/60">No hay detalles adicionales.</p>
                    )}
                  </div>
                </NeoCard>
              )}

              {/* Actions */}
              {isAdmin &&
                ["draft", "pending_approval"].includes(selectedQuotation.status) && (
                  <div className="mt-auto flex gap-2 pt-4">
                    <NeoButton onClick={handleApprove} className="flex-1">
                      <CheckCircle size={16} />
                      Aprobar
                    </NeoButton>
                    <NeoButton
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowRejectModal(true)}
                    >
                      <XCircle size={16} />
                      Rechazar
                    </NeoButton>
                  </div>
                )}

              {/* Admin edit/delete (primary fix path) */}
              {isAdmin && (
                <div className="mt-4 flex gap-2 pt-2 border-t-2 border-border">
                  <NeoButton
                    onClick={() => handleEditOpen(selectedQuotation)}
                    variant="neutral"
                    className="flex-1"
                  >
                    <FileText size={16} />
                    Editar
                  </NeoButton>
                  <NeoButton
                    onClick={() => setShowDeleteModal(true)}
                    variant="outline"
                    className="flex-1 border-red-500 text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                    Eliminar
                  </NeoButton>
                </div>
              )}

              {/* Employee edit on own drafts */}
              {!isAdmin &&
                selectedQuotation.status === "draft" &&
                selectedQuotation.created_by === user?.id && (
                  <div className="mt-4 flex gap-2 pt-2 border-t-2 border-border">
                    <NeoButton
                      onClick={() => handleEditOpen(selectedQuotation)}
                      variant="neutral"
                      className="flex-1"
                    >
                      <FileText size={16} />
                      Editar
                    </NeoButton>
                    <NeoButton
                      onClick={() => setShowDeleteModal(true)}
                      variant="outline"
                      className="flex-1 border-red-500 text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                      Eliminar
                    </NeoButton>
                  </div>
                )}

              {/* Admin: send draft / pending_approval / approved */}
              {isAdmin &&
                ["draft", "pending_approval", "approved"].includes(
                  selectedQuotation.status
                ) && (
                  <div className="mt-4 flex gap-2 pt-2 border-t-2 border-border">
                    <NeoButton
                      onClick={handleSendInvoice}
                      disabled={sending}
                      className="flex-1"
                    >
                      {sending ? (
                        <RefreshCw size={16} className="mr-1 animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      {selectedQuotation.status === "pending_approval"
                        ? "Aprobar y enviar"
                        : "Enviar documento"}
                    </NeoButton>
                  </div>
                )}

              {/* Employee: request approval on own drafts */}
              {!isAdmin &&
                selectedQuotation.status === "draft" &&
                selectedQuotation.created_by === user?.id && (
                  <div className="mt-4 flex gap-2 pt-2 border-t-2 border-border">
                    <NeoButton
                      onClick={handleSendInvoice}
                      disabled={sending}
                      className="flex-1"
                    >
                      {sending ? (
                        <RefreshCw size={16} className="mr-1 animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      Solicitar aprobación
                    </NeoButton>
                  </div>
                )}

              {/* Employee: send own approved invoices */}
              {!isAdmin &&
                selectedQuotation.status === "approved" &&
                selectedQuotation.created_by === user?.id && (
                  <div className="mt-4 flex gap-2 pt-2 border-t-2 border-border">
                    <NeoButton
                      onClick={handleSendInvoice}
                      disabled={sending}
                      className="flex-1"
                    >
                      {sending ? (
                        <RefreshCw size={16} className="mr-1 animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                      Enviar documento
                    </NeoButton>
                  </div>
                )}

              {isAdmin && selectedQuotation.status !== "paid" && (
                <div className="mt-4 flex gap-2 pt-2 border-t-2 border-border">
                  <NeoButton
                    onClick={() => setShowPaymentModal(true)}
                    disabled={confirmingPayment}
                    className="flex-1"
                  >
                    {confirmingPayment ? (
                      <RefreshCw size={16} className="mr-1 animate-spin" />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    Confirmar pago
                  </NeoButton>
                </div>
              )}
            </div>

            {/* PDF Viewer */}
            <div className="relative flex flex-1 flex-col bg-secondary-background">
              {pdfLoading ? (
                <div className="flex flex-1 flex-col items-center justify-center text-foreground/50">
                  <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border border-t-main" />
                  <p className="text-base font-medium text-foreground">
                    Cargando PDF…
                  </p>
                </div>
              ) : pdfBlobUrl ? (
                <object
                  data={pdfBlobUrl}
                  type="application/pdf"
                  className="h-full w-full"
                  aria-label={`Vista previa ${selectedQuotation.doc_number}`}
                >
                  <p className="text-foreground/50 text-center mt-8">
                    Tu navegador no puede mostrar PDFs.
                    <a href={pdfBlobUrl} download={`${selectedQuotation.doc_number}.pdf`} className="underline text-main ml-2">
                      Descargar
                    </a>
                  </p>
                </object>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-foreground/50">
                  <FileText size={48} className="mb-3 opacity-40" />
                  <p className="text-base font-medium text-foreground">
                    PDF no disponible
                  </p>
                  <p className="mt-1 text-base text-foreground/70">
                    Esta cotización aún no tiene un PDF generado.
                  </p>
                  <NeoButton
                    onClick={handleGeneratePdf}
                    disabled={generatingPdf}
                    className="mt-4"
                  >
                    {generatingPdf ? (
                      <RefreshCw size={16} className="mr-1 animate-spin" />
                    ) : (
                      <FileText size={16} />
                    )}
                    {generatingPdf ? "Generando..." : "Generar PDF"}
                  </NeoButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen PDF modal */}
      {pdfFullscreen && pdfBlobUrl && selectedQuotation && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
          onClick={() => setPdfFullscreen(false)}
        >
          <div className="flex items-center justify-between pb-2">
            <span className="font-base text-sm font-semibold text-white">
              {selectedQuotation.doc_number}.pdf
            </span>
            <button
              onClick={() => setPdfFullscreen(false)}
              className="rounded-base border-2 border-white/30 bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <X size={18} />
            </button>
          </div>
          <object
            data={pdfBlobUrl}
            type="application/pdf"
            className="flex-1 w-full rounded-base bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white text-center mt-8">
              Tu navegador no puede mostrar PDFs.
              <a href={pdfBlobUrl} download={`${selectedQuotation.doc_number}.pdf`} className="underline text-main ml-2">
                Descargar
              </a>
            </p>
          </object>
        </div>
      )}

      {/* Reject confirmation modal */}
      {showRejectModal && selectedQuotation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="w-full max-w-md rounded-base border-2 border-border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 font-heading text-lg font-black">Rechazar documento</h3>
            <p className="mb-4 text-base text-foreground/80">
              ¿Rechazar <strong>{selectedQuotation.doc_number}</strong>? El documento quedará marcado como rechazado y no podrá usarse.
            </p>
            <label className="mb-1 block font-base text-sm font-semibold text-foreground/80">
              Motivo (opcional)
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ej: precios incorrectos, cliente equivocado..."
              rows={3}
              className="mb-4 w-full resize-none rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
            />
            <div className="flex justify-end gap-2">
              <NeoButton
                variant="neutral"
                onClick={() => setShowRejectModal(false)}
                disabled={rejecting}
              >
                Cancelar
              </NeoButton>
              <NeoButton
                onClick={handleReject}
                disabled={rejecting}
                className="border-red-500 bg-red-500 text-white hover:bg-red-600"
              >
                {rejecting ? <RefreshCw size={16} className="mr-1 animate-spin" /> : <XCircle size={16} />}
                Rechazar
              </NeoButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && selectedQuotation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-md rounded-base border-2 border-border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 font-heading text-lg font-black">Eliminar documento</h3>
            <p className="mb-4 text-base text-foreground/80">
              ¿Eliminar permanentemente <strong>{selectedQuotation.doc_number}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <NeoButton
                variant="neutral"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancelar
              </NeoButton>
              <NeoButton
                onClick={handleDelete}
                disabled={deleting}
                className="border-red-500 bg-red-500 text-white hover:bg-red-600"
              >
                {deleting ? <RefreshCw size={16} className="mr-1 animate-spin" /> : <Trash2 size={16} />}
                Eliminar
              </NeoButton>
            </div>
          </div>
        </div>
      )}

      {/* Payment confirmation modal */}
      {showPaymentModal && selectedQuotation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowPaymentModal(false)}
        >
          <div
            className="w-full max-w-md rounded-base border-2 border-border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 font-heading text-lg font-black">Confirmar pago</h3>
            <p className="mb-4 text-base text-foreground/80">
              ¿Marcar <strong>{selectedQuotation.doc_number}</strong> como pagada?
            </p>
            <label className="mb-1 block font-base text-sm font-semibold text-foreground/80">
              Comprobante / referencia de pago (opcional)
            </label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="Ej: transferencia #12345, depósito bancario..."
              className="mb-4 w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
            />
            <div className="flex justify-end gap-2">
              <NeoButton
                variant="neutral"
                onClick={() => setShowPaymentModal(false)}
                disabled={confirmingPayment}
              >
                Cancelar
              </NeoButton>
              <NeoButton
                onClick={handleConfirmPayment}
                disabled={confirmingPayment}
              >
                {confirmingPayment ? <RefreshCw size={16} className="mr-1 animate-spin" /> : <CheckCircle size={16} />}
                Confirmar pago
              </NeoButton>
            </div>
          </div>
        </div>
      )}

      {/* Create quotation/invoice modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            setShowCreateModal(false);
            setEditingQuotation(null);
            resetCreateForm();
          }}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-base border-2 border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b-2 border-border bg-secondary-background px-4 py-3">
              <h3 className="font-heading text-lg font-black">
                {editingQuotation ? `Editar ${editingQuotation.doc_number}` : "Nueva cotización / factura"}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingQuotation(null);
                  resetCreateForm();
                }}
                className="rounded-base border-2 border-border bg-secondary-background p-1.5 text-foreground hover:bg-main hover:text-main-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="custom-scroll flex-1 overflow-y-auto p-4">
              {/* Type selector */}
              <div className="mb-4 flex gap-2">
                <NeoButton
                  type="button"
                  variant={createType === "COTIZACIÓN" ? "default" : "neutral"}
                  className="flex-1"
                  onClick={() => setCreateType("COTIZACIÓN")}
                >
                  Cotización
                </NeoButton>
                <NeoButton
                  type="button"
                  variant={createType === "FACTURA" ? "default" : "neutral"}
                  className="flex-1"
                  onClick={() => setCreateType("FACTURA")}
                >
                  Factura
                </NeoButton>
              </div>

              {/* Client fields */}
              <div className="mb-4 space-y-3">
                <div>
                  <label className="mb-1 block font-base text-sm font-semibold text-foreground/80">
                    Cliente registrado
                  </label>
                  <select
                    value={createClientId}
                    disabled={loadingClients}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCreateClientId(value);
                      const client = clients.find((c) => String(c.id) === value);
                      if (client) {
                        setCreateClientName(client.name || "");
                        setCreateClientPhone(client.phone || "");
                      } else {
                        setCreateClientName("");
                        setCreateClientPhone("");
                      }
                    }}
                    className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground outline-none focus:border-main"
                  >
                    <option value="">Cliente nuevo / sin vincular</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name || client.phone} ({client.phone})
                      </option>
                    ))}
                  </select>
                  {loadingClients && (
                    <p className="mt-1 text-xs text-foreground/50">Cargando clientes...</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block font-base text-sm font-semibold text-foreground/80">
                    Nombre del cliente *
                  </label>
                  <input
                    type="text"
                    value={createClientName}
                    onChange={(e) => setCreateClientName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-base text-sm font-semibold text-foreground/80">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={createClientPhone}
                    onChange={(e) => setCreateClientPhone(e.target.value)}
                    placeholder="Ej: 8095551234"
                    className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="font-base text-sm font-semibold text-foreground/80">
                    Artículos *
                  </label>
                  <NeoButton type="button" size="sm" variant="neutral" onClick={addCreateItem}>
                    <Plus size={14} />
                    Agregar
                  </NeoButton>
                </div>
                <div className="space-y-2">
                  {createItems.map((item, idx) => (
                    <div key={idx} className="rounded-base border-2 border-border bg-secondary-background p-2">
                      <input
                        type="text"
                        value={item.desc || ""}
                        onChange={(e) => updateCreateItem(idx, "desc", e.target.value)}
                        placeholder="Descripción"
                        className="mb-2 w-full rounded-base border-2 border-border bg-background px-2 py-1.5 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          step="1"
                          onKeyDown={preventDecimalInput}
                          value={item.cantidad || ""}
                          onChange={(e) => updateCreateItem(idx, "cantidad", e.target.value)}
                          placeholder="Cant."
                          className="w-20 rounded-base border-2 border-border bg-background px-2 py-1.5 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
                        />
                        <input
                          type="number"
                          min={0}
                          step="1"
                          onKeyDown={preventDecimalInput}
                          value={item.precio || ""}
                          onChange={(e) => updateCreateItem(idx, "precio", e.target.value)}
                          placeholder="Precio"
                          className="flex-1 rounded-base border-2 border-border bg-background px-2 py-1.5 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
                        />
                        <label className="flex items-center gap-1 whitespace-nowrap font-base text-xs font-semibold">
                          <input
                            type="checkbox"
                            checked={!!item.itbis}
                            onChange={(e) => updateCreateItem(idx, "itbis", e.target.checked)}
                            className="h-4 w-4 accent-main"
                          />
                          ITBIS
                        </label>
                        {createItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCreateItem(idx)}
                            className="rounded-base p-1.5 text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discounts — admin only */}
              {isAdmin && (
                <div className="mb-4 rounded-base border-2 border-dashed border-main/40 bg-main/5 p-3">
                  <p className="mb-2 font-base text-sm font-black uppercase tracking-wider text-main/80">
                    Descuento (solo admin)
                  </p>
                  <div className="mb-2">
                    <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">
                      Tipo de descuento
                    </label>
                    <select
                      value={createDiscountType}
                      onChange={(e) => setCreateDiscountType(e.target.value as any)}
                      className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground outline-none focus:border-main"
                    >
                      <option value="">Sin descuento</option>
                      <option value="percentage">Porcentaje (%)</option>
                      <option value="fixed">Monto fijo (RD$)</option>
                      <option value="coupon">Cupón</option>
                    </select>
                  </div>
                  {createDiscountType && (
                    <>
                      <div className="mb-2">
                        <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">
                          {createDiscountType === "percentage"
                            ? "Porcentaje"
                            : createDiscountType === "coupon"
                            ? "Valor del cupón (RD$)"
                            : "Monto (RD$)"}
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          onKeyDown={preventDecimalInput}
                          value={createDiscountValue}
                          onChange={(e) => setCreateDiscountValue(e.target.value)}
                          placeholder={
                            createDiscountType === "percentage" ? "Ej: 10" : "Ej: 500"
                          }
                          className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
                        />
                      </div>
                      {createDiscountType === "coupon" && (
                        <div className="mb-2">
                          <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">
                            Código de cupón
                          </label>
                          <input
                            type="text"
                            value={createDiscountCode}
                            onChange={(e) => setCreateDiscountCode(e.target.value)}
                            placeholder="Ej: PROMO10"
                            className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
                          />
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block font-base text-xs font-semibold text-foreground/70">
                          Motivo / nota del descuento
                        </label>
                        <input
                          type="text"
                          value={createDiscountReason}
                          onChange={(e) => setCreateDiscountReason(e.target.value)}
                          placeholder="Ej: cliente frecuente, promoción..."
                          className="w-full rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="mb-4">
                <label className="mb-1 block font-base text-sm font-semibold text-foreground/80">
                  Notas
                </label>
                <textarea
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  placeholder="Condiciones de pago, detalles adicionales..."
                  rows={3}
                  className="w-full resize-none rounded-base border-2 border-border bg-background px-3 py-2 font-base text-sm text-foreground shadow-none outline-none focus:border-main"
                />
              </div>

              {/* Totals */}
              <NeoCard variant="main" className="mb-4 p-3">
                <div className="flex items-center justify-between text-sm text-main-foreground/80">
                  <span>Subtotal</span>
                  <span>RD$ {createTotals.subtotal.toLocaleString("es-DO")}</span>
                </div>
                {createTotals.itbis > 0 && (
                  <div className="flex items-center justify-between text-sm text-main-foreground/80">
                    <span>ITBIS (18%)</span>
                    <span>RD$ {createTotals.itbis.toLocaleString("es-DO")}</span>
                  </div>
                )}
                {createTotals.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm text-main-foreground/90">
                    <span>
                      Descuento
                      {createDiscountType === "percentage" && ` (${createDiscountValue}%)`}
                      {createDiscountType === "coupon" && createDiscountCode && ` (${createDiscountCode})`}
                    </span>
                    <span>-RD$ {createTotals.discountAmount.toLocaleString("es-DO")}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between border-t-2 border-main-foreground/30 pt-2">
                  <span className="font-base text-sm font-black uppercase">Total</span>
                  <span className="font-heading text-xl font-bold text-main-foreground">
                    RD$ {createTotals.total.toLocaleString("es-DO")}
                  </span>
                </div>
              </NeoCard>

              {createError && (
                <p className="mb-2 font-base text-sm text-red-600">{createError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t-2 border-border bg-secondary-background px-4 py-3">
              <NeoButton
                type="button"
                variant="neutral"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingQuotation(null);
                  resetCreateForm();
                }}
                disabled={creating}
              >
                Cancelar
              </NeoButton>
              <NeoButton
                type="button"
                onClick={editingQuotation ? handleEdit : handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <RefreshCw size={16} className="mr-1 animate-spin" />
                ) : editingQuotation ? (
                  <CheckCircle size={16} className="mr-1" />
                ) : (
                  <Plus size={16} className="mr-1" />
                )}
                {editingQuotation
                  ? "Guardar cambios"
                  : `Crear ${createType === "FACTURA" ? "factura" : "cotización"}`}
              </NeoButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
