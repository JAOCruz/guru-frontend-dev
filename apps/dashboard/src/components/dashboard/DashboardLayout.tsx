import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { NeoBadge } from "@guru/ui";
import GuruAdvisor from "../GuruAdvisor";
import { cn } from "@guru/ui";
import api, { getAPIUrl } from "../../services/api";
import {
  Menu,
  X,
  LayoutDashboard,
  Database,
  BarChart3,
  Sparkles,
  LogOut,
  Settings,
  MessageSquare,
  Wifi,
  Users,
  BarChart2,
  Briefcase,
  FileText,
  Brain,
  Bot,
  Palette,
  Bird,
  Bell,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const { headingFont, setHeadingFont } = useTheme();

  // Notifications
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Array<{ id: number; title: string; message: string; read: boolean; created_at: string; link?: string }>>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Unread WhatsApp messages badge (new inbound messages employees haven't opened)
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Pending invoice approval badge (admin only)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch(`${getAPIUrl()}/api/notifications/unread-count`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token") || ""}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count || 0);
        }
      } catch {
        // ignore
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Poll unread WhatsApp message count for the "Mensajes" badge
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${getAPIUrl()}/api/messages/unread-count`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token") || ""}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadMessages(data.count || 0);
        }
      } catch {
        // ignore
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000); // check often so the badge feels live
    return () => clearInterval(interval);
  }, []);

  // Poll pending invoice approvals for admin badge
  useEffect(() => {
    if (!isAdmin) return;
    const fetchPending = async () => {
      try {
        const res = await api.get("/invoices/pending-approval-count");
        setPendingApprovalCount(res.data.count || 0);
      } catch {
        // ignore
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const openNotifications = async () => {
    setShowNotifications((v) => !v);
    if (!showNotifications) {
      try {
        const res = await fetch(`${getAPIUrl()}/api/notifications?limit=10`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token") || ""}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {
        // ignore
      }
    }
  };

  const markRead = async (id: number) => {
    try {
      await fetch(`${getAPIUrl()}/api/notifications/${id}/read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token") || ""}`,
        },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location, isMobile]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const [advisorMessageOpen, setAdvisorMessageOpen] = useState(() => {
    const saved = localStorage.getItem("guru-advisor-visible");
    return saved === null ? true : saved === "true";
  });

  const toggleAdvisor = () => {
    setAdvisorMessageOpen((v) => {
      const next = !v;
      localStorage.setItem("guru-advisor-visible", String(next));
      return next;
    });
  };

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-background font-base text-foreground">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 flex h-full flex-col border-r-2 border-border bg-main shadow-sidebar transition-all duration-300 ease-in-out ${
          isMobile
            ? sidebarOpen
              ? "w-64 translate-x-0"
              : "w-64 -translate-x-full"
            : sidebarOpen
              ? "w-64"
              : "w-20"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b-2 border-border bg-[#0000CC] p-4">
          {sidebarOpen || isMobile ? (
            <h1 className="font-heading truncate text-3xl md:text-4xl font-black tracking-tight text-white">
              Gurú<span className="text-white">Dash</span>
            </h1>
          ) : (
            <div className="mx-auto font-heading text-4xl md:text-5xl font-black text-white">
              G
            </div>
          )}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-base border-2 border-white/30 p-1 text-white hover:bg-white/20"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          <NavItem
            to="/"
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />
          <NavItem
            to="/data"
            icon={<Database size={18} />}
            label="Datos"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />
          <NavItem
            to="/charts"
            icon={<BarChart3 size={18} />}
            label="Gráficos"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />
          <NavItem
            to="/ai-guru"
            icon={<Sparkles size={18} />}
            label="Gurú AI"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />

          {/* WhatsApp section — flat, everything one click away (no collapsed submenu) */}
          {isAdmin && (
            <NavItem
              to="/whatsapp"
              icon={<Wifi size={18} />}
              label="WhatsApp Bot"
              sidebarOpen={sidebarOpen}
              isMobile={isMobile}
            />
          )}
          <NavItem
            to="/bot-messages"
            icon={<MessageSquare size={18} />}
            label="Mensajes"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
            badge={unreadMessages > 0 ? unreadMessages : null}
          />
          <NavItem
            to="/bot-clients"
            icon={<Users size={18} />}
            label="Clientes"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />
          <NavItem
            to="/cotizaciones"
            icon={<FileText size={18} />}
            label="Cotizaciones"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
            badge={isAdmin ? pendingApprovalCount : null}
          />
          <NavItem
            to="/cases"
            icon={<Briefcase size={18} />}
            label="Casos"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />
          <NavItem
            to="/documents"
            icon={<FileText size={18} />}
            label="Documentos"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />
          <NavItem
            to="/services-catalog"
            icon={<Database size={18} />}
            label="Catálogo Precios"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />
          {isAdmin && (
            <>
              <NavItem
                to="/motherbrain"
                icon={<Brain size={18} />}
                label="Mother Brain"
                sidebarOpen={sidebarOpen}
                isMobile={isMobile}
              />
              <NavItem
                to="/bot-simulator"
                icon={<Bot size={18} />}
                label="Simulador Bot"
                sidebarOpen={sidebarOpen}
                isMobile={isMobile}
              />
              <NavItem
                to="/simulator-review"
                icon={<MessageSquare size={18} />}
                label="Revisión Simulador"
                sidebarOpen={sidebarOpen}
                isMobile={isMobile}
              />
            </>
          )}

          <NavItem
            to="/ai-insights"
            icon={<BarChart2 size={18} />}
            label="IA Analytics"
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
          />

          {isAdmin && (
            <NavItem
              to="/settings"
              icon={<Settings size={18} />}
              label="Configuración"
              sidebarOpen={sidebarOpen}
              isMobile={isMobile}
            />
          )}
        </nav>

        <div className="border-t-2 border-border bg-[#0000CC] p-4">
          <div
            className={`flex items-center gap-3 ${!sidebarOpen && !isMobile ? "justify-center" : ""}`}
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-base border-2 border-border bg-secondary-background text-sm font-black text-foreground shadow-button">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            {(sidebarOpen || isMobile) && (
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">
                  {user?.username}
                </p>
                <button
                  onClick={logout}
                  className="flex cursor-pointer items-center gap-1 text-[10px] font-black uppercase tracking-wider text-white/80 hover:underline"
                >
                  <LogOut size={10} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`relative z-10 flex min-h-screen min-w-0 flex-1 flex-col overflow-x-hidden transition-all duration-300 ease-in-out ${
          isMobile ? "ml-0" : sidebarOpen ? "ml-64" : "ml-20"
        }`}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-border bg-background px-4 shadow-header md:h-20 md:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="rounded-base border-2 border-border bg-main p-2 text-main-foreground shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              <Menu size={22} />
            </button>
            <h2 className="font-heading text-lg font-black md:text-2xl">
              {isAdmin ? "Panel Admin" : "Panel Usuario"}
              {!isAdmin && user?.dataColumn && (
                <NeoBadge className="ml-3 hidden md:inline-flex">
                  {user.dataColumn}
                </NeoBadge>
              )}
            </h2>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={toggleAdvisor}
              className={`rounded-base border-2 border-border p-2 shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
                advisorMessageOpen
                  ? "bg-main text-main-foreground"
                  : "bg-secondary-background text-foreground"
              }`}
              title={advisorMessageOpen ? "Ocultar búho Gurú" : "Mostrar búho Gurú"}
            >
              <Bird size={20} />
            </button>

            <div className="relative">
              <button
                onClick={openNotifications}
                className="relative rounded-base border-2 border-border bg-secondary-background p-2 text-foreground shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                title="Notificaciones"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-border bg-red-500 px-1 text-[10px] font-black text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-base border-2 border-border bg-background p-3 shadow-shadow">
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-foreground/60">Notificaciones</p>
                  {notifications.length === 0 ? (
                    <p className="py-4 text-center text-sm text-foreground/50">Sin notificaciones</p>
                  ) : (
                    <div className="max-h-72 space-y-2 overflow-y-auto custom-scroll">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            markRead(n.id);
                            if (n.link) {
                              window.location.href = n.link.startsWith("/") ? n.link : `/dashboard${n.link}`;
                            }
                          }}
                          className={`cursor-pointer rounded-base border-2 p-2 transition-all hover:bg-secondary-background ${
                            n.read ? "border-transparent opacity-60" : "border-main bg-main/5"
                          }`}
                        >
                          <p className="text-sm font-bold text-foreground">{n.title}</p>
                          <p className="text-xs text-foreground/70 line-clamp-2">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowThemeMenu((v) => !v)}
                className="rounded-base border-2 border-border bg-secondary-background p-2 text-foreground shadow-button transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                title="Fuente de títulos"
              >
                <Palette size={20} />
              </button>
              {showThemeMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-base border-2 border-border bg-background p-3 shadow-shadow">
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-foreground/60">Fuente títulos</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setHeadingFont("space"); setShowThemeMenu(false); }}
                      className={`flex-1 rounded-base border-2 px-2 py-1.5 text-xs font-black transition-all ${headingFont === "space" ? "border-border bg-main text-main-foreground" : "border-border bg-secondary-background text-foreground"}`}
                    >
                      Space
                    </button>
                    <button
                      onClick={() => { setHeadingFont("oswald"); setShowThemeMenu(false); }}
                      className={`flex-1 rounded-base border-2 px-2 py-1.5 text-xs font-black transition-all ${headingFont === "oswald" ? "border-border bg-main text-main-foreground" : "border-border bg-secondary-background text-foreground"}`}
                    >
                      Oswald
                    </button>
                  </div>
                </div>
              )}
            </div>

            <span className="text-xs font-black tracking-widest uppercase text-foreground/60">
              Sesión: <span className="text-main">{user?.username}</span>
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="h-full min-w-0 p-4 md:p-8">
          <div className="mx-auto min-w-0 max-w-7xl">{children}</div>
        </main>
      </div>

      {<GuruAdvisor isOpen={advisorMessageOpen}  onOpenChange={setAdvisorMessageOpen}/>}
    </div>
  );
};

const NavItem = ({ to, icon, label, sidebarOpen, isMobile, badge }: any) => (
  <NavLink
    to={to}
    end={to === "/"}
    className={({ isActive }) =>
      cn(
        "group flex w-full items-center gap-3 rounded-base border-2 px-4 py-3 font-base transition-all",
        isActive
          ? "border-border bg-secondary-background text-foreground shadow-shadow"
          : "border-transparent bg-[#0000CC] text-white hover:border-white/30",
        !sidebarOpen && !isMobile && "justify-center"
      )
    }
  >
    <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center">
      {icon}
      {badge != null && badge > 0 && !sidebarOpen && !isMobile && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-border bg-red-500 px-0.5 text-[8px] font-black text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </div>
    {(sidebarOpen || isMobile) && <span className="font-bold flex-1 text-left">{label}</span>}
    {badge != null && badge > 0 && (sidebarOpen || isMobile) && (
      <span className="ml-auto flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-border bg-red-500 px-1 text-[10px] font-black text-white">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </NavLink>
);

export default DashboardLayout;
