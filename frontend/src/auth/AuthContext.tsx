import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { config } from "../api/config";
import { getCurrentUser, type AuthUser } from "../api/client";
import { findDemoUser } from "./demo-users";

const TOKEN_STORAGE_KEY = "vital_edges_demo_token";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  reloadSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      setUser(null);
      setError(null);
      setStatus("unauthenticated");
      return;
    }

    setStatus("loading");
    try {
      const currentUser = await getCurrentUser(token);
      setUser(currentUser);
      setError(null);
      setStatus("authenticated");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load the current session.";
      setUser(null);
      setError(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (config.authMode !== "demo") {
      setError("Supabase sign-in is not configured in this local foundation build.");
      setStatus("error");
      return;
    }

    const demoUser = findDemoUser(email, password);
    if (!demoUser) {
      setError("Use one of the documented demo accounts for local development.");
      setStatus("unauthenticated");
      return;
    }

    window.localStorage.setItem(TOKEN_STORAGE_KEY, demoUser.token);
    await loadSession();
  }, [loadSession]);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setError(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    error,
    signIn,
    signOut,
    reloadSession: loadSession,
  }), [error, loadSession, signIn, signOut, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}