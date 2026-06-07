"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { apiFetch, API_URL } from "./api";
import { useAuth } from "./AuthContext";

type NotificationCtx = {
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const Ctx = createContext<NotificationCtx | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { token, loading: authLoading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!token) { setUnreadCount(0); return; }
    try {
      const data = await apiFetch<{ count: number }>("/api/notifications/unread-count", { token });
      setUnreadCount(data.count);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    if (!authLoading) fetchCount();
  }, [authLoading, fetchCount]);

  // Realtime: nhận thông báo qua SignalR (#7)
  useEffect(() => {
    if (!token) return;
    const conn = new HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/notifications`, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    conn.on("notification", () => setUnreadCount((c) => c + 1));
    conn.start().catch(() => { /* hub không sẵn sàng → bỏ qua, vẫn dùng polling */ });

    return () => {
      conn.off("notification");
      if (conn.state !== HubConnectionState.Disconnected) conn.stop().catch(() => {});
    };
  }, [token]);

  const markRead = useCallback(async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "PUT", token });
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  }, [token]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      await apiFetch("/api/notifications/read-all", { method: "PUT", token });
      setUnreadCount(0);
    } catch { /* silent */ }
  }, [token]);

  return (
    <Ctx.Provider value={{ unreadCount, refresh: fetchCount, markRead, markAllRead }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
