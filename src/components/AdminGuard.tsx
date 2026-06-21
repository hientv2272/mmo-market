"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

function isAdmin(role?: string) {
  return role === "Admin" || role === "SuperAdmin";
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <Loader2 className="size-8 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin(user.role)) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-danger/10">
            <ShieldAlert className="size-8 text-danger" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-text">Không có quyền truy cập</h1>
          <p className="mt-2 text-sm text-text-muted">
            Trang này chỉ dành cho tài khoản Admin. Bạn đang đăng nhập với vai trò{" "}
            <span className="font-semibold text-text">{user.role}</span>.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand/90"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
