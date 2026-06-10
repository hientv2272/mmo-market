"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, setUnauthorizedHandler } from "./api";
import type { ApiAuthResponse, ApiUser } from "./apiTypes";

const TOKEN_KEY = "mmo_token";
const USER_KEY = "mmo_user";

type AuthCtx = {
  user: ApiUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<ApiUser>;
  loginWithGoogle: (idToken: string) => Promise<ApiUser>;
  register: (email: string, password: string, username: string, displayName: string, referralCode?: string) => Promise<ApiUser>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      const u = localStorage.getItem(USER_KEY);
      if (t) setToken(t);
      if (u) setUser(JSON.parse(u));
    } catch {}
    setLoading(false);
  }, []);

  // Tự động đăng xuất khi 1 request có token bị 401 (token hỏng/hết hạn).
  useEffect(() => {
    setUnauthorizedHandler(() => {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } catch {}
      setToken(null);
      setUser(null);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?expired=1";
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const persist = (t: string | null, u: ApiUser | null) => {
    if (t && u) {
      localStorage.setItem(TOKEN_KEY, t);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    setToken(t);
    setUser(u);
  };

  const login = useCallback(async (email: string, password: string): Promise<ApiUser> => {
    const res = await apiFetch<ApiAuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    persist(res.accessToken, res.user);
    return res.user;
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string): Promise<ApiUser> => {
    const res = await apiFetch<ApiAuthResponse>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    persist(res.accessToken, res.user);
    return res.user;
  }, []);

  const register = useCallback(async (email: string, password: string, username: string, displayName: string, referralCode?: string): Promise<ApiUser> => {
    const res = await apiFetch<ApiAuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, username, displayName, referralCode }),
    });
    persist(res.accessToken, res.user);
    return res.user;
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const u = await apiFetch<ApiUser>("/api/auth/me", { token });
      setUser(u);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } catch {
      persist(null, null);
    }
  }, [token]);

  const logout = useCallback(() => persist(null, null), []);

  return (
    <Ctx.Provider value={{ user, token, loading, login, loginWithGoogle, register, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
