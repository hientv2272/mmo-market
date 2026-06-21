# Kế hoạch: Hệ thống Bot mô phỏng nghiệp vụ — MMO Market

> Tài liệu kế hoạch để thực hiện sau. Chưa code. Tạo ngày 2026-06-15.

## Bối cảnh & mục tiêu

Cần một hệ thống bot tự động tạo tài khoản **người mua** và **người bán**, đi qua **toàn bộ quy trình nghiệp vụ thật** (đăng ký → xác minh KYC → nạp ví → đăng bài/nạp kho → mua hàng → thanh toán ví → xác nhận nhận hàng → đánh giá). Mục tiêu: **test hệ thống end-to-end, sinh dữ liệu mẫu, và làm sàn trông sôi động (marketing)**. Mọi tài khoản/dữ liệu do bot tạo phải được **đánh dấu là bot** để lọc và **xoá sạch trong một thao tác**.

### Quyết định kiến trúc (đã chốt)

- **External HTTP runner**: project console .NET MỚI gọi **API HTTP công khai thật** cho mọi hành động người dùng; chỉ dùng **token admin** cho các bước cần duyệt (đánh dấu bot, duyệt KYC, duyệt sản phẩm, xác nhận nạp ví). Trung thực nhất với "đúng quy trình nghiệp vụ" và test thật pipeline auth/validation/business-rule.
- **Stack runner**: project console .NET trong solution hiện có (`backend/MmoMarket.sln`).
- **Nạp ví trung thực**: bot tạo **topup intent thật** (`POST /api/wallet/topup`), rồi endpoint admin-only MỚI xác nhận qua **đúng `WalletTopupService.ConfirmByIdAsync`** mà IPN cổng thật dùng — không cần tiền thật.
- **Đánh dấu & dọn dẹp**: thêm `IsBot` vào `User`, và cờ `IsBotData` trên `Seller`/`Product`/`Order` để **purge một thao tác**. Dữ liệu bot **vẫn hiển thị công khai** (marketing) cho tới khi purge.

## Sự thật nền tảng đã xác minh trong repo

- **DB = SQLite**; schema tạo lúc khởi động bằng `db.Database.EnsureCreatedAsync()` rồi `UpgradeSchemaAsync` (idempotent, raw SQL) tại `Seeder.cs` (dòng 14-15). **KHÔNG dùng EF Core Migrations.** Cột mới thêm qua `AddColumnIfMissingAsync` (`Seeder.cs:441-459`).
- **Rate limiter per-IP** fixed-window (mặc định 100 req/phút) tại `Program.cs:45-53` + `app.UseRateLimiter()`. Runner chia sẻ 1 IP → phải giới hạn concurrency + backoff 429.
- Đăng ký `POST /api/auth/register` (`RegisterDto(Email,Password,Username,DisplayName,ReferralCode?)`), login trả JWT 7 ngày **đã nhúng role**. Welcome bonus 100k mỗi user mới.
- KYC: bot `POST /api/kyc` → admin `POST /api/admin/kyc/{id}/approve` (`KycService.ApproveAsync`) → đổi role `Seller` + **tạo `Seller` record** + badge "verified".
- Seller: `POST /api/seller/products` (→ `Pending`) → admin `POST /api/admin/products/{id}/approve` (→ `Active`) → `POST /api/seller/inventory/{id}/upload` (dedupe SHA-256, idempotent).
- Buyer: `POST /api/orders/checkout` với `PaymentMethod="Wallet"` trừ ví ngay → `EscrowLocked` → (auto-deliver có kho) `Checking` → `POST /api/orders/{id}/confirm` → `Completed` → `POST /api/reviews`.
- Admin seed sẵn: `admin@mmo.local / Admin@123`.

## Phương án triển khai

### 1. Schema: thêm cờ bot (KHÔNG dùng EF migration)

Thêm property vào entity:
- `User.cs`: `public bool IsBot { get; set; }`
- `Seller.cs`, `Product.cs`, `Order.cs`: `public bool IsBotData { get; set; }`

Thêm vào `UpgradeSchemaAsync` (cạnh `Seeder.cs:459`) — an toàn cho cả DB mới lẫn DB cũ:
```
AddColumnIfMissingAsync(db, "Users",    "IsBot",     "INTEGER NOT NULL DEFAULT 0", ct)
AddColumnIfMissingAsync(db, "Sellers",  "IsBotData", "INTEGER NOT NULL DEFAULT 0", ct)
AddColumnIfMissingAsync(db, "Products", "IsBotData", "INTEGER NOT NULL DEFAULT 0", ct)
AddColumnIfMissingAsync(db, "Orders",   "IsBotData", "INTEGER NOT NULL DEFAULT 0", ct)
```
(Tuỳ chọn) thêm index lọc `IsBot`/`IsBotData` trong `AppDbContext.OnModelCreating` + `CREATE INDEX IF NOT EXISTS` tương ứng cho DB cũ.

### 2. Gắn cờ tại nguồn (server-side, KHÔNG mở DTO công khai)

`User.IsBot` là nguồn sự thật (chỉ set được qua endpoint admin §3a). Các cờ con được **đóng dấu lúc tạo** trong service hiện có — runner không truyền cờ qua DTO công khai (tránh user thật tự gắn cờ):
- `Seller.IsBotData = user.IsBot` trong `KycService.ApproveAsync` (nơi tạo Seller).
- `Product.IsBotData = sellerUser.IsBot` trong `SellerService.CreateProductAsync` (đã có sẵn load `sellerUser`).
- `Order.IsBotData = user.IsBot` trong `OrderService.CheckoutAsync` (đã có sẵn load `user`).

`InventoryItem`/`WalletTxn`/`Review`/`CartItem` không cần cờ riêng — truy ngược qua FK khi purge.

### 3. Endpoint admin-only mới — `BotController` + `BotAdminService`

Tạo `BotController.cs` `[Authorize(Roles="Admin,SuperAdmin")]`, `[Route("api/admin/bots")]`, và `BotAdminService.cs` (đăng ký `AddScoped` trong `DependencyInjection.cs`). Inject lại service có sẵn: `IAppDbContext`, `WalletTopupService`.

- **(a) Đánh dấu bot**: `POST /api/admin/bots/users/{userId}/mark` → set `user.IsBot=true` + ghi `AuditLog`.
- **(b) Xác nhận nạp ví bot (trung thực)**: `POST /api/admin/bots/topup/{txnId}/confirm`, body `BotConfirmTopupDto(decimal? PaidAmount)` → gọi **`WalletTopupService.ConfirmByIdAsync(txnId, PaidAmount, ct)`** (đúng credit path của IPN: cộng ví, `WalletTxn`→`Completed`, bắn notify, idempotent). Guard: kiểm tra `WalletTxn.User.IsBot` trước khi cộng (tránh cộng nhầm user thật).
- **(c) Purge dữ liệu bot**: `POST /api/admin/bots/purge` → xoá theo thứ tự FK (§5), trả về số bản ghi đã xoá.

**Tái sử dụng (KHÔNG tạo mới)**: duyệt KYC `POST /api/admin/kyc/{id}/approve`, duyệt sản phẩm `POST /api/admin/products/{id}/approve` — đã có và đã gated admin.

### 4. Project console runner `MmoMarket.Bots`

- Vị trí: `backend/src/MmoMarket.Bots/` (`net8.0`, `OutputType=Exe`). Thêm vào `MmoMarket.sln` (`dotnet sln backend/MmoMarket.sln add ...`). **Không** reference Api/Infrastructure — chỉ HTTP thuần (`System.Text.Json` + `Microsoft.Extensions.Http/Configuration/Hosting`).
- Cấu hình `appsettings.json` + env + CLI args: `BaseUrl`, `AdminEmail/Password`, `SellerCount`, `ProductsPerSeller` (≤10 cho free plan), `InventoryPerProduct`, `BuyerCount`, `TopupAmount` (≤2,000,000 — xem §7), `MaxConcurrency` (≤4), `DelayMsBetweenActions`, `Scenario` (`all|sellers|buyers|purge`).
- `ApiClient.cs`: wrapper typed quanh `HttpClient` (1 instance/identity để token không đụng nhau); 1 admin client login sẵn cho các call gated; tự retry/backoff khi HTTP 429.
- **SellerScenario**: per seller (song song có giới hạn) → register → admin `mark` → submit KYC → admin approve KYC → **re-login** (lấy JWT mới có role `Seller`) → nạp ví seller (intent+confirm) **trước khi** tạo sản phẩm (vì có cọc đăng tin) → tạo M sản phẩm → upload kho → admin approve từng sản phẩm.
- **BuyerScenario**: per buyer → register → admin `mark` → topup intent → admin confirm (credit) → duyệt catalog công khai chọn **sản phẩm Auto còn kho** → add cart → checkout `Wallet` (→ `Checking`) → `confirm` (→ `Completed`) → review. (Tránh Manual/Hybrid ở happy-path, hoặc thêm bước seller `deliver`.)
- **Concurrency/resume**: `SemaphoreSlim`/`Parallel.ForEachAsync` ≤4 + delay + backoff 429. Identity duy nhất kiểu `bot.seller.{guid8}@bots.mmo.local`; khi resume gặp "email tồn tại" → login thay vì register. Lưu `bots-state.json` (email→id/token) để chạy lại không tạo trùng. Upload kho & confirm topup vốn idempotent.

### 5. Purge (FK-child-first, hard delete)

`BotAdminService.PurgeAllBotDataAsync`: gom id set (`botUserIds` từ `IsBot`; `botSellerIds`/`botProductIds`/`botOrderIds` từ `IsBotData` HOẶC truy FK), rồi `RemoveRange` theo thứ tự con→cha: Reviews → CartItems → WishlistItems → InventoryItems → OrderLines → Orders → WalletTxns → Products → BoostLogs/SellerCoupons → KycSubmissions → (Conversations/ChatMessages nếu có) → Sellers → Users. **KHÔNG xoá `AuditLog`** (`AppDbContext.SaveChangesAsync` chặn sửa/xoá AuditLog — để nguyên, tham chiếu bằng string id). Bọc trong transaction để rollback nếu lỗi. Runner gọi qua `--Bot:Scenario=purge`.

### 6. Verification

1. Chạy backend: `dotnet run --project backend/src/MmoMarket.Api` → kiểm tra startup không lỗi, 4 cột bot được thêm.
2. Chạy runner: `dotnet run --project backend/src/MmoMarket.Bots -- --Bot:Scenario=all`.
3. Query SQLite: `Users WHERE IsBot=1`; `Products WHERE IsBotData=1 AND Status=2` (Active); `Orders WHERE IsBotData=1 GROUP BY Status` (kỳ vọng có `Status=4` Completed); reviews/walletTxns của bot.
4. Admin API (`/api/admin/users|products|orders|metrics`) và **catalog công khai** hiển thị dữ liệu bot.
5. Runner tự assert mỗi order buyer đạt `Completed` (re-fetch `GET /api/orders/{id}`).
6. `--Bot:Scenario=purge` → các count bot về 0 (trừ AuditLog cố ý giữ).

### 7. Rủi ro & lưu ý

- **`POST /api/orders/{id}/pay` (`SimulatePayAsync`) = lỗ "hàng miễn phí"** (đổi `PendingPayment`→`EscrowLocked` + giao hàng mà **không thu tiền**). Runner **TUYỆT ĐỐI không dùng**; bot thanh toán trung thực bằng `Wallet`. Khuyến nghị (tách riêng) gỡ/khoá endpoint này — lỗ hổng có sẵn, không phải do hệ thống bot tạo ra.
- **Giới hạn nạp** (`TransactionLimitService.EnsureDepositAllowedAsync`): unverified ≤ 2,000,000/ngày → giữ `TopupAmount` nhỏ hoặc duyệt KYC buyer trước (nâng 20M) hoặc admin chỉnh config.
- **Cọc đăng tin** bật mặc định (5%, kẹp 10k–500k) → seller bot phải có số dư **trước** khi tạo sản phẩm (đã đưa bước nạp ví vào SellerScenario), hoặc tắt `listing_deposit_enabled`.
- **Cap listing theo plan** (free = 10) → `ProductsPerSeller` ≤ 10 hoặc gán plan cao hơn.
- **Re-login sau duyệt KYC** bắt buộc (JWT cũ mang role `Buyer`; endpoint seller cần role `Seller`).
- **Đừng promote seller bằng `PUT /api/admin/users/{id}/role`** — chỉ đổi role, **không tạo `Seller` record** → `SellerService` ném 403. Promote qua **duyệt KYC**.
- **Rate limit 429**: concurrency thấp + delay + backoff; sản phẩm phải được admin duyệt mới hiện/mua được.
- **2FA**: bot không bật 2FA → `TotpCode=null` ổn.

## Các file then chốt

- Schema: `Seeder.cs` (+4 `AddColumnIfMissingAsync`); entity `User.cs`/`Seller.cs`/`Product.cs`/`Order.cs`.
- Gắn cờ: `KycService.cs`, `SellerService.cs`, `OrderService.cs`.
- Backend mới: `BotController.cs`, `BotAdminService.cs`, `DependencyInjection.cs`.
- Runner mới: `backend/src/MmoMarket.Bots/` (`MmoMarket.Bots.csproj`, `Program.cs`, `ApiClient.cs`, `Scenarios/SellerScenario.cs`, `Scenarios/BuyerScenario.cs`, `appsettings.json`) + entry trong `backend/MmoMarket.sln`.
