import React, { useEffect, useState, useMemo } from "react";
import LoadingScreen from "../components/LoadingScreen";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import AdminDataTable from "../components/dashboard/AdminDataTable";
import EmployeeDataTable from "../components/dashboard/EmployeeDataTable";
import DataModificationForm from "../components/dashboard/DataModificationForm";
import DataCharts from "../components/dashboard/DataCharts";
import AIGuru from "./AIGuru";
import StatsCard from "../components/dashboard/StatsCard";
import Settings from "./Settings";
import WhatsAppBot from "./WhatsAppBot";
import BotMessages from "./BotMessages";
import BotClients from "./BotClients";
import Cases from "./Cases";
import Cotizaciones from "./Cotizaciones";
import AIInsights from "./AIInsights";
import DocumentManagement from "./DocumentManagement";
import Laws from "./Laws";
import ServicesCatalog from "./ServicesCatalog";
import MotherBrain from "./MotherBrain";
import BotSimulator from "./BotSimulator";
import SimulatorReview from "./SimulatorReview";
import MiCuenta from "./MiCuenta";
import Usuarios from "./Usuarios";
import Actividad from "./Actividad";
import { NeoButton } from "@guru/ui";
import { NeoDateInput } from "@guru/ui";
import { servicesAPI, settingsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useUserColors } from "../context/UserColorsContext";
import { Zap, Eye, EyeOff } from "lucide-react";
import { payrollColumns } from "../lib/payroll";
import { formatCurrency } from "../utils";


const Dashboard: React.FC = () => {
  const { isAdmin, user } = useAuth();
  const { appearanceOfColumn, users: directoryUsers } = useUserColors();
  const location = useLocation();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const getTodayString = () => new Date().toISOString().split("T")[0];

  const navigate = useNavigate();

  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTodayString());

  // Fetch employee percentage from settings
  const [employeePercentage, setEmployeePercentage] = useState(50);
  const [showEarnings, setShowEarnings] = useState(false);

  useEffect(() => {
    // Check if on a bot-related route (skip service fetching for these)
    const isBotRoute = /\/(whatsapp|bot-|cases|cotizaciones|ai-insights|ai-guru|documents|laws|services-catalog|motherbrain|simulator-review)/.test(location.pathname);
    const isAnalyticsRoute = /\/(charts|data)/.test(location.pathname);

    if (isBotRoute) {
      // Skip service fetching on bot routes
      setLoading(false);
    } else if (isAnalyticsRoute) {
      // Charts/Data need all historical data, not just today's
      fetchData(true);
      fetchEmployeePercentage();
    } else {
      // Fetch services on main dashboard and settings routes only
      fetchData();
      fetchEmployeePercentage();
    }
  }, [startDate, endDate, location.pathname]);

  const fetchEmployeePercentage = async () => {
    try {
      const response = await settingsAPI.getCurrentPercentage();
      setEmployeePercentage(response.data.percentage);
    } catch (error) {
      console.error("Error fetching employee percentage:", error);
      // Keep default 50% if fetch fails
    }
  };

  const fetchData = async (allTime = false) => {
    try {
      setLoading(true);
      const response = allTime
        ? await servicesAPI.getServices()
        : await servicesAPI.getServices(startDate, endDate);
      setServices(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching services:", error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeServices = () => {
    if (isAdmin) return services;
    const dataCol = (user?.dataColumn || "").toUpperCase();
    return services.filter(
      (s: any) => (s.data_column || "").toUpperCase() === dataCol,
    );
  };

  // Employees in earnings come from the user directory (active + "Participa en ganancias")
  const payroll = useMemo(() => payrollColumns(directoryUsers, services), [directoryUsers, services]);

  const transformToExcelFormat = () => {
    if (!services.length) return [];

    // Initialize groupedByUser with ALL payroll.columns (UPPERCASE)
    const groupedByUser: Record<string, any[]> = {};
    payroll.columns.forEach((u) => {
      groupedByUser[u] = [];
    });

    services.forEach((service: any) => {
      // Handle case-insensitive mapping
      const dataCol = (service.data_column || "").toUpperCase();
      const match = payroll.columns.find((u) => u === dataCol);
      if (match) {
        groupedByUser[match].push(service);
      }
    });

    const transformed: any[] = [];
    const maxServices = Math.max(
      ...Object.values(groupedByUser).map((arr: any[]) => arr.length),
      0,
    );

    for (let i = 0; i < maxServices; i++) {
      const serviceRow: any = { DETALLE: "SERVICIO" };
      const clientRow: any = { DETALLE: "CLIENTE" };
      const timeRow: any = { DETALLE: "HORA" };
      const earningsRow: any = { DETALLE: "GANANCIA" };
      const commentRow: any = { DETALLE: "NOTA" };

      payroll.columns.forEach((u) => {
        const userServices = groupedByUser[u] || [];
        const service = userServices[i];

        if (service) {
          serviceRow[u] = service.service_name;
          serviceRow[`${u}_id`] = service.id;
          serviceRow.id = service.id;

          clientRow[u] = service.client || "";
          timeRow[u] = service.time || "";
          earningsRow[u] = service.earnings;
          commentRow[u] = service.comment || "";
        } else {
          serviceRow[u] = "";
          clientRow[u] = "";
          timeRow[u] = "";
          earningsRow[u] = "";
          commentRow[u] = "";
        }
      });

      transformed.push(serviceRow, clientRow, timeRow, earningsRow, commentRow);
    }

    return transformed;
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <DashboardLayout>
      <Routes>
        <Route
          path="/"
          element={
            <div className="space-y-8">
              {/* Header / Top Bar for Page */}
              <div className="mb-10 flex flex-col items-start justify-between gap-6 xl:flex-row xl:items-center">
                <div>
                  <h2 className="font-heading mb-2 text-4xl font-black tracking-tight text-foreground md:text-5xl">
                    Resumen Operativo
                  </h2>
                  <p className="text-sm font-medium text-foreground/70">
                    Gestiona y visualiza el rendimiento en tiempo real.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 xl:w-auto">
                  <div className="flex flex-wrap items-center gap-2">
                    <NeoButton
                      variant="default"
                      onClick={() => setShowEarnings((v) => !v)}
                      className="text-xs"
                    >
                      {showEarnings ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showEarnings ? "Ocultar" : "Mostrar"} Ganancias
                    </NeoButton>
                    <NeoButton
                      variant="neutral"
                      onClick={() => navigate("/ai-insights")}
                      className="text-xs"
                    >
                      <Zap size={14} />
                      Insights IA
                    </NeoButton>
                  </div>

                  {/* Date Filter */}
                  <div className="flex w-full min-w-0 flex-col flex-wrap gap-2 rounded-base border-2 border-border bg-secondary-background p-3 shadow-shadow sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="shrink-0 text-[10px] font-black tracking-widest uppercase text-foreground/60">
                        Desde
                      </span>
                      <NeoDateInput
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        placeholder="Desde"
                        className="h-10 min-w-0 flex-1 rounded-base border-2 border-border bg-background text-sm text-foreground shadow-none"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="shrink-0 text-[10px] font-black tracking-widest uppercase text-foreground/60">
                        Hasta
                      </span>
                      <NeoDateInput
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        placeholder="Hasta"
                        className="h-10 min-w-0 flex-1 rounded-base border-2 border-border bg-background text-sm text-foreground shadow-none"
                      />
                    </div>
                    <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                      <NeoButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStartDate(getTodayString());
                          setEndDate(getTodayString());
                        }}
                        className="flex-1 text-[10px] sm:flex-none"
                      >
                        Hoy
                      </NeoButton>
                      <NeoButton
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setStartDate("");
                          setEndDate("");
                        }}
                        className="flex-1 text-[10px] sm:flex-none"
                      >
                        Limpiar
                      </NeoButton>
                    </div>
                  </div>
                </div>
              </div>

              {/* STATS SECTION */}
              {isAdmin && (
                <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                  <StatsCard
                    label="Total Admin"
                    value={formatCurrency(
                      services.reduce(
                        (acc, s: any) => acc + (Number(s.earnings) || 0) * (1 - employeePercentage / 100),
                        0,
                      ),
                    )}
                    subValue={`${services.length} serv.`}
                    variant="main"
                    delay={0.1}
                    sensitive
                    visible={showEarnings}
                  />

                  {/* Total Users (Sum of their earnings/shares) */}
                  <StatsCard
                    label="Total Users"
                    value={formatCurrency(
                      services
                        .filter((s: any) =>
                          payroll.columns.includes((s.data_column || "").toUpperCase()),
                        )
                        .reduce(
                          (acc, s: any) => acc + (Number(s.earnings) || 0) * (employeePercentage / 100),
                          0,
                        ),
                    )}
                    subValue={`${
                      services.filter((s: any) =>
                        payroll.columns.includes((s.data_column || "").toUpperCase()),
                      ).length
                    } serv.`}
                    variant="main"
                    delay={0.15}
                    sensitive
                    visible={showEarnings}
                  />

                  {/* Dynamic stats for workers - showing their share */}
                  {payroll.columns.map((worker, idx) => {
                    const workerServices = services.filter(
                      (s: any) =>
                        (s.data_column || "").toUpperCase() === worker,
                    );
                    return (
                      <StatsCard
                        key={worker}
                        label={worker.replace("_", " ") + (payroll.inactive.has(worker) ? " (Desactivado)" : "")}
                        accent={appearanceOfColumn(worker).color}
                        icon={appearanceOfColumn(worker).emoji}
                        value={formatCurrency(
                          workerServices.reduce(
                            (acc, s: any) =>
                              acc + (Number(s.earnings) || 0) * (employeePercentage / 100),
                            0,
                          ),
                        )}
                        subValue={`${workerServices.length} serv.`}
                        delay={0.2 + idx * 0.1}
                        sensitive
                        visible={showEarnings}
                      />
                    );
                  })}
                </div>
              )}

              {isAdmin && (
                <div className="mb-6">
                  <DataModificationForm
                    onServiceAdded={fetchData}
                    workers={payroll.columns.filter((c) => !payroll.inactive.has(c))}
                  />
                </div>
              )}

              {isAdmin ? (
                <AdminDataTable
                  data={transformToExcelFormat()}
                  onSort={() => {}}
                  onServiceDeleted={fetchData}
                  employeePercentage={employeePercentage}
                  isEmployeeView={false}
                  workers={payroll.columns}
                  inactiveWorkers={payroll.inactive}
                />
              ) : (
                <div className="space-y-8">
                  <EmployeeDataTable services={getEmployeeServices()} />
                  <AIGuru />
                </div>
              )}
            </div>
          }
        />
        <Route
          path="/data"
          element={
            <div className="space-y-8">
              {isAdmin ? (
                <AdminDataTable
                  data={transformToExcelFormat()}
                  onSort={() => {}}
                  onServiceDeleted={fetchData}
                  employeePercentage={employeePercentage}
                  workers={payroll.columns}
                  inactiveWorkers={payroll.inactive}
                />
              ) : (
                <EmployeeDataTable services={getEmployeeServices()} />
              )}
              {!isAdmin && <AIGuru />}
            </div>
          }
        />
        <Route
          path="/charts"
          element={
            // Note: You might need to adjust DataCharts to handle new theme if needed,
            // but keeping it as is for now as requested
            <DataCharts services={services} isAdmin={isAdmin} user={user} />
          }
        />
        <Route path="/ai-guru" element={<AIGuru />} />
        <Route path="/mi-cuenta" element={<MiCuenta />} />
        <Route
          path="/actividad"
          element={isAdmin ? <Actividad /> : <div className="text-center text-slate-400 py-8">No tienes acceso a esta página</div>}
        />
        <Route
          path="/usuarios"
          element={isAdmin ? <Usuarios /> : <div className="text-center text-slate-400 py-8">No tienes acceso a esta página</div>}
        />
        <Route
          path="/settings"
          element={isAdmin ? <Settings /> : <div className="text-center text-slate-400 py-8">No tienes acceso a esta página</div>}
        />
        <Route
          path="/whatsapp"
          element={
            isAdmin ? (
              <WhatsAppBot />
            ) : (
              <div className="py-8 text-center text-slate-400">
                No tienes acceso a esta página
              </div>
            )
          }
        />
        <Route path="/bot-messages" element={<BotMessages />} />
        <Route path="/bot-clients" element={<BotClients />} />
        <Route path="/cotizaciones" element={<Cotizaciones />} />
        <Route path="/cases" element={<Cases />} />
        <Route
          path="/ai-insights"
          element={isAdmin ? <AIInsights /> : <AIGuru />}
        />
        <Route path="/documents" element={<DocumentManagement />} />
        <Route path="/laws" element={<Laws />} />
        <Route
          path="/motherbrain"
          element={
            isAdmin ? (
              <MotherBrain />
            ) : (
              <div className="py-8 text-center text-slate-400">
                No tienes acceso a esta página
              </div>
            )
          }
        />
        <Route
          path="/bot-simulator"
          element={
            isAdmin ? (
              <BotSimulator />
            ) : (
              <div className="py-8 text-center text-slate-400">
                No tienes acceso a esta página
              </div>
            )
          }
        />
        <Route
          path="/simulator-review"
          element={
            isAdmin ? (
              <SimulatorReview />
            ) : (
              <div className="py-8 text-center text-slate-400">
                No tienes acceso a esta página
              </div>
            )
          }
        />
        <Route
          path="/services-catalog"
          element={
            isAdmin ? (
              <ServicesCatalog />
            ) : (
              <div className="py-8 text-center text-slate-400">
                No tienes acceso a esta página
              </div>
            )
          }
        />
      </Routes>
    </DashboardLayout>
  );
};

export default Dashboard;
