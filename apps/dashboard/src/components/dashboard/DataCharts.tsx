import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import {
  Calendar,
  TrendingUp,
  DollarSign,
  Activity,
  BarChart3,
  PieChart as PieIcon,
  Crown,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@guru/ui";
import { Button } from "@guru/ui";
import { Input } from "@guru/ui";
import { Badge } from "@guru/ui";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@guru/ui";
import { useUserColors } from "../../context/UserColorsContext";

interface Service {
  id: number;
  service_name: string;
  earnings: number;
  date: string;
  data_column: string;
  username: string;
  client?: string;
  time?: string;
}

interface DataChartsProps {
  services: Service[];
  isAdmin: boolean;
  user?: { dataColumn?: string | null; username?: string | null; role?: string | null } | null;
}

/* ── Theme helpers ── */
function useThemeColors() {
  return useMemo(() => {
    const root = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
    const get = (name: string, fallback: string) =>
      root?.getPropertyValue(name).trim() || fallback;
    return {
      main: get("--main", "#0000FF"),
      chart1: get("--chart-1", "#0000FF"),
      chart2: get("--chart-2", "#000080"),
      chart3: get("--chart-3", "#FFD700"),
      chart4: get("--chart-4", "#FF0000"),
      chart5: get("--chart-5", "#00FF00"),
      border: get("--border", "#000000"),
      background: get("--background", "#ffffff"),
      foreground: get("--foreground", "#000000"),
      secondaryBg: get("--secondary-background", "#ffffff"),
    };
  }, []);
}

/* ── Date Helpers ── */
const formatRD = (n: number) =>
  `RD$ ${n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getStartOfWeek = (d: Date) => {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getStartOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const areaConfig = {
  total: { label: "Ingresos", color: "var(--main)" },
} satisfies Record<string, { label: string; color: string }>;

const barConfig = {
  count: { label: "Frecuencia", color: "var(--main)" },
} satisfies Record<string, { label: string; color: string }>;

export default function DataCharts({ services, isAdmin, user }: DataChartsProps) {
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month" | "custom">("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const colors = useThemeColors();
  const chartColorsList = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5];
  const { appearanceOfColumn } = useUserColors();
  const colorForKey = (key: string, i: number) => {
    const column = key === "Yo" ? user?.dataColumn : key;
    const a = appearanceOfColumn(column);
    return a.color.label === "Sin color" ? chartColorsList[i % chartColorsList.length] : a.color.bg;
  };

  /* ── Filter services by visibility (admin vs employee) ── */
  const userDataCol = (user?.dataColumn || "").toUpperCase();
  const visibleServices = useMemo(() => {
    let list = isAdmin ? services : services.filter((s) => (s.data_column || "").toUpperCase() === userDataCol);

    const now = new Date();
    if (dateRange === "today") {
      const todayStr = now.toISOString().split("T")[0];
      list = list.filter((s) => s.date.startsWith(todayStr));
    } else if (dateRange === "week") {
      const start = getStartOfWeek(new Date(now));
      list = list.filter((s) => new Date(s.date) >= start);
    } else if (dateRange === "month") {
      const start = getStartOfMonth(new Date(now));
      list = list.filter((s) => new Date(s.date) >= start);
    } else if (dateRange === "custom" && customStart && customEnd) {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59);
      list = list.filter((x) => {
        const d = new Date(x.date);
        return d >= s && d <= e;
      });
    }
    return list;
  }, [services, isAdmin, userDataCol, dateRange, customStart, customEnd]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const totalEarnings = visibleServices.reduce((sum, s) => sum + Number(s.earnings || 0), 0);
    const totalCount = visibleServices.length;
    const uniqueDates = new Set(visibleServices.map((s) => s.date.split("T")[0])).size;
    const avgPerDay = uniqueDates > 0 ? totalEarnings / uniqueDates : 0;

    // Best day
    const byDate: Record<string, number> = {};
    visibleServices.forEach((s) => {
      const d = s.date.split("T")[0];
      byDate[d] = (byDate[d] || 0) + Number(s.earnings || 0);
    });
    let bestDay = "";
    let bestAmount = 0;
    Object.entries(byDate).forEach(([d, amt]) => {
      if (amt > bestAmount) { bestAmount = amt; bestDay = d; }
    });

    return { totalEarnings, totalCount, avgPerDay, bestDay, bestAmount };
  }, [visibleServices]);

  /* ── Timeline Data ── */
  const timelineData = useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    visibleServices.forEach((s) => {
      const d = s.date.split("T")[0];
      const label = new Date(d).toLocaleDateString("es-DO", { month: "short", day: "numeric" });
      const emp = isAdmin ? (s.data_column || "Yo") : "Yo";
      if (!grouped[label]) grouped[label] = {};
      grouped[label][emp] = (grouped[label][emp] || 0) + Number(s.earnings || 0);
    });
    return Object.entries(grouped)
      .map(([name, vals]) => ({ name, ...vals }))
      .sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  }, [visibleServices, isAdmin]);

  /* ── Service Frequency (top 10) ── */
  const freqData = useMemo(() => {
    const freq: Record<string, number> = {};
    visibleServices.forEach((s) => {
      freq[s.service_name] = (freq[s.service_name] || 0) + 1;
    });
    return Object.entries(freq)
      .map(([name, count]) => ({ name: name.length > 35 ? name.slice(0, 35) + "…" : name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [visibleServices]);

  /* ── Employee Distribution (admin only) ── */
  const empDist = useMemo(() => {
    if (!isAdmin) return [];
    const dist: Record<string, number> = {};
    visibleServices.forEach((s) => {
      const emp = s.data_column || "Desconocido";
      dist[emp] = (dist[emp] || 0) + Number(s.earnings || 0);
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [visibleServices, isAdmin]);

  /* ── Daily trend area (smooth) ── */
  const areaData = useMemo(() => {
    const byDate: Record<string, number> = {};
    visibleServices.forEach((s) => {
      const d = s.date.split("T")[0];
      byDate[d] = (byDate[d] || 0) + Number(s.earnings || 0);
    });
    return Object.entries(byDate)
      .map(([date, total]) => ({
        label: new Date(date).toLocaleDateString("es-DO", { month: "short", day: "numeric" }),
        total,
      }))
      .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());
  }, [visibleServices]);

  const dateButtons: { key: typeof dateRange; label: string; emoji: string }[] = [
    { key: "all", label: "Todo", emoji: "🗓️" },
    { key: "today", label: "Hoy", emoji: "📅" },
    { key: "week", label: "Semana", emoji: "📆" },
    { key: "month", label: "Mes", emoji: "🗂️" },
    { key: "custom", label: "Custom", emoji: "⚙️" },
  ];

  const hasData = visibleServices.length > 0;
  const timelineKeys = timelineData.length > 0 ? Object.keys(timelineData[0]).filter((k) => k !== "name") : [];

  const timelineConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {};
    timelineKeys.forEach((key, i) => {
      cfg[key] = { label: key, color: colorForKey(key, i) };
    });
    return cfg;
  }, [timelineKeys, chartColorsList, appearanceOfColumn]);

  return (
    <div className="custom-scroll flex h-full flex-col gap-6 overflow-y-auto bg-background p-6 font-base text-foreground">
      {/* ── HEADER ── */}
      <div className="text-center">
        <Card className="inline-flex w-full max-w-md flex-row items-center gap-4 bg-main px-6 py-4 text-main-foreground sm:w-auto">
          <BarChart3 className="h-8 w-8 flex-shrink-0 text-main-foreground" />
          <div className="text-left">
            <h1 className="font-heading text-xl font-black uppercase tracking-wider text-main-foreground md:text-2xl">
              {isAdmin ? "Análisis General" : "Mis Estadísticas"}
            </h1>
            <p className="text-base font-base text-main-foreground/80">
              {isAdmin ? "Data de todos los empleados" : `Data de ${user?.dataColumn || user?.username || "ti"}`}
            </p>
          </div>
        </Card>
      </div>

      {/* ── DATE FILTERS ── */}
      <div className="flex flex-wrap items-center gap-3">
        {dateButtons.map((btn) => (
          <Button
            key={btn.key}
            onClick={() => setDateRange(btn.key)}
            variant={dateRange === btn.key ? "default" : "neutral"}
            className="text-sm font-black uppercase"
          >
            <span className="mr-1">{btn.emoji}</span> {btn.label}
          </Button>
        ))}
        {dateRange === "custom" && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-10 flex-1 text-sm sm:w-auto"
            />
            <span className="text-foreground">→</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-10 flex-1 text-sm sm:w-auto"
            />
          </div>
        )}
      </div>

      {!hasData ? (
        <Card className="flex flex-1 flex-col items-center justify-center gap-4 border-4 border-dashed border-border bg-secondary-background p-12">
          <span className="text-6xl">📊</span>
          <p className="font-heading text-xl font-black text-main md:text-2xl">Sin datos para este período</p>
          <p className="text-base text-foreground/70">Intenta otro rango de fechas</p>
        </Card>
      ) : (
        <>
          {/* ── KPI CARDS ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="items-center gap-2 bg-main py-6 text-center text-main-foreground">
              <DollarSign className="h-8 w-8 text-main-foreground" />
              <span className="font-heading text-2xl font-black text-main-foreground">{formatRD(kpis.totalEarnings)}</span>
              <Badge className="border-main-foreground/30 bg-main-foreground/10 text-main-foreground">
                Total Ingresos
              </Badge>
            </Card>
            <Card className="items-center gap-2 bg-main py-6 text-center text-main-foreground">
              <Activity className="h-8 w-8 text-main-foreground" />
              <span className="font-heading text-2xl font-black text-main-foreground">{kpis.totalCount}</span>
              <Badge className="border-main-foreground/30 bg-main-foreground/10 text-main-foreground">
                Servicios
              </Badge>
            </Card>
            <Card className="items-center gap-2 bg-main py-6 text-center text-main-foreground">
              <TrendingUp className="h-8 w-8 text-main-foreground" />
              <span className="font-heading text-2xl font-black text-main-foreground">{formatRD(kpis.avgPerDay)}</span>
              <Badge className="border-main-foreground/30 bg-main-foreground/10 text-main-foreground">
                Promedio/Día
              </Badge>
            </Card>
            <Card className="items-center gap-2 bg-main py-6 text-center text-main-foreground">
              <Crown className="h-8 w-8 text-main-foreground" />
              <span className="font-heading text-2xl font-black text-main-foreground">
                {kpis.bestDay ? new Date(kpis.bestDay).toLocaleDateString("es-DO", { month: "short", day: "numeric" }) : "—"}
              </span>
              <Badge className="border-main-foreground/30 bg-main-foreground/10 text-main-foreground">
                Mejor Día {kpis.bestAmount > 0 ? `(${formatRD(kpis.bestAmount)})` : ""}
              </Badge>
            </Card>
          </div>

          {/* ── AREA CHART (Trend) ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-2xl">
                <Calendar size={20} className="text-main" /> Tendencia de Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={areaConfig} className="h-72 w-full">
                <AreaChart data={areaData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.main} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={colors.main} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.chart2} opacity={0.4} />
                  <XAxis dataKey="label" stroke={colors.foreground} tick={{ fontSize: 11 }} />
                  <YAxis stroke={colors.foreground} tick={{ fontSize: 11 }} tickFormatter={(v) => `RD$${v}`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatRD(Number(v))} />} />
                  <Area type="monotone" dataKey="total" stroke={colors.main} strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* ── BOTTOM ROW: Bar + Pie ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Bar Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-heading text-2xl">
                  <BarChart3 size={20} className="text-main" /> Top Servicios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={barConfig} className="h-72 w-full">
                  <BarChart data={freqData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.chart2} opacity={0.4} horizontal={false} />
                    <XAxis type="number" stroke={colors.foreground} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" stroke={colors.foreground} tick={{ fontSize: 10 }} width={180} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v} veces`} />} />
                    <Bar dataKey="count" fill={colors.main} radius={[0, 8, 8, 0]} barSize={20} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Pie Chart (admin only) */}
            {isAdmin && empDist.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-heading text-2xl">
                    <PieIcon size={20} className="text-main" /> Por Empleado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={288}>
                    <PieChart>
                      <Pie
                        data={empDist}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${typeof percent === "number" ? (percent * 100).toFixed(0) : "0"}%`}
                        labelLine={false}
                      >
                        {empDist.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colorForKey(entry.name, index)} stroke={colors.border} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip formatter={(v) => formatRD(Number(v))} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <Card className="flex flex-col items-center justify-center gap-3 bg-secondary-background">
                <PieIcon size={40} className="text-main" />
                <p className="text-center text-base font-bold text-foreground/70">
                  {isAdmin ? "Sin datos de empleados" : "Distribución solo visible para admin"}
                </p>
              </Card>
            )}
          </div>

          {/* ── TIMELINE LINE CHART (admin: multi-line, employee: single) ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-2xl">
                <TrendingUp size={20} className="text-main" /> Evolución Diaria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={timelineConfig} className="h-72 w-full">
                <LineChart data={timelineData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.chart2} opacity={0.4} />
                  <XAxis dataKey="name" stroke={colors.foreground} tick={{ fontSize: 11 }} />
                  <YAxis stroke={colors.foreground} tick={{ fontSize: 11 }} tickFormatter={(v) => `RD$${v}`} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatRD(Number(v))} />} />
                  {timelineKeys.map((key, i) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={colorForKey(key, i)}
                      strokeWidth={3}
                      dot={{ r: 4, fill: colorForKey(key, i), stroke: colors.border, strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: colors.main }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatter?: (value: any) => string;
}> = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <Card className="gap-1 border-border bg-background p-3 text-foreground shadow-shadow">
      {label && <p className="font-heading text-sm">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-base" style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{formatter ? formatter(p.value) : p.value}</span>
        </p>
      ))}
    </Card>
  );
};
