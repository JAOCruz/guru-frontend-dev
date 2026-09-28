import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import * as Sentry from "@sentry/react";
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import { AuthProvider, ProtectedRoute } from "./context/AuthContext.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { UserColorsProvider } from "./context/UserColorsContext.tsx";

import "./index.css";
import DialogHost from "./components/DialogHost";

// Initialize Sentry if DSN is provided
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}

const isDashboardBuild = import.meta.env.VITE_BUILD_TARGET === "dashboard";

const DashboardRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/dashboard" element={<Navigate to="/" replace />} />
    <Route
      path="/*"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
  </Routes>
);

const DefaultRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/dashboard" element={<Navigate to="/" replace />} />
    <Route
      path="/*"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
  </Routes>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p className="p-8 text-center text-red-500">Ha ocurrido un error inesperado. Por favor recarga la página.</p>}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <UserColorsProvider>
              {isDashboardBuild ? <DashboardRoutes /> : <DefaultRoutes />}
              <DialogHost />
            </UserColorsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
