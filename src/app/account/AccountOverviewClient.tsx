"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Gift, Loader2, Package, ShoppingBag, Users, Wallet } from "lucide-react";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiOrder, ApiWalletState } from "@/lib/apiTypes";
import type { OrderStatus } from "@/lib/types";
import { formatRelativeTime, formatVND } from "@/lib/format";

const statusMap: Record<string, OrderStatus> = {
  PendingPayment: "PENDING_PAYMENT",
  EscrowLocked: "ESCROW_LOCKED",
  Delivering: "DELIVERING",
  Checking: "CHECKING",
  Completed: "COMPLETED",
  Disputed: "DISPUTED",
  Refunded: "REFUNDED",
  Cancelled: "CANCELLED",
};

export function AccountOverviewClient() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [wallet, setWallet] = useState<ApiWalletState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user && (user.role === "Admin" || user.role === "SuperAdmin")) {
      router.replace("/admin");
      return;
    }
    if (!token) return;
    Promise.all([
      apiFetch<ApiOrder[]>("/api/orders", { token }),
      apiFetch<ApiWalletState>("/api/wallet", { token }),
    ])
      .then(([o, w]) => { setOrders(o); setWallet(w); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, authLoading, user, router]);

  if (authLoading || (token && loading)) {
    return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-text-muted" /></div>;
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
        <p className="text-sm text-text-muted">Vui lòng <Link href="/login" className="text-accent hover:underline">đăng nhập</Link>.</p>
      </div>
    );
  }

  const recentOrders = orders.slice(0, 4);
  const recentTxns = (wallet?.transactions || []).slice(0, 4);
  const completed = orders.filter((o) => o.status === "Completed").length;
  const dispute = orders.filter((o) => o.status === "Disputed").length;

  return (
    <>
      <div className="mb-4 text-lg font-semibold text-text">
        Xin chào, {user.displayName} 👋
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Số dư ví" value={formatVND(user.walletBalance)} delta={`Đang giữ escrow: ${formatVND(wallet?.heldBalance || 0)}`} icon={<Wallet className="size-4" />} tone="accent" />
        <Stat label="Tổng đơn" value={String(orders.length)} delta={`${completed} hoàn thành${dispute > 0 ? ` · ${dispute} dispute` : ""}`} icon={<Package className="size-4" />} tone="brand" />
        <Stat label="Điểm thưởng" value={user.loyaltyPoints.toLocaleString("vi-VN")} delta="Tích thêm khi mua" icon={<Gift className="size-4" />} tone="warning" />
        <Stat label="Hạng KYC" value={user.kycStatus} delta={user.kycStatus === "Approved" ? "Đã xác thực" : "Hãy submit KYC"} icon={<Users className="size-4" />} tone="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-border bg-bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-bold text-text">Đơn hàng gần đây</h2>
            <Link href="/account/orders" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
              Xem tất cả <ArrowRight className="size-3" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">Chưa có đơn nào. <Link href="/marketplace" className="text-accent hover:underline">Đi mua sắm</Link></div>
          ) : (
            <ul className="divide-y divide-border">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center gap-4 px-5 py-3 hover:bg-bg-elev/30">
                  <div className="grid size-10 place-items-center rounded-xl bg-bg-elev text-text-muted"><ShoppingBag className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-text">{o.code}</span>
                      <OrderStatusBadge status={statusMap[o.status] || "PENDING_PAYMENT"} />
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-text-muted">
                      {o.lines.map((l) => l.title).join(", ")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-sm font-semibold text-text">{formatVND(o.total)}</div>
                    <div className="text-xs text-text-muted">{formatRelativeTime(o.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-bold text-text">Hoạt động ví</h2>
            <Link href="/account/wallet" className="text-xs text-accent hover:underline">Chi tiết →</Link>
          </div>
          {recentTxns.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">Chưa có giao dịch.</div>
          ) : (
            <ul className="divide-y divide-border">
              {recentTxns.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`grid size-8 place-items-center rounded-lg text-xs ${t.amount > 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                    {t.amount > 0 ? "+" : "−"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-xs text-text">{t.note}</div>
                    <div className="text-[11px] text-text-muted">{formatRelativeTime(t.createdAt)} · {t.status}</div>
                  </div>
                  <div className={`num text-sm font-semibold ${t.amount > 0 ? "text-success" : "text-danger"}`}>
                    {t.amount > 0 ? "+" : ""}{formatVND(t.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/marketplace"><Button>Tiếp tục mua sắm</Button></Link>
        <Link href="/account/wallet"><Button variant="outline">Nạp ví</Button></Link>
        <Link href="/seller/kyc"><Button variant="soft">Đăng ký bán hàng</Button></Link>
      </div>
    </>
  );
}
