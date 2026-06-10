import type { NavGroup } from "@/components/DashboardLayout";

export const buyerNav: NavGroup[] = [
  {
    items: [
      { href: "/account", label: "Tổng quan", icon: "dashboard" },
      { href: "/account/orders", label: "Đơn hàng", icon: "package" },
      { href: "/account/wallet", label: "Ví & nạp tiền", icon: "wallet" },
      { href: "/account/wishlist", label: "Yêu thích", icon: "heart" },
    ],
  },
  {
    label: "Khách hàng",
    items: [
      { href: "/account/reviews", label: "Đánh giá", icon: "star" },
      { href: "/account/disputes", label: "Khiếu nại", icon: "alert" },
      { href: "/account/chat", label: "Tin nhắn", icon: "message" },
      { href: "/account/notifications", label: "Thông báo", icon: "bell" },
    ],
  },
  {
    label: "Ưu đãi",
    items: [
      { href: "/account/loyalty", label: "Điểm thưởng", icon: "gift" },
      { href: "/account/coupons", label: "Mã giảm giá", icon: "ticket" },
      { href: "/account/referral", label: "Giới thiệu bạn", icon: "users" },
    ],
  },
  {
    label: "Cài đặt",
    items: [
      { href: "/account/settings", label: "Hồ sơ & bảo mật", icon: "settings" },
    ],
  },
];
