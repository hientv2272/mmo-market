import type { NavGroup } from "@/components/DashboardLayout";

export const sellerNav: NavGroup[] = [
  {
    items: [
      { href: "/seller/dashboard", label: "Tổng quan", icon: "dashboard" },
      { href: "/seller/orders", label: "Đơn hàng", icon: "package" },
      { href: "/seller/products", label: "Sản phẩm", icon: "box" },
      { href: "/seller/inventory", label: "Kho auto-deliv", icon: "database" },
      { href: "/seller/reviews", label: "Đánh giá", icon: "star" },
    ],
  },
  {
    label: "Tài chính",
    items: [
      { href: "/seller/finance", label: "Doanh thu", icon: "bar" },
      { href: "/seller/withdraw", label: "Rút tiền", icon: "arrowDown" },
      { href: "/seller/wallet", label: "Nạp ví", icon: "wallet" },
      { href: "/seller/plan", label: "Gói thành viên", icon: "crown" },
      { href: "/seller/coupons", label: "Mã giảm giá", icon: "ticket" },
    ],
  },
  {
    label: "Tài khoản shop",
    items: [
      {
        href: "/seller/kyc",
        label: "KYC",
        icon: "shield",
        badge: "Cập nhật",
      },
      { href: "/seller/messages", label: "Tin nhắn", icon: "message" },
      { href: "/seller/notifications", label: "Thông báo", icon: "bell" },
      { href: "/seller/settings", label: "Cài đặt shop", icon: "settings" },
    ],
  },
];
