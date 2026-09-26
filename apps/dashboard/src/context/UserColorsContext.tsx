import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
import { findUserByColumn, toAppearance, type Appearance, type DirectoryUser } from "../lib/userColors";

interface UserColorsContextType {
  users: DirectoryUser[];
  appearanceOf: (userId?: number | null) => Appearance;
  appearanceOfColumn: (column?: string | null) => Appearance;
  refresh: () => Promise<void>;
}

const UserColorsContext = createContext<UserColorsContextType | undefined>(undefined);

const REFRESH_MS = 60_000;

export const UserColorsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<DirectoryUser[]>([]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/dashboard/users");
      setUsers(data.users || []);
    } catch (err) {
      console.error("[UserColors] failed to load users", err);
    }
  }, []);

  useEffect(() => {
    // No directory while logged out or while a temporary password must be replaced (the API refuses it)
    if (!user || user.mustChangePassword) {
      setUsers([]);
      return;
    }
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id, user?.mustChangePassword, refresh]);

  const value = useMemo<UserColorsContextType>(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      users,
      appearanceOf: (userId) => toAppearance(userId != null ? byId.get(Number(userId)) : undefined),
      appearanceOfColumn: (column) =>
        toAppearance(findUserByColumn(users, column), (column || "?").replace("_", " ")),
      refresh,
    };
  }, [users, refresh]);

  return <UserColorsContext.Provider value={value}>{children}</UserColorsContext.Provider>;
};

export function useUserColors(): UserColorsContextType {
  const ctx = useContext(UserColorsContext);
  if (!ctx) throw new Error("useUserColors must be used inside UserColorsProvider");
  return ctx;
}
