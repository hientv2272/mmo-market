"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Store } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

function isSeller(role?: string) {
  return role === "Seller" || role === "Admin" || role === "SuperAdmin";
}

export function SellerGuard({ children }: { children: React.ReactNode }) {
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

  if (!isSeller(user.role)) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand/10">
            <Store className="size-8 text-brand" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-text">Bạn chưa phải người bán</h1>
          <p className="mt-2 text-sm text-text-muted">
            Trang này chỉ dành cho tài khoản Seller. Bạn đang đăng nhập với vai trò{" "}
            <span className="font-semibold text-text">{user.role}</span>.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link
              href="/seller/onboarding"
              className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand/90"
            >
              Đăng ký bán hàng
            </Link>
            <Link
              href="/account"
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-text hover:bg-bg-elev"
            >
              Tài khoản của tôi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
