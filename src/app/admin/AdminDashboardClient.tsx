"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, DollarSign, Loader2, Package, ShieldCheck, ShoppingBag, Users } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Stat } from "@/components/ui/Stat";
import { adminNav } from "@/lib/adminNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiAdminMetrics } from "@/lib/apiTypes";
import { formatVND } from "@/lib/format";

export function AdminDashboardClient() {
  const { user, token, loading: authLoading } = useAuth();
  const [m, setM] = useState<ApiAdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<ApiAdminMetrics>("/api/admin/metrics", { token })
      .then((d) => setM(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (authLoading || (token && loading)) {
    return (
      <DashboardLayout variant="admin" groups={adminNav} title="Admin Dashboard" subtitle="Đang tải...">
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-text-muted" /></div>
      </DashboardLayout>
    );
  }

  if (!user || !token) {
    return (
      <DashboardLayout variant="admin" groups={adminNav} title="Admin Dashboard" subtitle="">
        <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
          <p className="text-sm text-text-muted">Vui lòng <Link href="/login" className="text-accent hover:underline">đăng nhập</Link> bằng tài khoản admin.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !m) {
    return (
      <DashboardLayout variant="admin" groups={adminNav} title="Admin Dashboard" subtitle="">
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">{error ?? "Không có dữ liệu"}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      variant="admin"
      groups={adminNav}
      title="Admin Dashboard"
      subtitle="Tổng quan toàn sàn · 30 ngày gần nhất"
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="GMV 30 ngày" value={formatVND(m.gmv)} delta={<span className="inline-flex items-center gap-0.5 text-success"><ArrowUpRight className="size-3" /> live</span>} icon={<DollarSign className="size-4" />} tone="success" />
        <Stat label="Doanh thu sàn (5%)" value={formatVND(m.revenue)} delta={`${m.ordersCompleted} đơn hoàn thành`} icon={<ShoppingBag className="size-4" />} tone="brand" />
        <Stat label="User mới" value={String(m.newUsers)} delta="Trong 30 ngày" icon={<Users className="size-4" />} tone="accent" />
        <Stat label="Tranh chấp mở" value={String(m.openDisputes)} delta={m.openDisputes > 0 ? "Cần xử lý!" : "Không có"} icon={<AlertTriangle className="size-4" />} tone={m.openDisputes > 0 ? "warning" : "success"} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Link href="/admin/products" className="rounded-2xl border border-border bg-bg-card p-5 hover:border-brand">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Sản phẩm chờ duyệt</h3>
            <Package className="size-5 text-brand" />
          </div>
          <p className="mt-2 text-3xl font-bold text-text">{m.productsPending}</p>
          <p className="mt-1 text-xs text-text-muted">Click để duyệt</p>
        </Link>
        <Link href="/admin/sellers" className="rounded-2xl border border-border bg-bg-card p-5 hover:border-brand">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">KYC chờ duyệt</h3>
            <ShieldCheck className="size-5 text-accent" />
          </div>
          <p className="mt-2 text-3xl font-bold text-text">{m.kycPending}</p>
          <p className="mt-1 text-xs text-text-muted">Xác minh seller</p>
        </Link>
        <Link href="/admin/finance" className="rounded-2xl border border-border bg-bg-card p-5 hover:border-brand">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Yêu cầu rút tiền</h3>
            <DollarSign className="size-5 text-warning" />
          </div>
          <p className="mt-2 text-3xl font-bold text-text">{m.pendingWithdrawals}</p>
          <p className="mt-1 text-xs text-text-muted">Đang chờ duyệt</p>
        </Link>
      </div>
    </DashboardLayout>
  );
}
