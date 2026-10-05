import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  QrCode,
  Wifi,
  Loader2,
  CheckCircle2,
  Users,
  UserCheck,
  User,
  Bot,
  Pause,
  Play,
  Power,
  RefreshCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import botApi, { botAPI, BotStatus, BotMode } from "../services/botApi";
import { NeoCard, NeoButton, NeoBadge } from "@guru/ui";
import { confirmDialog } from "../lib/dialogs";

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: BotStatus["status"]; paused?: boolean }> = ({
  status,
  paused,
}) => {
  const badgeClass = "gap-2.5 normal-case text-base px-5 py-2.5";

  if (status === "connected") {
    return paused ? (
      <NeoBadge variant="outline" className={badgeClass}>
        <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
        Bot Pausado
      </NeoBadge>
    ) : (
      <NeoBadge variant="main" className={badgeClass}>
        <span className="h-2.5 w-2.5 rounded-full bg-main-foreground" />
        Bot Activo
      </NeoBadge>
    );
  }

  if (status === "connecting") {
    return (
      <NeoBadge variant="main" className={badgeClass}>
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-main-foreground" />
        Conectando…
      </NeoBadge>
    );
  }

  return (
    <NeoBadge variant="neutral" className={badgeClass}>
      <span className="h-2.5 w-2.5 rounded-full bg-foreground/50" />
      Desconectado
    </NeoBadge>
  );
};

// ─── Error description helper (visible debug log) ────────────────────────────
function describeError(e: any): string {
  if (!e) return "Error desconocido";
  const parts: string[] = [];
  if (e.code) parts.push(e.code); // p.ej. ERR_NETWORK (ad-blocker/VPN), ECONNABORTED
  if (e.response) parts.push(`HTTP ${e.response.status}`);
  const dataMsg = e.response?.data?.message || e.response?.data?.error;
  if (dataMsg) parts.push(String(dataMsg));
  if (!parts.length && e.message) parts.push(e.message);
  return parts.join(" · ") || "Error desconocido";
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const WhatsAppBot: React.FC = () => {
  const [status, setStatus] = useState<BotStatus>({
    status: "disconnected",
    paused: false,
    mode: "all",
    assignmentMode: "manual",
  });
  const [qr, setQr] = useState<string | null>(null);
  const isMeta = status.provider === "meta";
  const [loading, setLoading] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const lastLogRef = useRef<string>("");

  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Visible on-screen log — for users without dev console access
  const logDebug = useCallback((msg: string) => {
    if (msg === lastLogRef.current) return; // dedupe consecutive repeats
    lastLogRef.current = msg;
    const time = new Date().toLocaleTimeString("es-DO", { hour12: false });
    console.log(`[WA-UI] ${msg}`);
    setDebugLog((prev) => [`${time}  ${msg}`, ...prev].slice(0, 40));
  }, []);

  // Log environment once on mount
  useEffect(() => {
    logDebug(`Navegador: ${navigator.userAgent}`);
    logDebug(`API: ${botApi.defaults.baseURL}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await botAPI.getStatus();
      const raw = res.data as any;
      setStatus((prev) => ({
        status: raw.connected ? "connected" : prev.status === "connecting" ? "connecting" : "disconnected",
        paused: !raw.botActive,
        mode: raw.botMode ?? "all",
        assignmentMode: raw.assignmentMode ?? "manual",
        phone: raw.phone,
        provider: raw.provider ?? "baileys",
      }));
    } catch (e: any) {
      logDebug(`Error consultando estado: ${describeError(e)}`);
    }
  }, [logDebug]);

  const fetchQR = useCallback(async () => {
    try {
      const res = await botAPI.getQR();
      if (res.data.qr) {
        setQr((prev) => {
          if (!prev) logDebug("QR recibido del servidor — listo para escanear");
          return res.data.qr;
        });
      } else if (res.data.status === "no_qr") {
        // keep existing QR if still within a connecting window, otherwise clear
        setQr((prev) => prev);
      }
    } catch (e: any) {
      logDebug(`Error consultando QR: ${describeError(e)}`);
    }
  }, [logDebug]);

  // ── Polling setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStatus();
    statusIntervalRef.current = setInterval(fetchStatus, 5000);
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (status.status === "connecting") {
      fetchQR();
      qrIntervalRef.current = setInterval(fetchQR, 2000);
    } else {
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      if (status.status === "disconnected") setQr(null);
    }
    return () => {
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    };
  }, [status.status, fetchQR]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const copyLog = async () => {
    const text = debugLog.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      logDebug("Registro copiado al portapapeles");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      logDebug("Registro copiado (método alternativo)");
    }
  };

  const handleConnect = async () => {
    setError(null);
    setLoading(true);
    setQr(null);
    logDebug("Iniciando conexión (POST /whatsapp/connect)…");
    try {
      // Move UI immediately into connecting state so QR polling starts
      setStatus((prev) => ({ ...prev, status: "connecting" }));
      await botAPI.connect();
      logDebug("Conexión iniciada en el servidor — esperando QR");
      // Start QR polling right away
      fetchQR();
    } catch (e: any) {
      setStatus((prev) => ({ ...prev, status: "disconnected" }));
      const msg = e?.response?.data?.message || "Error al iniciar conexión";
      setError(msg);
      logDebug(`Error al iniciar conexión: ${describeError(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setLoading(true);
    try {
      await botAPI.disconnect();
      await fetchStatus();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al desconectar");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBot = async () => {
    setError(null);
    try {
      await botAPI.toggleBot();
      await fetchStatus();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al cambiar estado del bot");
    }
  };

  const handleResync = async () => {
    setError(null);
    setResyncing(true);
    logDebug("Refrescando conexión (soft resync)...");
    try {
      await botAPI.resync();
      logDebug("Soft resync enviado — sincronizando estado y despertando el pipe");
      await fetchStatus();
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Error al refrescar conexión";
      setError(msg);
      logDebug(`Error en soft resync: ${describeError(e)}`);
    } finally {
      setResyncing(false);
    }
  };

  const handleReconnect = async () => {
    setError(null);
    setLoading(true);
    logDebug("Forzando reconexión (hard reconnect) con credenciales guardadas...");
    try {
      await botAPI.reconnect();
      logDebug("Reconexión iniciada — se reconstruirá el socket");
      setStatus((prev) => ({ ...prev, status: "connecting" }));
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Error al forzar reconexión";
      setError(msg);
      logDebug(`Error en hard reconnect: ${describeError(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetMode = async (mode: BotMode) => {
    setError(null);
    // "selected" with no enabled chats mutes the bot for everyone — confirm first
    if (
      mode === "selected" &&
      !(await confirmDialog(
        "En modo 'Seleccionados' el bot SOLO responde en los chats que actives uno por uno. Si no activas ninguno, el bot queda mudo para todos.",
        { title: "¿Cambiar a modo Seleccionados?", confirmLabel: "Sí, cambiar" },
      ))
    ) {
      return;
    }
    try {
      await botAPI.setBotMode(mode);
      setStatus((prev) => ({ ...prev, mode }));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al cambiar modo");
    }
  };

  const handleSetAssignmentMode = async (mode: "manual" | "automatic") => {
    setError(null);
    try {
      await botAPI.setAssignmentMode(mode);
      setStatus((prev) => ({ ...prev, assignmentMode: mode }));
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al cambiar modo de asignación");
    }
  };

  const currentMode = status.mode ?? "all";
  const currentAssignmentMode = status.assignmentMode ?? "manual";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-base border-2 border-border bg-main text-main-foreground shadow-button">
            <MessageCircle size={22} />
          </div>
          <div>
            <h2 className="font-heading text-4xl font-black text-foreground md:text-5xl">
              WhatsApp Bot
            </h2>
            <p className="font-base text-base text-foreground/70">
              Gestiona la conexión y el modo de respuesta automática
            </p>
          </div>
        </div>
      </motion.div>

      {/* Error banner */}
      {error && (
        <NeoCard variant="outline" className="p-4">
          <p className="font-base text-base text-foreground">{error}</p>
        </NeoCard>
      )}

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {/* ── LEFT: Connection status + controls ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <NeoCard>
            <h3 className="font-heading text-xl font-bold text-foreground md:text-2xl">
              Estado de Conexión
            </h3>

            {/* Status badge */}
            <div className="mb-6">
              <StatusBadge status={status.status} paused={status.paused} />
              {isMeta && (
                <p className="mt-2 font-base text-base text-foreground/70">
                  Conectado por la <span className="font-semibold text-foreground">API oficial de Meta</span>
                </p>
              )}
              {status.phone && status.status === "connected" && (
                <p className="mt-2 font-base text-base text-foreground/70">
                  Número:{" "}
                  <span className="font-semibold text-foreground">
                    {status.phone}
                  </span>
                </p>
              )}
            </div>

            {/* Action buttons by state */}
            <div className="mb-6 space-y-3">
              {status.status === "disconnected" && (
                <NeoButton
                  onClick={handleConnect}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Wifi size={18} />
                  )}
                  Iniciar Conexión
                </NeoButton>
              )}

              {status.status === "connecting" && (
                <div className="flex items-center justify-center gap-3 rounded-base border-2 border-border bg-secondary-background px-5 py-3 text-foreground shadow-shadow">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="font-base text-base font-semibold">
                    Esperando escaneo del QR…
                  </span>
                </div>
              )}

              {status.status === "connected" && (
                <div className="flex flex-col gap-3">
                  <NeoButton
                    onClick={handleToggleBot}
                    variant={status.paused ? "default" : "neutral"}
                    className="w-full"
                  >
                    {status.paused ? (
                      <>
                        <Play size={18} /> Reanudar Bot
                      </>
                    ) : (
                      <>
                        <Pause size={18} /> Pausar Bot
                      </>
                    )}
                  </NeoButton>
                  {!isMeta && (
                    <>
                  <NeoButton
                    onClick={handleResync}
                    disabled={resyncing}
                    variant="neutral"
                    className="w-full"
                  >
                    {resyncing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Refrescar conexión
                  </NeoButton>
                  <NeoButton
                    onClick={handleReconnect}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Reconectar forzado
                  </NeoButton>
                  <NeoButton
                    onClick={handleDisconnect}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Power size={16} />
                    )}
                    Desconectar
                  </NeoButton>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mb-5 border-t-2 border-border" />

            {/* Mode selector — always visible */}
            <div>
              <p className="mb-3 font-base text-base font-bold uppercase tracking-widest text-foreground/60">
                Modo de Respuesta
              </p>
              <div className="flex flex-wrap gap-3 [&>*]:min-w-[8rem]">
                <NeoButton
                  onClick={() => handleSetMode("all")}
                  variant={currentMode === "all" ? "default" : "neutral"}
                  className="flex-1"
                >
                  <Users size={16} />
                  Todos
                </NeoButton>
                <NeoButton
                  onClick={() => handleSetMode("selected")}
                  variant={currentMode === "selected" ? "default" : "neutral"}
                  className="flex-1"
                >
                  <UserCheck size={16} />
                  Seleccionados
                </NeoButton>
              </div>

              {currentMode === "selected" && status.status === "connected" && (
                <div className="mt-3 rounded-base border-2 border-border bg-secondary-background p-3 font-base text-base text-foreground/80 shadow-shadow">
                  💡 El bot solo responde en los chats que actives con el botón 🤖 de cada chat en Mensajes
                </div>
              )}
              {currentMode === "selected" && status.status === "disconnected" && (
                <div className="mt-3 rounded-base border-2 border-border bg-secondary-background p-3 font-base text-base text-foreground/80 shadow-shadow">
                  💡 Conecta para gestionar contactos habilitados
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mb-5 mt-6 border-t-2 border-border" />

            {/* Assignment mode selector */}
            <div>
              <p className="mb-3 font-base text-base font-bold uppercase tracking-widest text-foreground/60">
                Asignación de Casos
              </p>
              <div className="flex flex-wrap gap-3 [&>*]:min-w-[8rem]">
                <NeoButton
                  onClick={() => handleSetAssignmentMode("manual")}
                  variant={currentAssignmentMode === "manual" ? "default" : "neutral"}
                  className="flex-1"
                >
                  <User size={16} />
                  Manual
                </NeoButton>
                <NeoButton
                  onClick={() => handleSetAssignmentMode("automatic")}
                  variant={currentAssignmentMode === "automatic" ? "default" : "neutral"}
                  className="flex-1"
                >
                  <Bot size={16} />
                  Automático
                </NeoButton>
              </div>

              <div className="mt-3 rounded-base border-2 border-border bg-secondary-background p-3 font-base text-base text-foreground/80 shadow-shadow">
                {currentAssignmentMode === "manual"
                  ? "💡 El admin asigna cada caso a un digitador."
                  : "🤖 Los nuevos casos se asignan automáticamente según disponibilidad."}
              </div>
            </div>
          </NeoCard>
        </motion.div>

        {/* ── RIGHT: QR Code ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <NeoCard className="flex min-h-[320px] flex-col items-center justify-center">
            <h3 className="mb-6 w-full font-heading text-xl font-bold text-foreground md:text-2xl">
              Código QR
            </h3>

            {isMeta ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-border bg-secondary-background shadow-button">
                  <CheckCircle2 size={40} className="text-main" />
                </div>
                <div className="text-center">
                  <p className="font-heading text-xl font-bold text-foreground md:text-2xl">
                    Sin QR
                  </p>
                  <p className="mt-1 font-base text-base text-foreground/70">
                    El número está conectado directo con Meta; no hay que escanear nada
                  </p>
                </div>
              </div>
            ) : status.status === "connected" ? (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-border bg-secondary-background shadow-button">
                  <CheckCircle2 size={40} className="text-main" />
                </div>
                <div className="text-center">
                  <p className="font-heading text-xl font-bold text-foreground md:text-2xl">
                    ¡Sesión Activa!
                  </p>
                  <p className="mt-1 font-base text-base text-foreground/70">
                    WhatsApp conectado y listo
                  </p>
                </div>
              </div>
            ) : qr ? (
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-base border-2 border-border bg-main-foreground p-4 shadow-shadow">
                  <QRCodeSVG value={qr} size={224} level="M" />
                </div>
                <p className="text-center font-base text-base text-foreground/70">
                  Escanea con WhatsApp →{" "}
                  <span className="font-semibold text-foreground">
                    Menú → Dispositivos vinculados
                  </span>
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-border bg-secondary-background shadow-button">
                  {status.status === "connecting" ? (
                    <Loader2 size={36} className="animate-spin text-main" />
                  ) : (
                    <QrCode size={36} className="text-foreground/50" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-base text-base font-semibold text-foreground/80">
                    {status.status === "connecting"
                      ? "Generando QR…"
                      : "Iniciar Conexión para ver QR"}
                  </p>
                  <p className="mt-1 font-base text-base text-foreground/50">
                    El código aparecerá aquí automáticamente
                  </p>
                </div>
              </div>
            )}
          </NeoCard>
        </motion.div>
      </div>

      {/* ── Registro de conexión (visible sin consola) ── */}
      <NeoCard className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-lg font-bold text-foreground">
            Registro de conexión
          </h3>
          <div className="flex gap-2">
            <NeoButton onClick={copyLog} variant="neutral" className="px-3 py-1.5 text-sm">
              Copiar registro
            </NeoButton>
            <NeoButton
              onClick={() => setDebugLog([])}
              variant="neutral"
              className="px-3 py-1.5 text-sm"
            >
              Limpiar
            </NeoButton>
          </div>
        </div>
        <div className="max-h-44 overflow-y-auto rounded-base border-2 border-border bg-black p-3 font-mono text-xs leading-relaxed text-green-300">
          {debugLog.length === 0 ? (
            <p className="opacity-60">Sin eventos todavía…</p>
          ) : (
            debugLog.map((line, i) => (
              <p key={i} className="whitespace-pre-wrap break-all">
                {line}
              </p>
            ))
          )}
        </div>
        <p className="mt-2 font-base text-sm text-foreground/60">
          Si el QR no aparece, copia este registro y envíalo al administrador.
        </p>
      </NeoCard>
    </div>
  );
};

export default WhatsAppBot;
