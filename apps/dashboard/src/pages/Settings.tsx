import React, { useState, useEffect } from "react";
import { settingsAPI } from "../services/api";
import api from "../services/api";
import { preventDecimalInput } from "../utils";
import { todayISO, formatISODate } from "../lib/dates";
import { Database, Play, CheckCircle, AlertCircle, Loader2, Info } from "lucide-react";
import {
  NeoCard,
  NeoCardHeader,
  NeoCardTitle,
  NeoCardDescription,
  NeoCardContent,
} from "@guru/ui";
import { NeoButton } from "@guru/ui";
import { NeoInput } from "@guru/ui";
import { Dialog } from "@guru/ui/retroui";
import { DatePicker } from "@guru/ui/retroui";
import { confirmDialog } from "../lib/dialogs";

const Settings: React.FC = () => {
  const [employeePercentage, setEmployeePercentage] = useState<number>(50);
  const [newPercentage, setNewPercentage] = useState<string>("50");
  const [startDate, setStartDate] = useState<string>(() => todayISO());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Migrations state
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    ok?: boolean;
    message?: string;
    ran?: string[];
    skipped?: string[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetchEmployeePercentage();
  }, []);

  const fetchEmployeePercentage = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await settingsAPI.getCurrentPercentage();
      const percentage = response.data.percentage;
      setEmployeePercentage(percentage);
      setNewPercentage(percentage.toString());
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const percentageValue = parseFloat(newPercentage);

    if (isNaN(percentageValue) || percentageValue < 0 || percentageValue > 100) {
      setError("El porcentaje debe estar entre 0 y 100");
      return;
    }

    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    setConfirmOpen(false);
    setSaving(true);

    try {
      const percentageValue = parseFloat(newPercentage);
      await settingsAPI.updateEmployeePercentage(percentageValue, startDate);
      setEmployeePercentage(percentageValue);
      setSuccessMessage("Porcentaje actualizado exitosamente desde " + formatISODate(startDate));

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Error al actualizar el porcentaje");
    } finally {
      setSaving(false);
    }
  };

  const adminPercentage = 100 - parseFloat(newPercentage || "0");

  const handleRunMigrations = async () => {
    if (!await confirmDialog("Se ejecutarán las migraciones pendientes en la base de datos.", { title: "¿Ejecutar migraciones?", confirmLabel: "Ejecutar" })) return;
    setMigrating(true);
    setMigrationResult(null);
    try {
      const response = await api.post("/admin/run-migrations");
      setMigrationResult({
        ok: true,
        message: response.data.message,
        ran: response.data.ran,
        skipped: response.data.skipped,
      });
    } catch (err: any) {
      setMigrationResult({
        ok: false,
        error: err.response?.data?.error || err.message || "Error al ejecutar migraciones",
      });
    } finally {
      setMigrating(false);
    }
  };

  const handleFixTimestamps = async () => {
    if (!await confirmDialog("Se corregirá la fecha de los servicios que no la tienen.", { title: "¿Corregir timestamps?", confirmLabel: "Corregir" })) return;
    setMigrating(true);
    setMigrationResult(null);
    try {
      const response = await api.post("/admin/fix-timestamps");
      setMigrationResult({
        ok: true,
        message: response.data.message,
        ran: response.data.ran || [],
        skipped: [],
      });
    } catch (err: any) {
      setMigrationResult({
        ok: false,
        error: err.response?.data?.error || err.message || "Error al corregir timestamps",
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-4xl font-black md:text-5xl">Configuración</h2>
        <p className="text-base text-foreground/70">
          Administra la configuración general del sistema
        </p>
      </div>

      {error && (
        <div className="rounded-base border-2 border-red-600 bg-red-50 p-4 text-base font-bold text-red-600">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-base border-2 border-green-600 bg-green-50 p-4 text-base font-bold text-green-600">
          {successMessage}
        </div>
      )}

      <NeoCard>
        <NeoCardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-base border-2 border-border bg-main p-2 text-main-foreground shadow-button">
              <Database size={24} />
            </div>
            <div>
              <NeoCardTitle>Porcentaje de Participación</NeoCardTitle>
              <NeoCardDescription>
                Configura el porcentaje que recibe cada empleado por servicio
              </NeoCardDescription>
            </div>
          </div>
        </NeoCardHeader>

        <NeoCardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-foreground/60">
              <Loader2 className="animate-spin" size={20} />
              <span>Cargando configuración...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveRequest} className="space-y-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="percentage"
                    className="block text-sm font-black uppercase tracking-wider text-foreground/80"
                  >
                    Nuevo Porcentaje para Empleados (0-100)
                  </label>
                  <NeoInput
                    id="percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    onKeyDown={preventDecimalInput}
                    value={newPercentage}
                    onChange={(e) => setNewPercentage(e.target.value)}
                    placeholder="Ej: 50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="startDate"
                    className="block text-sm font-black uppercase tracking-wider text-foreground/80"
                  >
                    Fecha de Inicio
                  </label>
                  <DatePicker
                    date={startDate ? new Date(startDate + "T00:00:00") : undefined}
                    onSelect={(d) => setStartDate(d ? todayISO(d) : "")}
                    placeholder="Seleccionar fecha"
                    className="h-12"
                  />
                </div>
              </div>

              <div className="rounded-base border-2 border-border bg-secondary-background p-4 shadow-button">
                <div className="flex items-start gap-2 text-foreground/80">
                  <Info size={20} className="mt-0.5 flex-shrink-0 text-main" />
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>Empleado:</strong> {parseFloat(newPercentage || "0").toFixed(2)}% del total
                    </p>
                    <p>
                      <strong>Admin:</strong> {adminPercentage.toFixed(2)}% del total
                    </p>
                    <p className="text-foreground/60">
                      Actual: {employeePercentage}% para empleados
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <NeoButton type="submit" variant="default" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Actualizar Porcentaje
                    </>
                  )}
                </NeoButton>
              </div>
            </form>
          )}
        </NeoCardContent>
      </NeoCard>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Content size="md" className="border-4 border-border">
          <Dialog.Header className="font-heading text-xl font-black">
            ¿Confirmar cambio?
          </Dialog.Header>
          <div className="p-6">
            <p className="mb-4 text-base text-foreground/80">
              Estás a punto de cambiar el porcentaje de participación de empleados de{" "}
              <strong>{employeePercentage}%</strong> a <strong>{parseFloat(newPercentage || "0").toFixed(2)}%</strong>.
            </p>
            <p className="text-base text-foreground/80">
              Esta acción afectará los cálculos de ganancias desde el{" "}
              <strong>{formatISODate(startDate)}</strong>.
            </p>
          </div>
          <Dialog.Footer className="border-t-4 border-border bg-secondary-background">
            <NeoButton
              type="button"
              variant="neutral"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </NeoButton>
            <NeoButton type="button" variant="default" onClick={handleConfirmSave}>
              Confirmar Cambio
            </NeoButton>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>

      {/* Migrations Card */}
      <NeoCard>
        <NeoCardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-base border-2 border-border bg-main p-2 text-main-foreground shadow-button">
              <Play size={24} />
            </div>
            <div>
              <NeoCardTitle>Migraciones y Mantenimiento</NeoCardTitle>
              <NeoCardDescription>
                Ejecuta migraciones y correcciones de datos
              </NeoCardDescription>
            </div>
          </div>
        </NeoCardHeader>

        <NeoCardContent>
          <div className="flex flex-wrap gap-3">
            <NeoButton
              type="button"
              variant="default"
              onClick={handleRunMigrations}
              disabled={migrating}
            >
              {migrating ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Database size={18} />
              )}
              Ejecutar Migraciones
            </NeoButton>
            <NeoButton
              type="button"
              variant="neutral"
              onClick={handleFixTimestamps}
              disabled={migrating}
            >
              {migrating ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              Corregir Timestamps
            </NeoButton>
          </div>

          {migrationResult && (
            <div
              className={`mt-6 rounded-base border-2 p-4 ${
                migrationResult.ok
                  ? "border-green-600 bg-green-50 text-green-600"
                  : "border-red-600 bg-red-50 text-red-600"
              }`}
            >
              <p className="font-bold">{migrationResult.message || migrationResult.error}</p>
              {migrationResult.ran && migrationResult.ran.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-bold">Ejecutadas:</p>
                  <ul className="ml-4 list-disc text-sm">
                    {migrationResult.ran.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {migrationResult.skipped && migrationResult.skipped.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-bold">Omitidas:</p>
                  <ul className="ml-4 list-disc text-sm">
                    {migrationResult.skipped.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </NeoCardContent>
      </NeoCard>
    </div>
  );
};

export default Settings;
