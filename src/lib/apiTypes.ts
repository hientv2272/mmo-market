export type ApiCategory = {
  slug: string;
  name: string;
  short: string;
  iconKey: string;
  description: string;
  color: string;
  productCount: number;
};

export type ApiSellerSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  rating: number;
  reviewCount: number;
  totalSold: number;
  badge?: string | null;
  kycStatus: string;
  trustScore: number;
};

export type ApiProductListItem = {
  id: string;
  slug: string;
  title: string;
  categorySlug: string;
  price: number;
  comparePrice?: number | null;
  delivery: "Auto" | "Manual" | "Hybrid";
  warrantyDays: number;
  stock: number;
  sold: number;
  rating: number;
  reviewCount: number;
  thumbnailColor: string;
  thumbnailIcon?: string | null;
  badges: string[];
  seller: ApiSellerSummary;
};

export type ApiProductDetail = ApiProductListItem & {
  description: string;
  features: string[];
  policies: string[];
  faq: { q: string; a: string }[];
  reviews: ApiReview[];
};

export type ApiReview = {
  id: string;
  buyerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  reply?: string | null;
};

export type ApiProductListResponse = {
  items: ApiProductListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type ApiUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  walletBalance: number;
  loyaltyPoints: number;
  kycStatus: string;
  avatarColor: string;
  phoneNumber?: string | null;
  twoFactorEnabled: boolean;
};

export type ApiTwoFaSetup = {
  qrUrl: string;
  secret: string;
};

export type ApiAuthResponse = {
  accessToken: string;
  user: ApiUser;
};

export type ApiCartLine = {
  cartItemId: string;
  product: ApiProductListItem;
  quantity: number;
  subtotal: number;
};

export type ApiCart = {
  lines: ApiCartLine[];
  subtotal: number;
  totalItems: number;
};

export type ApiOrderLine = {
  id: string;
  productId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  delivery: string;
  deliveredItems?: string[] | null;
};

export type ApiOrder = {
  id: string;
  code: string;
  status: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  createdAt: string;
  paidAt?: string | null;
  deliverDueAt?: string | null;
  deliveredAt?: string | null;
  escrowReleaseAt?: string | null;
  completedAt?: string | null;
  lines: ApiOrderLine[];
};

export type ApiMoMoPayResult = {
  payUrl: string;
  deepLink?: string | null;
  qrCodeUrl?: string | null;
  requestId: string;
};

export type ApiZaloPayResult = {
  orderUrl: string;
  zpTransToken: string;
};

export type ApiVNPayResult = {
  paymentUrl: string;
};

export type ApiVietQrResult = {
  qrImageUrl: string;
  bankId: string;
  accountNo: string;
  accountName: string;
  transferNote: string;
};

export type ApiUsdtPayResult = {
  address: string;
  usdtAmount: number;
  qrImageUrl: string;
  exchangeRate: number;
};

export type ApiUsdtCheckResult = {
  found: boolean;
  alreadyPaid?: boolean;
};

export type ApiWalletTxn = {
  id: string;
  type: string;
  status: string;
  amount: number;
  note: string;
  createdAt: string;
};

export type ApiWalletState = {
  balance: number;
  heldBalance: number;
  loyaltyPoints: number;
  transactions: ApiWalletTxn[];
};

export type ApiSellerProduct = {
  id: string;
  slug: string;
  title: string;
  categorySlug: string;
  price: number;
  comparePrice?: number | null;
  delivery: string;
  warrantyDays: number;
  stock: number;
  sold: number;
  rating: number;
  reviewCount: number;
  thumbnailColor: string;
  thumbnailIcon?: string | null;
  status: string;
  description: string;
  inventoryAvailable: number;
  inventoryReserved: number;
  inventorySold: number;
  depositAmount: number;
  depositStatus: string; // None | Held | Refunded | Forfeited
  boostedUntil?: string | null;
};

export type ApiSellerOrderLine = {
  orderId: string;
  orderLineId: string;
  orderCode: string;
  status: string;
  productId: string;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  delivery: string;
  buyerDisplayName: string;
  createdAt: string;
  paidAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  deliveredItems?: string[] | null;
};

export type ApiSellerInventoryItem = {
  id: string;
  preview: string;
  reserved: boolean;
  sold: boolean;
  orderId?: string | null;
  createdAt: string;
};

export type ApiSellerInventoryView = {
  productId: string;
  productSlug: string;
  productTitle: string;
  available: number;
  reserved: number;
  soldCount: number;
  items: ApiSellerInventoryItem[];
};

export type ApiSellerWithdraw = {
  id: string;
  amount: number;
  method: string;
  account: string;
  status: string;
  note?: string | null;
  adminNote?: string | null;
  createdAt: string;
  processedAt?: string | null;
};

export type ApiSellerDashboard = {
  revenue30d: number;
  orders30d: number;
  productsActive: number;
  productsPending: number;
  ordersAwaitingDelivery: number;
  openDisputes: number;
  pendingWithdrawals: number;
  availableBalance: number;
  trustScore: number;
};

export type ApiAdminOrderLine = {
  id: string;
  productId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  delivery: string;
};

export type ApiAdminOrder = {
  id: string;
  code: string;
  status: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  buyerUsername: string;
  buyerEmail: string;
  buyerAvatarColor: string;
  note?: string | null;
  createdAt: string;
  paidAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  lines: ApiAdminOrderLine[];
};

export type ApiAdminUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  avatarColor: string;
  walletBalance: number;
  loyaltyPoints: number;
  kycStatus: string;
  phoneNumber?: string | null;
  createdAt: string;
};

export type ApiAdminProduct = {
  id: string;
  slug: string;
  title: string;
  categorySlug: string;
  price: number;
  stock: number;
  sold: number;
  rating: number;
  status: string;
  sellerUsername: string;
  createdAt: string;
};

export type ApiAdminWithdraw = {
  id: string;
  sellerUserId: string;
  sellerUsername: string;
  amount: number;
  method: string;
  account: string;
  status: string;
  note?: string | null;
  adminNote?: string | null;
  createdAt: string;
  processedAt?: string | null;
};

export type ApiAdminMetrics = {
  gmv: number;
  revenue: number;
  ordersCompleted: number;
  newUsers: number;
  kycPending: number;
  productsPending: number;
  openDisputes: number;
  pendingWithdrawals: number;
};

export type KvInt     = { key: string; value: number };
export type KvDecimal = { key: string; value: number };
export type TopUserDto    = { username: string; avatarColor: string; total: number; orderCount: number };
export type TopProductDto = { title: string; sold: number; price: number; sellerUsername: string };

export type ApiAdminReport = {
  totalUsers: number;
  totalSellers: number;
  totalWalletBalance: number;
  userByRole: KvInt[];
  userByKyc: KvInt[];
  totalOrders: number;
  totalGmv: number;
  totalRevenue: number;
  orderByStatus: KvInt[];
  orderByPayment: KvInt[];
  revenueByPayment: KvDecimal[];
  topBuyers: TopUserDto[];
  totalProducts: number;
  totalSold: number;
  productByStatus: KvInt[];
  productByCategory: KvInt[];
  topProducts: TopProductDto[];
  totalTopup: number;
  totalPurchase: number;
  totalRefund: number;
  totalWithdraw: number;
  totalDisputes: number;
  disputeByStatus: KvInt[];
};

export type ApiKycSubmission = {
  id: string;
  status: string;
  fullName: string;
  idNumber: string;
  address: string;
  phoneNumber: string;
  createdAt: string;
  rejectionReason?: string | null;
  frontImage?: string | null;
  backImage?: string | null;
};

export type ApiFinanceReconciliation = {
  platformRevenue: number;
  escrowHeld: number;
  totalRefunded: number;
  depositsHeld: number;
  depositsForfeited: number;
  totalTopup: number;
  totalWithdrawn: number;
  userWalletTotal: number;
};

export type ApiDisputeMessage = {
  id: string;
  authorUserId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
};

export type ApiDisputeListItem = {
  id: string;
  code: string;
  orderId: string;
  orderCode: string;
  title: string;
  status: string;
  createdAt: string;
  slaUntil: string;
  resolution?: string | null;
};

export type ApiDisputeDetail = {
  id: string;
  code: string;
  orderId: string;
  orderCode: string;
  buyerId: string;
  sellerId: string;
  title: string;
  body: string;
  status: string;
  resolution?: string | null;
  slaUntil: string;
  createdAt: string;
  messages: ApiDisputeMessage[];
};

export type ApiOwnReview = {
  id: string;
  productId: string;
  productTitle: string;
  productSlug?: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  reply?: string | null;
};

export type ApiAdminWalletUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: string;
  walletBalance: number;
  loyaltyPoints: number;
  txnCount: number;
  createdAt: string;
};

export type ApiAdminWalletOverview = {
  totalBalance: number;
  totalUsers: number;
  totalTopup: number;
  totalSpent: number;
  pendingTopups: number;
};

export type ApiAdminWalletTxn = {
  id: string;
  type: string;
  status: string;
  amount: number;
  note: string;
  createdAt: string;
};

export type ApiCoupon = {
  id: string;
  code: string;
  description: string;
  type: "Percent" | "Fixed";
  value: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  maxUses: number;
  usedCount: number;
  expiresAt?: string | null;
  isActive: boolean;
  usedByMe: boolean;
};

export type ApiValidateResult = {
  valid: boolean;
  error?: string | null;
  discount: number;
  message?: string | null;
};

export type ApiWishlistItem = {
  id: string;
  slug: string;
  title: string;
  categorySlug: string;
  price: number;
  comparePrice?: number | null;
  thumbnailColor: string;
  thumbnailIcon?: string | null;
  rating: number;
  reviewCount: number;
  sold: number;
  delivery: string;
  warrantyDays: number;
  sellerUsername: string;
  sellerAvatarColor: string;
  addedAt: string;
};

export type ApiNotification = {
  id: string;
  type: string;       // order | wallet | review | dispute | kyc | system
  title: string;
  body: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
};

export type ApiConversation = {
  id: string;
  otherPartyName: string;
  otherPartyAvatarColor: string;
  otherPartyUsername: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
};

export type ApiChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "Buyer" | "Seller";
  body: string;
  createdAt: string;
};

export type ApiSellerCoupon = {
  id: string;
  code: string;
  description: string;
  type: "Percent" | "Fixed";
  value: number;
  minOrderAmount: number;
  maxDiscount?: number | null;
  maxUses: number;
  usedCount: number;
  expiresAt?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type ApiSystemSettings = {
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  contactPhone: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  registrationEnabled: boolean;
  welcomeBonus: number;
  minWithdraw: number;
  maxWithdraw: number;
  escrowReleaseDays: number;
  disputeSlaHours: number;
  kycRequiredToSell: boolean;
  enabledPayments: string[];
};

export type ApiFeeConfig = {
  feePercent: number;
};

export type ApiLoyaltyConfig = {
  ptsPer1000: number;
  signupBonus: number;
  reviewBonus: number;
  referralBonus: number;
  tierSilver: number;
  tierGold: number;
  tierDiamond: number;
};

export type ApiLoyaltyReward = {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  type: "Voucher" | "Shipping" | "Product";
  voucherAmount: number;
  isActive: boolean;
  isComingSoon: boolean;
  position: number;
  createdAt: string;
};

export type ApiBanner = {
  id: string;
  title: string;
  subtitle: string;
  linkUrl?: string | null;
  bgColor: string;
  textColor: string;
  position: number;
  isActive: boolean;
  clickCount: number;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
};

export type ApiFlashSale = {
  id: string;
  title: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  status: "Draft" | "Active" | "Ended";
  productCount: number;
  createdAt: string;
};

// ── P1: Gói thành viên Seller & phí theo danh mục ──────────────────────────
export type ApiSellerPlan = {
  code: string;
  name: string;
  pricePerMonth: number;
  feeDiscountPercent: number;
  maxListings: number;       // -1 = không giới hạn
  boostsPerMonth: number;
  badge?: string | null;
  position: number;
  isActive: boolean;
};

export type ApiCurrentPlan = {
  code: string;
  name: string;
  feeDiscountPercent: number;
  maxListings: number;
  boostsPerMonth: number;
  badge?: string | null;
  expiresAt?: string | null;
  active: boolean;
};

export type ApiFeeTier = {
  id: string;
  categorySlug: string;
  minPrice: number;
  maxPrice?: number | null;
  sellerFeePercent: number;
  note?: string | null;
};

export type ApiAdminPlan = {
  id: string;
  code: string;
  name: string;
  pricePerMonth: number;
  feeDiscountPercent: number;
  maxListings: number;   // -1 = không giới hạn
  boostsPerMonth: number;
  badge?: string | null;
  position: number;
  isActive: boolean;
};

export type ApiBoostInfo = {
  quota: number;
  used: number;
  remaining: number;
  durationHours: number;
};
