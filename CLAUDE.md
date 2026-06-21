@AGENTS.md

# MMO Market

Sàn giao dịch (marketplace) mua bán tài khoản / sản phẩm số ("MMO") với escrow, ví nội bộ, nhiều cổng thanh toán và hệ thống seller/affiliate. Repo gồm **frontend Next.js** (`src/`) và **backend .NET API** (`backend/`).

> Ghi chú/giao tiếp trong code và commit dùng **tiếng Việt**. Giữ nguyên phong cách này khi viết comment hoặc message mới.

## Tech stack

**Frontend** (thư mục gốc repo)
- Next.js 16 (App Router) + React 19, TypeScript
- Tailwind CSS v4 (`@tailwindcss/postcss`)
- SignalR client (`@microsoft/signalr`) cho realtime (chat, thông báo)
- Google OAuth (`@react-oauth/google`)
- Không có state lib ngoài React Context (xem `src/lib/*Context.tsx`)

**Backend** (`backend/`)
- ASP.NET Core Web API (.NET), kiến trúc Clean Architecture 4 layer
- EF Core + **SQLite** (`Data Source` trong `ConnectionStrings:Default`)
- JWT Bearer auth; SignalR Hubs (`/hubs`, token qua `?access_token=`)
- Rate limiting 100 req/phút/IP, mã hoá AES-256 cho dữ liệu nhạy cảm

## Cấu trúc backend (Clean Architecture)

```
backend/MmoMarket.sln
backend/src/
  MmoMarket.Domain          # Entities, Enums, Common — không phụ thuộc layer khác
  MmoMarket.Application      # Business logic theo feature (services, DTOs)
  MmoMarket.Infrastructure   # EF Core (AppDbContext, Seeder), Auth, Email, Security
  MmoMarket.Api              # Controllers, Hubs, Middleware, BackgroundJobs, Program.cs
```

- **Domain/Entities**: `User, Seller, Product, Order, PaymentTransaction, WalletTxn, WithdrawRequest, Dispute, Coupon, SellerPlan, Banner, Notification, Conversation/ChatMessage, KycSubmission, Review, FlashSale, ...`
- **Application**: tổ chức theo feature — `Orders, Payments, Wallet, Sellers, Catalog, Cart, Coupons, Disputes, Loyalty, Referrals, Reviews, Notifications, Messages, Admin, Fees, Stats, Config`.
- **Payments**: mỗi cổng là 1 service riêng — `MoMoService, ZaloPayService, VNPayService, SePayPgService, UsdtService` (TRC20), `PaymentLogService`.
- **Api/Controllers**: 1 controller / domain (`OrderController, WalletController, SellerController, PaymentController, AdminController, ...`).
- **Api/BackgroundJobs**: `OrderEscrowWorker` (hosted service) tự động giải ngân escrow.
- **Api/Hubs**: SignalR realtime; push thông báo qua `INotificationPusher` → `SignalRNotificationPusher`.

## Cấu trúc frontend

```
src/
  app/          # App Router — route theo thư mục
    account/    # khu vực người mua (orders, wallet, chat, disputes, loyalty, referral, ...)
    seller/     # khu vực người bán (dashboard, products, orders, finance, withdraw, plan, kyc, ...)
    admin/      # khu vực quản trị (users, sellers, products, finance, fees, banners, disputes, ...)
    p/[slug]    # trang sản phẩm | c/[slug] danh mục | seller/[username] gian hàng
    checkout, cart, marketplace, flash-sale, ...
  components/   # UI tái sử dụng (Header, DashboardLayout, *PayModal, *Guard, ProductCard, ...)
  lib/          # api.ts (fetch wrapper), apiTypes.ts, *Context.tsx, *Nav.ts, format.ts, ...
```

- Gọi API qua `apiFetch` trong [src/lib/api.ts](src/lib/api.ts); base URL = `NEXT_PUBLIC_API_URL`.
- Auth/Notification/Wishlist state nằm trong React Context (`src/lib/*Context.tsx`, mount qua `Providers.tsx`).
- Navigation theo vai trò: `buyerNav.ts`, `sellerNav.ts`, `adminNav.ts`.
- Guard component (`AdminGuard`, `SellerGuard`) bảo vệ route theo role; `MaintenanceGate` cho chế độ bảo trì.

## Chạy & build

**Frontend** (từ thư mục gốc repo):
```bash
npm run dev      # dev server http://localhost:3000
npm run build
npm run lint
```

**Backend** (cần `NEXT_PUBLIC_API_URL` trỏ về đây):
```bash
cd backend
dotnet run --project src/MmoMarket.Api    # http://localhost:5199 (https://localhost:7173)
```

`.env.local` (frontend) trỏ `NEXT_PUBLIC_API_URL=http://localhost:5199`. Cấu hình backend (JWT, cổng thanh toán, Email, Encryption, MarketingStats) nằm trong `backend/src/MmoMarket.Api/appsettings.json` — các key trong đó là **giá trị sandbox/test**, không phải production secret.

## Quy ước

- Backend serialize enum dạng string + ép UTC cho `DateTime` (`Json/UtcDateTimeConverter`). Khi thêm field thời gian, giữ chuẩn UTC.
- Mỗi tính năng mới: thêm Entity (Domain) → service (Application) → controller (Api) → kiểu & gọi API (frontend `apiTypes.ts` + page).
- Đọc `docs/` để nắm kế hoạch tính năng (vd `docs/bot-system-plan.md`).

## Luồng nghiệp vụ chi tiết

### 1. Vòng đời đơn hàng & Escrow

`OrderStatus`: `PendingPayment → EscrowLocked → Delivering → Checking → Completed` (nhánh phụ: `Disputed`, `Refunded`, `Cancelled`). Code trong [OrderService.cs](backend/src/MmoMarket.Application/Orders/OrderService.cs).

1. **Checkout** (`CheckoutAsync`) — tạo `Order` từ giỏ.
   - Trả bằng **ví** (`PaymentMethod.Wallet`): trừ `WalletBalance`, ghi `WalletTxn(Purchase)`, đơn vào thẳng `EscrowLocked` → gọi `ProcessPaidOrderAsync`.
   - Trả bằng **cổng ngoài** (VietQR/SePay/MoMo/ZaloPay/VNPay/USDT): đơn ở `PendingPayment`, chờ xác nhận thanh toán.
2. **Xác nhận thanh toán ngoài** — qua IPN/webhook hoặc reconcile (`ConfirmExternalPaymentAsync`, `ConfirmExternalPaymentByTransferNoteAsync`, `ReconcilePendingSePayAsync`): đơn chuyển `EscrowLocked`, tiền coi như đã vào escrow → `ProcessPaidOrderAsync`.
3. **`ProcessPaidOrderAsync` (bàn giao kho theo từng dòng):**
   - `Auto` → phải đủ hàng trong kho (`InventoryItems`, FIFO theo `CreatedAt`), thiếu thì **chặn** thanh toán.
   - `Hybrid` → lấy được bao nhiêu giao bấy nhiêu, phần thiếu chờ giao tay.
   - `Manual` → luôn chờ seller giao tay.
   - Item kho được giải mã (`_enc.Decrypt`) và lưu vào `line.DeliveredItemsJson` (KHÔNG sinh dữ liệu giả).
   - Nếu **mọi dòng đã giao đủ** → `Checking`, đặt `EscrowReleaseAt = now + EscrowReleaseDays` (mặc định 2 ngày/48h).
   - Còn dòng chờ giao tay → `Delivering`, đặt `DeliverDueAt = now + DeliverWindowHours` (mặc định T+2h).
   - Đồng thời: cộng `product.Sold`/`seller.TotalSold`, trừ tồn kho, **khóa phí sàn** `line.FeeAmount` (theo `FeeConfig`/category/seller tại thời điểm trả), cộng điểm loyalty cho buyer.
4. **Giải ngân (release escrow)** → `Completed`:
   - Buyer bấm xác nhận (`ConfirmReceivedAsync`, chỉ khi `Checking`), **hoặc**
   - Tự động khi hết cửa sổ kiểm tra (`AutoReleaseEscrowAsync`, chạy bởi worker).
   - Khi `Completed`: cập nhật trust score seller (`OnOrderCompletedSellersAsync`) và trả hoa hồng affiliate (`RewardAffiliateAsync`).
5. **Hủy & hoàn tiền:**
   - Seller trễ bàn giao (`AutoCancelStaleAsync`, khi `DeliverDueAt <= now` ở `EscrowLocked`/`Delivering`): `Cancelled`, **hoàn 100%** vào ví buyer (`WalletTxn(Refund)`), **tịch thu cọc đăng tin** (`ListingDepositStatus.Forfeited`), trừ trust score seller.
   - Đơn `PendingPayment` quá hạn chưa trả (`CancelStalePendingPaymentAsync`): `Cancelled`, hoàn lượt coupon đã giữ.

### 2. Background worker — `OrderEscrowWorker`

Hosted service chạy mỗi **1 phút** (delay 15s sau khi app khởi động). Mỗi vòng gọi tuần tự:
`AutoReleaseEscrowAsync` (giải ngân) · `AutoCancelStaleAsync` (hủy + hoàn do seller trễ) · `TrustScoreService.Award30dCleanBonusAsync` · `WalletTopupService.ExpireStalePendingAsync` (nạp ví quá hạn) · `OrderService.ReconcilePendingSePayAsync` (đối soát đơn SePay) · `CancelStalePendingPaymentAsync` (hủy đơn quá hạn thanh toán). File: [OrderEscrowWorker.cs](backend/src/MmoMarket.Api/BackgroundJobs/OrderEscrowWorker.cs).

### 3. Nạp ví (wallet top-up) — `WalletTopupService`

Luồng "tạo intent rồi đối soát", KHÔNG cộng tiền ngay. File: [WalletTopupService.cs](backend/src/MmoMarket.Application/Wallet/WalletTopupService.cs).

1. `CreateIntentAsync` → tạo `WalletTxn(Topup, Status=Pending)` kèm mã code trong `Note`.
2. User thanh toán qua cổng (SePay…). Xác nhận tiền về qua một trong:
   - IPN/webhook → `ConfirmByTransferNoteAsync` / `ConfirmByIdAsync`.
   - Reconcile chủ động: `ReconcileForUserAsync` (khi user mở trang) hoặc `ExpireStalePendingAsync` (worker) — query trạng thái cổng qua `SePayPgService.GetOrderStatusAsync`.
3. Nếu cổng báo đã trả (`IsPaid`) → cộng `user.WalletBalance`, `Status=Completed` (idempotent: đã Completed thì bỏ qua).
4. Pending quá **30 phút** (`PendingTtl`) mà chưa trả → `Cancelled`. User cũng có thể tự `CancelByCodeAsync`.

### 4. Doanh thu seller & rút tiền — `SellerService`

- **Số dư khả dụng** (`AvailableBalance`) = Σ(`UnitPrice*Quantity − FeeAmount`) của các `OrderLine` thuộc đơn **`Completed`** − Σ tiền đã rút (`WithdrawRequest` ở trạng thái `Approved`/`Paid`). Tức seller chỉ nhận tiền **sau khi escrow được giải ngân**. File: [SellerService.cs](backend/src/MmoMarket.Application/Sellers/SellerService.cs).
- **Rút tiền** (`WithdrawAsync`): kiểm tra ≤ số dư khả dụng + rate limit; nếu bật 2FA phải nhập TOTP.
  - Rút **về ví nội bộ** (`Method=Wallet`): xử lý tức thì — `WithdrawStatus.Paid`, cộng `WalletBalance`, ghi `WalletTxn(RevenueToWallet)`.
  - Rút **ra ngoài** (bank…): tạo `WithdrawRequest` `Pending` chờ admin duyệt.

### 5. Cọc đăng tin (listing deposit)

Khi seller đăng sản phẩm có thể bị khóa cọc (`ListingDepositStatus.Held`, trừ `WalletBalance`). Gỡ tin sạch → hoàn cọc (`Refunded`, cộng lại ví). Seller bùng hàng (đơn auto-cancel do trễ) → tịch thu cọc (`Forfeited`).

### 6. Affiliate / giới thiệu

`RewardAffiliateAsync` chạy khi đơn `Completed`: nếu buyer có `ReferredByUserId` và **chưa từng được thưởng** (`AffiliateRewarded=false`), trả hoa hồng = `order.Fee * AffiliatePercent%` (mặc định 30%) vào ví người giới thiệu (`WalletTxn(Commission)`). Chỉ thưởng **một lần** trên giao dịch hoàn tất đầu tiên.

### 7. Cấu hình runtime (`SiteConfig` / `ConfigKeys`)

Nhiều tham số nghiệp vụ đọc từ DB qua config service (không hard-code), vd: `EscrowReleaseDays`, `DeliverWindowHours`, `AffiliatePercent`, `LoyaltyPtsPer1000`. Đổi hành vi escrow/phí/loyalty → sửa giá trị config thay vì sửa code.
