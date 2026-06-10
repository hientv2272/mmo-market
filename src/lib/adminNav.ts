import type { NavGroup } from "@/components/DashboardLayout";

export const adminNav: NavGroup[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: "dashboard" },
      { href: "/admin/users", label: "Người dùng", icon: "users" },
      { href: "/admin/sellers", label: "Người bán", icon: "shield" },
      { href: "/admin/products", label: "Sản phẩm", icon: "box" },
      { href: "/admin/orders", label: "Đơn hàng", icon: "package" },
    ],
  },
  {
    label: "Vận hành",
    items: [
      { href: "/admin/wallet", label: "Ví & Nạp tiền", icon: "wallet" },
      { href: "/admin/disputes", label: "Tranh chấp", icon: "alert" },
      { href: "/admin/finance", label: "Tài chính", icon: "dollar" },
      { href: "/admin/reports", label: "Báo cáo", icon: "bar" },
    ],
  },
  {
    label: "Cấu hình",
    items: [
      { href: "/admin/banners", label: "Banner & Flash sale", icon: "image" },
      { href: "/admin/fees", label: "Phí sàn & Loyalty", icon: "sliders" },
      { href: "/admin/plans", label: "Gói Seller", icon: "crown" },
      { href: "/admin/settings", label: "Cấu hình hệ thống", icon: "settings" },
    ],
  },
];
