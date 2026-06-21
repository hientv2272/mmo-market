"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Box,
  DollarSign,
  Loader2,
  Package,
  ShieldCheck,
  ShoppingBag,
  Star,
  Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { sellerNav } from "@/lib/sellerNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiSellerDashboard, ApiSellerOrderLine, ApiSellerProduct } from "@/lib/apiTypes";
import type { OrderStatus } from "@/lib/types";
import { formatNumber, formatRelativeTime, formatVND } from "@/lib/format";

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

export function SellerDashboardClient() {
  const { user, token, loading: authLoading } = useAuth();
  const [dash, setDash] = useState<ApiSellerDashboard | null>(null);
  const [products, setProducts] = useState<ApiSellerProduct[]>([]);
  const [orders, setOrders] = useState<ApiSellerOrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<ApiSellerDashboard>("/api/seller/dashboard", { token }),
      apiFetch<ApiSellerProduct[]>("/api/seller/products", { token }),
      apiFetch<ApiSellerOrderLine[]>("/api/seller/orders", { token }),
    ])
      .then(([d, p, o]) => {
        setDash(d);
        setProducts(p);
        setOrders(o);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (authLoading || (token && loading)) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Kênh người bán" subtitle="Đang tải...">
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-text-muted" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user || !token) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Kênh người bán" subtitle="">
        <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
          <p className="text-sm text-text-muted">
            Vui lòng <Link href="/login" className="text-accent hover:underline">đăng nhập</Link> để xem dashboard seller.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !dash) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Kênh người bán" subtitle="">
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">
          {error || "Bạn chưa được kích hoạt seller. Hãy submit KYC trước."}
        </div>
      </DashboardLayout>
    );
  }

  const topProducts = [...products].sort((a, b) => b.sold - a.sold).slice(0, 5);
  const recentOrders = orders.slice(0, 5);

  return (
    <DashboardLayout
      variant="seller"
      groups={sellerNav}
      title="Kênh người bán"
      subtitle="Tổng quan kinh doanh 30 ngày · dữ liệu thời gian thực"
      topRight={
        <Link href="/seller/products">
          <Button size="sm">+ Thêm sản phẩm</Button>
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Stat
          label="Doanh thu 30 ngày"
          value={formatVND(dash.revenue30d)}
          delta={
            <span className="inline-flex items-center gap-0.5 text-success">
              <ArrowUpRight className="size-3" /> {dash.orders30d} đơn
            </span>
          }
          icon={<DollarSign className="size-4" />}
          tone="success"
        />
        <Stat
          label="Số dư khả dụng"
          value={formatVND(dash.availableBalance)}
          delta={dash.pendingWithdrawals > 0 ? `${dash.pendingWithdrawals} yêu cầu rút chờ duyệt` : "Có thể rút"}
          icon={<ShoppingBag className="size-4" />}
          tone="brand"
        />
        <Stat
          label="Đơn cần xử lý"
          value={String(dash.ordersAwaitingDelivery)}
          delta={dash.openDisputes > 0 ? `${dash.openDisputes} tranh chấp đang mở` : "Không có dispute"}
          tone={dash.openDisputes > 0 ? "warning" : "accent"}
          icon={<Users className="size-4" />}
        />
        <Stat
          label="Sản phẩm"
          value={String(dash.productsActive)}
          delta={dash.productsPending > 0 ? `${dash.productsPending} chờ duyệt` : "Tất cả đã duyệt"}
          icon={<Box className="size-4" />}
          tone="accent"
        />
        <Stat
          label="Điểm uy tín"
          value={`${dash.trustScore}/100`}
          delta={dash.trustScore >= 80 ? "Uy tín tốt" : dash.trustScore >= 50 ? "Cần cải thiện" : "Rủi ro cao"}
          icon={<ShieldCheck className="size-4" />}
          tone={dash.trustScore >= 80 ? "success" : dash.trustScore >= 50 ? "warning" : "danger"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-border bg-bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-text">Doanh thu theo ngày</h2>
              <p className="text-xs text-text-muted">Ước tính 14 ngày gần nhất</p>
            </div>
          </div>
          <div className="mt-6 flex h-48 items-end gap-1.5">
            {Array.from({ length: 14 }).map((_, i) => {
              const v = Math.max(20, Math.round((dash.revenue30d / 30) * (0.6 + 0.8 * Math.random()) / 100000));
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-brand/40 to-accent transition hover:from-brand/60"
                  style={{ height: `${Math.min(100, v)}%` }}
                  title={`Day ${i + 1}`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
            <span>14 ngày trước</span>
            <span>Hôm nay</span>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-bg-card p-5">
          <h2 className="text-base font-bold text-text">Sản phẩm bán chạy</h2>
          {topProducts.length === 0 ? (
            <p className="mt-3 text-xs text-text-muted">Chưa có sản phẩm nào.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {topProducts.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="num size-5 shrink-0 grid place-items-center rounded-md bg-bg-elev text-[10px] font-bold text-text-muted">
                    {i + 1}
                  </span>
                  <div
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
                    style={{ background: p.thumbnailColor }}
                  >
                    {p.thumbnailIcon ?? p.title[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-xs text-text">{p.title}</div>
                    <div className="text-[11px] text-text-muted">
                      {formatNumber(p.sold)} đã bán · <span className="inline-flex items-center gap-0.5">{p.rating} <Star className="size-3 fill-warning text-warning" /></span>
                    </div>
                  </div>
                  <div className="num text-xs font-semibold text-success">
                    {formatVND(p.price).replace(/\s?₫/, "")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-bold text-text">Đơn hàng cần xử lý</h2>
          <Link href="/seller/products" className="text-xs text-accent hover:underline">
            Quản lý sản phẩm →
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-text-muted">Chưa có đơn nào</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-5 py-3">Mã đơn</th>
                <th className="px-5 py-3">Sản phẩm</th>
                <th className="px-5 py-3">Khách</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3 text-right">Tổng</th>
                <th className="px-5 py-3 text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentOrders.map((o) => (
                <tr key={o.orderLineId} className="hover:bg-bg-elev/30">
                  <td className="px-5 py-3">
                    <span className="font-mono text-text">{o.orderCode}</span>
                  </td>
                  <td className="px-5 py-3 line-clamp-1 max-w-xs text-text-muted">{o.productTitle}</td>
                  <td className="px-5 py-3 text-text-muted">{o.buyerDisplayName}</td>
                  <td className="px-5 py-3">
                    <OrderStatusBadge status={statusMap[o.status] ?? "DELIVERING"} />
                  </td>
                  <td className="num px-5 py-3 text-right font-semibold text-text">{formatVND(o.lineTotal)}</td>
                  <td className="px-5 py-3 text-right text-xs text-text-muted">
                    {formatRelativeTime(o.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </DashboardLayout>
  );
}
