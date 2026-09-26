import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../services/api";
import LoadingScreen from "../components/LoadingScreen";
import ForcePasswordChange from "../components/ForcePasswordChange";

type UserRole = "admin" | "digitador" | "auxiliar" | "employee";

interface User {
  id: number;
  username: string;
  name?: string;
  email?: string;
  role: UserRole;
  dataColumn: string | null;
  color?: string | null;
  avatar?: string | null;
  mustChangePassword?: boolean;
  isActive?: boolean;
  inPayroll?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isDigitador: boolean;
  isAuxiliar: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Keep the session token in exactly one place: localStorage when "recuérdame"
// is on (survives closing the browser), sessionStorage otherwise. Every reader
// prefers localStorage, so a leftover copy there would shadow a newer session.
function storeToken(token: string, rememberMe: boolean) {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
  if (rememberMe) {
    localStorage.setItem("token", token);
    localStorage.setItem("rememberMe", "true");
  } else {
    sessionStorage.setItem("token", token);
    localStorage.removeItem("rememberMe");
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Try to load user via HttpOnly cookie (no localStorage needed)
    loadUser();
  }, []);

  // A 401 with a token gets only a few quick retries: a token that is genuinely
  // expired should not keep the user waiting (or bouncing) on the login screen.
  const AUTH_RETRIES = 3;

  const loadUser = async (retries = 20, authRetries = AUTH_RETRIES) => {
    setLoading(true);
    let retryScheduled = false;
    const isRememberMe = localStorage.getItem("rememberMe") === "true";
    const hasToken = !!(localStorage.getItem("token") || sessionStorage.getItem("token"));
    console.log(`[AuthContext] loadUser attempt (retries=${retries}, rememberMe=${isRememberMe}, hasToken=${hasToken})`);
    try {
      const response = await authAPI.getCurrentUser();
      console.log("[AuthContext] loadUser success");
      // Sliding session: the backend sends a renewed token when the current one is getting old
      if (response.data.token) {
        storeToken(response.data.token, localStorage.getItem("rememberMe") === "true");
      }
      setUser(response.data.user || response.data);
    } catch (error: any) {
      const status = error.response?.status;
      console.log(`[AuthContext] loadUser failed — status: ${status}, message: ${error.message}`);

      // If we HOLD a token, almost any failure is transient (backend redeploy /
      // Railway cold start / network blip). Keep retrying with backoff for ~2 min
      // instead of dropping the session — this is what forced a re-login on every deploy.
      if (hasToken && retries > 0 && status !== 401) {
        const delay = Math.min(1500 + (20 - retries) * 500, 6000); // 1.5s ramping to 6s
        console.log(`[AuthContext] Backend unavailable, retrying in ${delay}ms...`);
        retryScheduled = true;
        setTimeout(() => loadUser(retries - 1, authRetries), delay);
        return; // keep loading=true while retrying
      }

      if (status === 401) {
        if (hasToken && authRetries > 0) {
          // A 401 right after a redeploy can be a momentary read of a stale cookie or
          // the backend still warming up. Retry a few times before concluding the
          // token is genuinely invalid.
          console.log("[AuthContext] 401 with token present, retrying in 3s...");
          retryScheduled = true;
          setTimeout(() => loadUser(retries, authRetries - 1), 3000);
          return;
        }
        // Genuine invalid token after all retries: clear session.
        console.log("[AuthContext] Clearing session after persistent 401");
        localStorage.removeItem("token");
        localStorage.removeItem("rememberMe");
        sessionStorage.removeItem("token");
        setUser(null);
      } else if (retries > 0 && !error.response && !hasToken) {
        // No token at all + network error: just retry quietly
        retryScheduled = true;
        setTimeout(() => loadUser(retries - 1, authRetries), 1500);
        return;
      }
      // Final non-401 failure: stay visually logged out but DON'T wipe the token —
      // a refresh once the backend is back recovers the session.
      setUser(null);
    } finally {
      // Only leave the loading screen once we've decided. Toggling it between
      // retries unmounted the login form every few seconds and erased what the
      // user was typing.
      if (!retryScheduled) setLoading(false);
    }
  };

  const login = async (username: string, password: string, rememberMe = false) => {
    try {
      const response = await authAPI.login(username, password, rememberMe);
      const { token, user } = response.data;

      if (token) storeToken(token, rememberMe);
      setUser(user);
      navigate("/");
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Login failed");
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout(); // Backend clears HttpOnly cookie
    } catch (err) {
      // Ignore — always clear local state
    }
    localStorage.removeItem("token");
    localStorage.removeItem("rememberMe");
    sessionStorage.removeItem("token");
    setUser(null);
    navigate("/login");
  };

  const refreshUser = async () => {
    const response = await authAPI.getCurrentUser();
    setUser(response.data.user || response.data);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        refreshUser,
        isAdmin: user?.role === "admin",
        isDigitador: user?.role === "digitador" || user?.role === "employee",
        isAuxiliar: user?.role === "auxiliar",
        hasRole: (...roles) => !!user && roles.includes(user.role),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  // Admin-issued temporary password: nothing else is reachable until it's replaced
  if (user.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  return <>{children}</>;
};
