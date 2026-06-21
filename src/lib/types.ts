// Core domain types modeled after MMO Market spec.

export type CategorySlug =
  | "ai"
  | "tool"
  | "course"
  | "giftcard"
  | "game"
  | "social"
  | "engagement"
  | "bestseller";

export type DeliveryMethod = "auto" | "manual" | "hybrid";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "ESCROW_LOCKED"
  | "DELIVERING"
  | "CHECKING"
  | "COMPLETED"
  | "DISPUTED"
  | "REFUNDED"
  | "CANCELLED";

export type PaymentMethod =
  | "wallet"
  | "vietqr"
  | "momo"
  | "zalopay"
  | "vnpay"
  | "usdt"
  | "btc";

export type UserRole = "guest" | "buyer" | "seller" | "ctv" | "admin" | "superadmin";

export interface Category {
  slug: CategorySlug;
  name: string;
  short: string;
  iconKey: string;
  description: string;
  color: string;
  productCount: number;
}

export interface Seller {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  rating: number; // 0..5
  reviewCount: number;
  joinedAt: string; // ISO
  totalSold: number;
  badge?: "verified" | "top" | "new";
  bio?: string;
  responseTime?: string;
  kycStatus: "pending" | "approved" | "rejected";
  trustScore?: number;
  logoUrl?: string;
  bannerUrl?: string;
  contactEmail?: string;
  contactZalo?: string;
  contactTelegram?: string;
  warrantyPolicy?: string;
  returnPolicy?: string;
  isOnVacation?: boolean;
  vacationMessage?: string;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  category: CategorySlug;
  thumbnailColor: string;
  thumbnailIcon?: string;
  image?: string; // ảnh đại diện duy nhất (data URL hoặc URL ngoài)
  images?: string[];
  price: number;
  comparePrice?: number;
  rating: number;
  reviewCount: number;
  sold: number;
  stock: number;
  delivery: DeliveryMethod;
  warrantyDays: number;
  sellerId: string;
  seller?: {
    id: string;
    username: string;
    displayName: string;
    avatarColor: string;
    badge?: "verified" | "top" | "new";
  };
  badges?: ("flash" | "new" | "top" | "limited")[];
  shortDescription: string;
  description: string;
  features: string[];
  policies: string[];
  faq: { q: string; a: string }[];
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  productId: string;
  buyerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  reply?: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface OrderLine {
  productId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  sellerId: string;
  delivery: DeliveryMethod;
  // Auto-delivered payload (mock)
  deliveredItems?: { account: string; password?: string; note?: string }[];
}

export interface Order {
  id: string;
  buyerName: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  total: number;
  fee: number;
  discount: number;
  createdAt: string;
  lines: OrderLine[];
}

export interface WalletTxn {
  id: string;
  type: "topup" | "purchase" | "refund" | "withdraw" | "commission" | "bonus";
  amount: number; // positive = credit, negative = debit
  status: "pending" | "completed" | "failed";
  createdAt: string;
  note: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badge?: string;
  href: string;
  gradient: string;
}
