import axios from "axios";

export const getAPIUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3000";
  const host = window.location.hostname;
  // Production domains → Railway backend
  if (host === "gurusolucionesrd.com" || host === "www.gurusolucionesrd.com" || host.includes("netlify.app")) {
    return "https://guruweb-backend-production.up.railway.app";
  }
  // Tailscale / remote LAN access
  if (host === "100.87.41.106") {
    return "http://100.87.41.106:3000";
  }
  // Local
  return "http://localhost:3000";
};

const API_URL = import.meta.env.VITE_API_URL || (getAPIUrl() + "/api");

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Send HttpOnly cookies cross-origin
});

// Request interceptor: prefer HttpOnly cookie, fallback to stored token
api.interceptors.request.use(
  (config) => {
    // The browser sends the HttpOnly cookie automatically (withCredentials: true).
    // We keep localStorage/sessionStorage fallback for backward-compat and remember me.
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      // Axios 1.x uses AxiosHeaders — use .set() to be safe
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't wipe tokens here automatically. AuthContext decides whether to
      // clear the session after retries, otherwise a transient 401 during a
      // backend restart logs the user out even with "remember me" enabled.
      const rememberMe = localStorage.getItem("rememberMe") === "true";
      if (!rememberMe) {
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
      }
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  login: (email: string, password: string, rememberMe?: boolean) =>
    api.post("/auth/login", { email, password, rememberMe }),

  logout: () => api.post("/auth/logout"),

  getCurrentUser: () => api.get("/auth/me"),

  updateAppearance: (data: { color?: string; avatar?: string | null }) =>
    api.put("/auth/me/appearance", data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put("/auth/change-password", { currentPassword, newPassword }),
};
export const servicesAPI = {
  getServices: (startDate?: string, endDate?: string) =>
    api.get("/services", { params: { startDate, endDate } }),

  createService: (data: {
    username: string;
    serviceName: string;
    client?: string;
    earnings: number;
    date?: string;
  }) => api.post("/services", data), // Removed 'time' from interface

  getUserStats: (userId?: number) =>
    api.get(`/services/stats/user/${userId || ""}`),

  getAdminStats: () => api.get("/services/stats/admin"),

  deleteService: (id: number) => api.delete(`/services/${id}`),

  updateComment: (id: number, comment: string) =>
    api.put(`/services/${id}/comment`, { comment }),
};

export const serviceCatalogAPI = {
  getAll: () => api.get("/service-catalog"),
  getCategories: () => api.get("/service-catalog/categories/list"),
  create: (data: any) => api.post("/service-catalog", data),
  update: (id: number, data: any) => api.put(`/service-catalog/${id}`, data),
  delete: (id: number) => api.delete(`/service-catalog/${id}`),
  calculate: (data: { serviceId: number; assetValue?: number; quantity?: number }) =>
    api.post("/service-catalog/calculate", data),
};

export const settingsAPI = {
  getCurrentPercentage: () => api.get("/settings/current"),

  getPercentageForDate: (date?: string) =>
    api.get("/settings/percentage", { params: { date } }),

  getHistory: () => api.get("/settings/history"),

  updateEmployeePercentage: (percentage: number, effectiveDate: string) =>
    api.post("/settings/percentage", { percentage, effectiveDate }),

  deleteSetting: (id: number) => api.delete(`/settings/${id}`),
};

export default api;
