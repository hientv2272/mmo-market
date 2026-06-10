"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  Crown,
  Bell,
  Box,
  Database,
  DollarSign,
  Gift,
  Heart,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Star,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiAdminMetrics } from "@/lib/apiTypes";

const iconMap: Record<string, LucideIcon> = {
  alert: AlertTriangle,
  arrowDown: ArrowDownToLine,
  bar: BarChart3,
  bell: Bell,
  crown: Crown,
  box: Box,
  database: Database,
  dollar: DollarSign,
  gift: Gift,
  heart: Heart,
  image: ImageIcon,
  dashboard: LayoutDashboard,
  message: MessageCircle,
  package: Package,
  settings: Settings,
  shield: ShieldCheck,
  shop: ShoppingBag,
  sliders: Sliders,
  star: Star,
  ticket: Ticket,
  users: Users,
  wallet: Wallet,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof iconMap;
  badge?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function DashboardLayout({
  groups,
  title,
  subtitle,
  topRight,
  children,
  variant = "buyer",
}: {
  groups: NavGroup[];
  title: string;
  subtitle?: string;
  topRight?: React.ReactNode;
  children: React.ReactNode;
  variant?: "buyer" | "seller" | "admin";
}) {
  const pathname = usePathname();
  const { user, token, logout } = useAuth();

  // Số đếm thật cho badge sidebar (đơn cần xử lý / khiếu nại mở). Override theo href.
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        if (variant === "buyer") {
          const [orders, disputes] = await Promise.all([
            apiFetch<{ status: string }[]>("/api/orders", { token }),
            apiFetch<{ status: string }[]>("/api/disputes/mine", { token }),
          ]);
          if (cancelled) return;
          setCounts({
            "/account/orders": orders.filter((o) => o.status === "PendingPayment" || o.status === "Checking").length,
            "/account/disputes": disputes.filter((d) => d.status === "Open").length,
          });
        } else if (variant === "seller") {
          const d = await apiFetch<{ ordersAwaitingDelivery: number; openDisputes: number }>("/api/seller/dashboard", { token });
          if (cancelled) return;
          setCounts({ "/seller/orders": d.ordersAwaitingDelivery });
        } else if (variant === "admin") {
          const m = await apiFetch<ApiAdminMetrics>("/api/admin/metrics", { token });
          if (cancelled) return;
          setCounts({
            "/admin/sellers": m.kycPending,       // seller chờ duyệt KYC
            "/admin/products": m.productsPending, // sản phẩm chờ duyệt
            "/admin/disputes": m.openDisputes,    // khiếu nại đang mở
            "/admin/wallet": m.pendingWithdrawals, // lệnh rút chờ xử lý
          });
        }
      } catch {
        /* badge là phụ trợ — bỏ qua lỗi tải */
      }
    })();
    return () => { cancelled = true; };
  }, [token, variant]);

  const badgeFor = (item: NavItem): string | undefined => {
    if (item.href in counts) {
      const n = counts[item.href];
      return n > 0 ? String(n) : undefined; // ẩn badge khi = 0
    }
    return item.badge; // giữ badge tĩnh khác (vd KYC "Cập nhật")
  };

  const variantBadge = {
    buyer: { label: "Buyer", color: "bg-accent text-black" },
    seller: { label: "Seller", color: "bg-brand text-white" },
    admin: { label: "Admin", color: "bg-danger text-white" },
  }[variant];

  return (
    <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-bg-elev/40 lg:flex">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Logo />
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
              variantBadge.color,
            )}
          >
            {variantBadge.label}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g, gi) => (
            <div key={gi} className={gi > 0 ? "mt-6" : ""}>
              {g.label && (
                <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-text-dim">
                  {g.label}
                </div>
              )}
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const Icon = iconMap[item.icon] ?? LayoutDashboard;
                  const badge = badgeFor(item);
                  const active =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                          active
                            ? "bg-brand-soft text-text"
                            : "text-text-muted hover:bg-bg-elev hover:text-text",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4",
                            active ? "text-brand" : "text-text-muted",
                          )}
                        />
                        <span className="flex-1">{item.label}</span>
                        {badge && (
                          <span className="rounded-full bg-danger/20 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3 space-y-1">
          {user && (
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2">
              <span
                className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-white"
                style={{ background: user.avatarColor }}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-text">{user.displayName}</p>
                <p className="truncate text-[11px] text-text-muted">{user.email}</p>
              </div>
            </div>
          )}
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-text-muted hover:bg-bg-elev hover:text-text"
          >
            ← Quay lại sàn
          </Link>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-text-muted hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-bg/80 px-6 backdrop-blur-xl">
          <div>
            <h1 className="text-base font-bold text-text">{title}</h1>
            {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
          </div>
          <div className="ml-auto flex items-center gap-2">{topRight}</div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
