"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";

type PublicConfig = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  siteName: string;
  registrationEnabled: boolean;
};

// Bọc toàn app: khi admin bật chế độ bảo trì, người dùng thường bị chặn truy cập.
// Admin/SuperAdmin và trang /login vẫn vào được để có thể đăng nhập + tắt bảo trì.
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [cfg, setCfg] = useState<PublicConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      apiFetch<PublicConfig>("/api/config/public")
        .then((c) => { if (!cancelled) setCfg(c); })
        .catch(() => { /* lỗi tải → coi như không bảo trì, không chặn nhầm */ });
    load();
    // Tự cập nhật khi admin bật/tắt bảo trì mà người dùng không cần F5.
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const isAdmin = user?.role === "Admin" || user?.role === "SuperAdmin";
  const onLoginPage = pathname.startsWith("/login");
  const blocked = !loading && cfg?.maintenanceMode === true && !isAdmin && !onLoginPage;

  if (blocked) {
    return <MaintenanceScreen message={cfg!.maintenanceMessage} siteName={cfg!.siteName} />;
  }
  return <>{children}</>;
}

function MaintenanceScreen({ message, siteName }: { message: string; siteName: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-warning/15 text-warning">
          <Wrench className="size-8" />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-text">{siteName} đang bảo trì</h1>
        <p className="mt-3 text-sm leading-7 text-text-muted">{message}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
          >
            Thử lại
          </button>
          <Link
            href="/login"
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg-elev hover:text-text"
          >
            Đăng nhập quản trị
          </Link>
        </div>
      </div>
    </div>
  );
}
