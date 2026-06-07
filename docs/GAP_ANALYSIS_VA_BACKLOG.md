# GAP ANALYSIS & BACKLOG KỸ THUẬT — SÀN MMO

> **Mục đích:** Đối chiếu quy trình chuẩn ([QUY_TRINH_VAN_HANH_CHUAN.md](QUY_TRINH_VAN_HANH_CHUAN.md), lấy `MMO_Platform_Operations.docx` làm gốc) với code thực tế, chỉ rõ điểm **đã hợp lý (giữ)** và **chưa hợp lý (sửa theo chuẩn)**, kèm backlog kỹ thuật có ưu tiên.
> **Phạm vi:** Tài liệu phân tích — *không kèm code*. Mỗi hạng mục backlog nêu mô tả, file/entity dự kiến đụng tới, và tiêu chí hoàn thành.

---

## A. Bảng đối chiếu theo nhóm chức năng

Chú thích: `✅ ĐÃ CÓ` · `🟡 MỘT PHẦN` · `🔴 THIẾU`.

| # | Nhóm chức năng | Trạng thái | Khác biệt so với chuẩn | File liên quan |
|---|---|---|---|---|
| 1 | Auth & Identity (JWT, 2FA, Google OAuth, OTP) | ✅ | OTP đăng ký theo doc chưa rõ trong code (cần xác nhận) | [AuthService.cs](../backend/src/MmoMarket.Application/Auth/), `User` |
| 2 | KYC + duyệt admin | 🟡 | Chỉ lưu text, **thiếu ảnh CCCD 2 mặt** | [KycService.cs](../backend/src/MmoMarket.Application/Sellers/KycService.cs), `KycSubmission` |
| 3 | Wallet ledger (số dư, held, giao dịch) | ✅ | Ví đơn thay vì 5 ví; thiếu ví Platform/Reserve & đối soát | [WalletService.cs](../backend/src/MmoMarket.Application/Wallet/WalletService.cs), `WalletTxn` |
| 4 | Cổng thanh toán (VNPay/MoMo/ZaloPay/VietQR/USDT) | ✅ | **Không lưu `PaymentTransaction`** riêng để đối soát/audit | [Payments/](../backend/src/MmoMarket.Application/Payments/), [PaymentController.cs](../backend/src/MmoMarket.Api/Controllers/) |
| 5 | Product lifecycle + duyệt | ✅ | Thiếu trạng thái `Banned`; thiếu cọc đăng tin | `Product`, `ProductStatus`, [SellerService.cs](../backend/src/MmoMarket.Application/Sellers/SellerService.cs) |
| 6 | Order + Escrow | 🟡 | **Thiếu trạng thái `Checking`; không có job auto-release/auto-cancel** | [OrderService.cs](../backend/src/MmoMarket.Application/Orders/OrderService.cs), [Enums.cs](../backend/src/MmoMarket.Domain/Enums/Enums.cs) |
| 7 | Dispute + SLA 72h | ✅ | `partial_refund` hardcode 50%; chưa chặn lạm dụng 3 lần/tháng | [DisputeService.cs](../backend/src/MmoMarket.Application/Disputes/DisputeService.cs) |
| 8 | Review / Rating | ✅ | — | [ReviewService.cs](../backend/src/MmoMarket.Application/Reviews/), `Review` |
| 9 | Trust Score 0–100 | 🔴 | Chỉ có `Rating` + `Badge` thủ công | `Seller` |
| 10 | Fee / Commission | 🟡 | **Phí phẳng 5%**, không theo danh mục; thiếu gói Seller; thiếu `FeeConfig` | `SiteConfig` (`fee_rate`), [SellerService.cs](../backend/src/MmoMarket.Application/Sellers/SellerService.cs) |
| 11 | Anti-fraud limits | 🔴 | Không có giới hạn nạp/rút theo cấp KYC | — |
| 12 | Admin panel | ✅ | — | [AdminService.cs](../backend/src/MmoMarket.Application/Admin/AdminService.cs) |
| 13 | Notification | ✅ | Real-time (SignalR) theo doc — hiện chưa rõ, cần xác nhận | [NotificationService.cs](../backend/src/MmoMarket.Application/Notifications/) |
| 14 | Audit Log bất biến | 🔴 | Chưa có log bất biến cho thao tác tài chính | — |

### Tổng kết "hợp lý — giữ nguyên"
Escrow-first, KYC + duyệt admin, Dispute + SLA 72h, wallet ledger, 6 cổng thanh toán, product approval, admin panel, notification, review. Đây là nền tảng vững — chỉ tinh chỉnh, không làm lại.

### Tổng kết "chưa hợp lý — sửa theo chuẩn"
1. `OrderStatus` thiếu `Checking`; tên `Paid/Processing/Delivered` lệch chuẩn `EscrowLocked/Delivering`.
2. Không có background job auto-release escrow (T+48h) & auto-cancel seller trễ bàn giao (T+2h) — `EscrowReleaseAt` set nhưng không xử lý.
3. Phí phẳng 5% thay vì theo danh mục; thiếu `FeeConfig` & Fee Engine.
4. Thiếu gói thành viên Seller (Free/Basic/Pro/VIP) & Trust Score 0–100.
5. Thiếu giới hạn nạp/rút theo cấp KYC & cọc đăng tin seller.
6. KYC thiếu ảnh CCCD 2 mặt; chưa lưu `PaymentTransaction`; chưa có `AuditLog`; chưa chặn lạm dụng tranh chấp; `partial_refund` hardcode 50%.
7. Ví đơn vs 5 ví — *khuyến nghị giữ ledger đơn*, bổ sung ví Platform/Reserve dạng logic + đối soát.

---

## B. Backlog kỹ thuật theo ưu tiên

### 🔴 P0 — An toàn tiền & toàn vẹn giao dịch (làm trước)

> ✅ **ĐÃ TRIỂN KHAI** (toàn bộ P0.1–P0.4). Quyết định đã chốt: đổi tên `OrderStatus` đầy đủ theo tài liệu (`PendingPayment → EscrowLocked → Delivering → Checking → Completed`, nhánh `Disputed/Refunded/Cancelled`); dùng `.NET BackgroundService`; cửa sổ kiểm tra **48h** (config `escrow_release_days=2`), cửa sổ bàn giao **T+2h** (config `deliver_window_hours=2`).
>
> ✅ **Lưu ý vận hành (đã xử lý):** Schema nâng cấp **tự động** khi khởi động qua `Seeder.UpgradeSchemaAsync` — đã retrofit `CREATE TABLE IF NOT EXISTS` cho `AuditLogs`/`PaymentTransactions` và `ALTER TABLE ADD COLUMN` (idempotent qua `pragma_table_info`) cho `Orders.DeliverDueAt`. **Không cần xóa file `.db`.**

**P0.1 — Background job auto-release escrow & auto-cancel** ✅
- Đã thêm [OrderEscrowWorker.cs](../backend/src/MmoMarket.Api/BackgroundJobs/OrderEscrowWorker.cs) (quét mỗi 1 phút) + `OrderService.AutoReleaseEscrowAsync` / `AutoCancelStaleAsync`. Đăng ký trong [Program.cs](../backend/src/MmoMarket.Api/Program.cs).
- Mô tả: Worker định kỳ quét order: (a) `Checking` quá `EscrowReleaseAt` → `Completed` + giải ngân; (b) `EscrowLocked` mà seller chưa bàn giao quá T+2h → `Cancelled` + hoàn 100%.
- Đụng tới: thêm hosted service / scheduler (HangFire hoặc `BackgroundService`) trong [MmoMarket.Api](../backend/src/MmoMarket.Api/), [OrderService.cs](../backend/src/MmoMarket.Application/Orders/OrderService.cs).
- Tiêu chí: order tự chuyển trạng thái đúng khi hết hạn mà không cần thao tác tay; có test edge case timeout + dispute đồng thời.

**P0.2 — Đổi tên `OrderStatus` đầy đủ + trạng thái `Checking`** ✅
- Đã đổi `Paid→EscrowLocked`, `Processing→Delivering`, `Delivered→Checking`, `Dispute→Disputed` (giữ nguyên giá trị số) + thêm `ProductStatus.Banned`. Thêm field `Order.DeliverDueAt`.
- Đã cập nhật: [Enums.cs](../backend/src/MmoMarket.Domain/Enums/Enums.cs), [OrderService.cs](../backend/src/MmoMarket.Application/Orders/OrderService.cs) + các service, và toàn bộ frontend (`types.ts`, `StatusBadge`, Orders/Account/Seller/Admin clients, `data.ts`). `tsc --noEmit` sạch.

**P0.3 — Bảng `AuditLog` bất biến** ✅
- Đã thêm entity [AuditLog.cs](../backend/src/MmoMarket.Domain/Entities/AuditLog.cs) (append-only) + guard cấm sửa/xóa trong `AppDbContext.SaveChangesAsync`. Đã ghi audit tại các điểm tài chính: thanh toán ví, xác nhận thanh toán ngoài, buyer xác nhận nhận hàng, auto-release, auto-cancel, phán quyết tranh chấp (refund/release/partial).

**P0.4 — Lưu `PaymentTransaction` từ webhook cổng thanh toán** ✅
- Đã thêm entity [PaymentTransaction.cs](../backend/src/MmoMarket.Domain/Entities/PaymentTransaction.cs) + [PaymentLogService](../backend/src/MmoMarket.Application/Payments/PaymentLogService.cs) (idempotent theo unique index `Provider+ProviderTxnId`). Wire vào MoMo/ZaloPay/VNPay/SePay trong [PaymentController.cs](../backend/src/MmoMarket.Api/Controllers/PaymentController.cs).
- *Còn lại:* USDT auto-confirm (polling) chưa ghi `PaymentTransaction` — đề xuất bổ sung ở vòng sau.

### 🟡 P1 — Đúng mô hình kinh doanh

> ✅ **ĐÃ TRIỂN KHAI TOÀN BỘ P1.1–P1.4.** Quyết định đã chốt: phí **theo danh mục + ngưỡng giá**; gói Seller **đầy đủ** (mua qua ví + hết hạn 30 ngày + áp dụng giảm phí & giới hạn tin); giới hạn nạp/rút theo KYC; cọc đăng tin.

**P1.1 — `FeeConfig` theo danh mục + Fee Engine** ✅
- Entity [FeeConfig.cs](../backend/src/MmoMarket.Domain/Entities/FeeConfig.cs) (CategorySlug + MinPrice/MaxPrice + SellerFeePercent) + [FeeService.cs](../backend/src/MmoMarket.Application/Fees/FeeService.cs) (chọn dòng cụ thể nhất, fallback phí phẳng, áp giảm theo gói). Phí khóa per-line vào `OrderLine.FeeAmount` lúc thanh toán ([OrderService.cs](../backend/src/MmoMarket.Application/Orders/OrderService.cs)); dashboard seller & báo cáo admin tính từ `Fee`/`FeeAmount` thực. Admin chỉnh tại tab "Phí danh mục" ([AdminFeesClient.tsx](../src/app/admin/fees/AdminFeesClient.tsx)) qua `/api/admin/config/fee-tiers`. Seed sẵn phí theo §6.1 (game có 2 mức theo ngưỡng 500k).

**P1.2 — Gói thành viên Seller (Free/Basic/Pro/VIP)** ✅
- Entity [SellerPlan.cs](../backend/src/MmoMarket.Domain/Entities/SellerPlan.cs) + `Seller.PlanCode/PlanExpiresAt` + [SellerPlanService.cs](../backend/src/MmoMarket.Application/Sellers/SellerPlanService.cs) (list/subscribe/effective + gia hạn cộng dồn). Mua qua ví (`/api/seller/plan/subscribe`), trừ ví + audit. Áp dụng: giảm phí (Fee Engine) + giới hạn số tin trong `CreateProductAsync`. Trang seller [seller/plan](../src/app/seller/plan/). Seed 4 gói §6.3.

**P1.3 — Giới hạn nạp/rút theo cấp KYC (anti-fraud)** ✅
- [TransactionLimitService.cs](../backend/src/MmoMarket.Application/Wallet/TransactionLimitService.cs): cấp Chưa KYC / KYC / Seller Verified (KYC + ≥6 tháng) / VIP, hạn mức theo ngày cấu hình trong `SiteConfig` (seed §7.2). Enforce ở `WalletService.TopupAsync` (nạp) và `SellerService.CreateWithdrawAsync` (rút).

**P1.4 — Cọc đăng tin của Seller** ✅
- `Product.DepositAmount/DepositStatus` (`ListingDepositStatus`: None/Held/Refunded/Forfeited) + WalletTxnType `Deposit`/`DepositRefund`. Cấu hình `listing_deposit_enabled/percent/min/max` trong `SiteConfig` (mặc định bật, 5%, 10k–500k).
- `CreateProductAsync`: khóa cọc = clamp(giá × %, min, max) từ ví seller (chặn nếu không đủ số dư). `DeleteProductAsync`: hoàn cọc khi gỡ tin. `OrderService.AutoCancelStaleAsync`: **tịch thu** cọc khi seller trễ bàn giao (P0). Hiển thị trạng thái cọc trên [SellerProductsClient.tsx](../src/app/seller/products/SellerProductsClient.tsx); seed sẵn số dư ví cho seller demo để test.

> ✅ *Mục nhỏ đã bổ sung:* **admin CRUD gói Seller** (`/api/admin/plans` + trang [admin/plans](../src/app/admin/plans/)) và **tính năng Boost** (đẩy tin lên top 24h, trừ quota `BoostsPerMonth`/tháng — `BoostLog`, `Product.BoostedUntil`, CatalogService xếp boosted-first + badge "Top", UI seller boost).
>
> ⏸️ *Hoãn (cần hạ tầng ngoài):* tách ví vật lý (Buyer/Seller/Escrow/Platform/Reserve), OCR cho KYC (provider FPT.AI/VNPT/Google Vision), object storage thật (MinIO/Azure Blob). Hiện dùng single-ledger + báo cáo đối soát + lưu ảnh data URL.

### 🟢 P2 — Tối ưu & uy tín

> ✅ **ĐÃ TRIỂN KHAI TOÀN BỘ P2.1–P2.6.** Trust Score chỉ ảnh hưởng **uy tín + xếp hạng** (không động phí/hạn mức của P1). P2.2 lưu ảnh CCCD dạng data URL trong DB (object storage thật để sau). P2.5 làm **báo cáo đối soát** trên ledger đơn (ví Platform/Reserve/Escrow là tài khoản logic).

**P2.1 — Trust Score tự động 0–100** ✅
- `Seller.TrustScore/LastViolationAt/LastTrustBonusAt` + [TrustScoreService.cs](../backend/src/MmoMarket.Application/Sellers/TrustScoreService.cs) (delta cấu hình trong `SiteConfig` theo §8). Hook: hoàn thành đơn (+1, [OrderService](../backend/src/MmoMarket.Application/Orders/OrderService.cs) ConfirmReceived/AutoRelease), đánh giá 5★/1–2★ ([ReviewService](../backend/src/MmoMarket.Application/Reviews/ReviewService.cs)), thua tranh chấp (−10, [DisputeService](../backend/src/MmoMarket.Application/Disputes/DisputeService.cs)), trễ bàn giao (−5, AutoCancel), vi phạm/ban (−15, [AdminService](../backend/src/MmoMarket.Application/Admin/AdminService.cs)), bonus +5/30 ngày sạch (worker). Xếp hạng seller theo TrustScore; hiển thị trên dashboard seller & trang /sellers.

**P2.2 — Ảnh CCCD 2 mặt trong KYC** ✅
- `KycSubmission.FrontImage/BackImage` + `KycSubmitDto`/`KycDto` mở rộng ([KycService.cs](../backend/src/MmoMarket.Application/Sellers/KycService.cs)). Seller upload 2 mặt (data URL, ≤3MB) trong [OnboardingClient](../src/app/seller/onboarding/OnboardingClient.tsx); admin xem thumbnail khi duyệt ([AdminSellersClient](../src/app/admin/sellers/AdminSellersClient.tsx)). *Object storage thật (MinIO/Blob) + OCR để vòng sau.*

**P2.3 — Giới hạn lạm dụng tranh chấp** ✅
- `DisputeService.OpenAsync`: chặn khi buyer mở > `dispute_max_per_month` (mặc định 3) tranh chấp trong 30 ngày.

**P2.4 — `partial_refund` theo % cấu hình** ✅
- `DisputeResolveDto.RefundPercent` (mặc định `partial_refund_default_percent`=50); admin nhập % khi phán quyết ([AdminDisputesClient](../src/app/admin/disputes/AdminDisputesClient.tsx)).

**P2.5 — Ví Platform/Reserve + báo cáo đối soát** ✅
- `AdminService.GetFinanceReconciliationAsync` + endpoint `/api/admin/finance/reconciliation` + panel "Đối soát dòng tiền" trong [AdminFinanceClient](../src/app/admin/finance/AdminFinanceClient.tsx): ví Platform (phí thực thu), Escrow đang giữ, Reserve đã hoàn, cọc đang khóa/đã tịch thu, tổng nạp/rút, tổng số dư ví. Giữ ledger đơn; ví là tài khoản logic. *Tách ví vật lý để sau nếu cần.*

**P2.6 — Trạng thái `Banned` cho sản phẩm** ✅
- `AdminService.BanProductAsync` + endpoint `/api/admin/products/{id}/ban` + nút Ban trong [AdminProductsClient](../src/app/admin/products/AdminProductsClient.tsx); ban kéo theo −15 trust score seller.

---

## C. Checklist trước go-live (đối chiếu §8.2 tài liệu)

| Hạng mục | Trạng thái dự kiến |
|---|---|
| Migration script test trên staging | ⏳ cần kiểm (schema tự nâng cấp qua UpgradeSchemaAsync) |
| Escrow engine test edge case (timeout, dispute đồng thời) | 🟢 code xong (P0.1 worker) — cần test thực tế |
| Cổng thanh toán test sandbox | 🟡 có tích hợp + lưu PaymentTransaction, cần verify sandbox |
| Mã hóa thông tin bàn giao verify decrypt | ✅ AES-256-GCM thật ([AesEncryptionService](../backend/src/MmoMarket.Infrastructure/Security/AesEncryptionService.cs)); cần verify decrypt khi chạy |
| Rate limiting API (100 req/min/IP) | ✅ built-in RateLimiter (FixedWindow theo IP, [Program.cs](../backend/src/MmoMarket.Api/Program.cs)) |
| Background job timeout chạy đúng | 🟢 code xong (OrderEscrowWorker) — cần test thực tế |
| Email notification đủ 8 loại sự kiện | 🟡 hạ tầng SMTP + gửi cho mọi event qua [SmtpEmailSender](../backend/src/MmoMarket.Infrastructure/Email/SmtpEmailSender.cs) (mặc định no-op); cần cấu hình SMTP thật + verify |
| Real-time notification (SignalR) | ✅ [NotificationHub](../backend/src/MmoMarket.Api/Hubs/NotificationHub.cs) + push trong NotificationService + client trong [NotificationContext](../src/lib/NotificationContext.tsx) |
| Admin panel duyệt/từ chối/ xử lý tranh chấp | ✅ |
| Audit log đầy đủ thao tác tài chính | ✅ (P0.3) |
| Load test 500 concurrent users | ⏳ cần kiểm |
| Security scan OWASP Top 10 | ⏳ cần kiểm |
| Backup & restore procedure | ⏳ cần kiểm |

---

## D. Quyết định cần chốt trước khi code (phiên sau)

1. **Đổi tên enum `OrderStatus`** sang đúng chuẩn (`EscrowLocked/Delivering/Checking`) hay **giữ tên cũ + chỉ thêm `Checking`** và map nhãn hiển thị? (Đổi tên = migration + sửa frontend; giữ tên = ít rủi ro hơn.)
2. **Ví:** giữ ledger đơn + ví logic Platform/Reserve (khuyến nghị) hay refactor sang 5 ví vật lý?
3. **Scheduler:** dùng `BackgroundService` thuần .NET hay HangFire (có dashboard/retry)?
4. Cửa sổ kiểm tra buyer: tài liệu ghi **24–48h** còn code mặc định escrow **+3 ngày** — chốt con số chuẩn.
