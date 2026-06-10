using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;
// ReSharper disable once RedundantUsingDirective (needed for CouponType in SeedDemoCouponsAsync)

namespace MmoMarket.Infrastructure.Persistence;

public static class Seeder
{
    public static async Task SeedAsync(AppDbContext db, IPasswordHasher hasher, CancellationToken ct = default)
    {
        await db.Database.EnsureCreatedAsync(ct);
        await UpgradeSchemaAsync(db, ct);
        await SeedDemoNotificationsAsync(db, ct);
        await SeedDemoCouponsAsync(db, ct);
        await SeedDemoBannersAsync(db, ct);
        await SeedDemoFlashSalesAsync(db, ct);
        await SeedDemoSellerCouponsAsync(db, ct);
        await SeedDemoConversationsAsync(db, ct);
        await SeedDefaultConfigAsync(db, ct);
        await SeedDemoLoyaltyRewardsAsync(db, ct);
        await SeedSellerPlansAsync(db, ct);
        await SeedFeeConfigsAsync(db, ct);
        await ReconcileSellerRatingsAsync(db, ct);
        if (await db.Categories.AnyAsync(ct)) return;

        // Categories — match frontend slugs
        var categories = new[]
        {
            new Category { Slug = "ai", Name = "AI Account", Short = "AI", IconKey = "sparkles", Description = "ChatGPT, Midjourney, Claude, Perplexity Pro...", Color = "#7c3aed", Position = 1 },
            new Category { Slug = "tool", Name = "Tool / Phần mềm", Short = "Tool", IconKey = "tool", Description = "Photoshop, Office, Canva, Capcut, IDE...", Color = "#22d3ee", Position = 2 },
            new Category { Slug = "course", Name = "Khoá học", Short = "Course", IconKey = "book", Description = "Marketing, dev, design, AI, MMO...", Color = "#fb7185", Position = 3 },
            new Category { Slug = "giftcard", Name = "Gift Card", Short = "GC", IconKey = "gift", Description = "Apple, Google Play, Steam, Amazon...", Color = "#f59e0b", Position = 4 },
            new Category { Slug = "game", Name = "Tài khoản & Skin Game", Short = "Game", IconKey = "gamepad", Description = "LoL, Valorant, Genshin, FO4...", Color = "#10b981", Position = 5 },
            new Category { Slug = "social", Name = "Mạng xã hội", Short = "Social", IconKey = "users", Description = "FB, IG, TikTok, Twitter, YouTube...", Color = "#0ea5e9", Position = 6 },
            new Category { Slug = "engagement", Name = "Tăng tương tác", Short = "Engage", IconKey = "trending", Description = "Like, follow, view, sub, comment...", Color = "#ef4444", Position = 7 },
            new Category { Slug = "bestseller", Name = "Bán chạy", Short = "Hot", IconKey = "fire", Description = "Top sản phẩm sàn", Color = "#a855f7", Position = 8 },
        };
        db.Categories.AddRange(categories);

        // Demo users + sellers
        var adminUser = new User
        {
            Email = "admin@mmo.local",
            PasswordHash = hasher.Hash("Admin@123"),
            Username = "admin",
            DisplayName = "Quản trị viên",
            Role = UserRole.Admin,
            AvatarColor = "#ef4444",
            KycStatus = KycStatus.Approved,
            ReferralCode = "ADMIN001",
        };
        var buyerUser = new User
        {
            Email = "buyer@mmo.local",
            PasswordHash = hasher.Hash("Buyer@123"),
            Username = "buyer",
            DisplayName = "Buyer Demo",
            Role = UserRole.Buyer,
            AvatarColor = "#22d3ee",
            KycStatus = KycStatus.Approved,
            WalletBalance = 5_000_000m,
            LoyaltyPoints = 1280,
            ReferralCode = "BUYER001",
        };
        var sellerUser1 = new User
        {
            Email = "kimchi@mmo.local",
            PasswordHash = hasher.Hash("Seller@123"),
            Username = "kimchi",
            DisplayName = "KimChi Shop",
            Role = UserRole.Seller,
            AvatarColor = "#7c3aed",
            KycStatus = KycStatus.Approved,
            WalletBalance = 3_000_000m,
            ReferralCode = "KIMCHI01",
        };
        var sellerUser2 = new User
        {
            Email = "vyhan@mmo.local",
            PasswordHash = hasher.Hash("Seller@123"),
            Username = "vyhan",
            DisplayName = "VyHan Studio",
            Role = UserRole.Seller,
            AvatarColor = "#22d3ee",
            KycStatus = KycStatus.Approved,
            WalletBalance = 3_000_000m,
            ReferralCode = "VYHAN001",
        };
        var sellerUser3 = new User
        {
            Email = "quynhnhu@mmo.local",
            PasswordHash = hasher.Hash("Seller@123"),
            Username = "quynhnhu",
            DisplayName = "QuynhNhu Digital",
            Role = UserRole.Seller,
            AvatarColor = "#fb7185",
            KycStatus = KycStatus.Approved,
            WalletBalance = 3_000_000m,
            ReferralCode = "QUYNH001",
        };

        db.Users.AddRange(adminUser, buyerUser, sellerUser1, sellerUser2, sellerUser3);

        var s1 = new Seller { UserId = sellerUser1.Id, Username = "kimchi", DisplayName = "KimChi Shop", AvatarColor = "#7c3aed", Rating = 4.9, ReviewCount = 1240, TotalSold = 8420, Badge = "top", Bio = "Shop chuyên AI account & Tool, bảo hành dài hạn.", ResponseTime = "5 phút", JoinedAt = DateTime.UtcNow.AddYears(-2), TrustScore = 98 };
        var s2 = new Seller { UserId = sellerUser2.Id, Username = "vyhan", DisplayName = "VyHan Studio", AvatarColor = "#22d3ee", Rating = 4.85, ReviewCount = 920, TotalSold = 5100, Badge = "verified", Bio = "Tools sáng tạo, gift card chính hãng.", ResponseTime = "10 phút", JoinedAt = DateTime.UtcNow.AddMonths(-18), TrustScore = 92 };
        var s3 = new Seller { UserId = sellerUser3.Id, Username = "quynhnhu", DisplayName = "QuynhNhu Digital", AvatarColor = "#fb7185", Rating = 4.78, ReviewCount = 612, TotalSold = 3210, Badge = "verified", Bio = "Khoá học chất lượng, hỗ trợ tận tình.", ResponseTime = "20 phút", JoinedAt = DateTime.UtcNow.AddMonths(-9), TrustScore = 88 };
        db.Sellers.AddRange(s1, s2, s3);

        // Products — 3 per category for demo
        var sellers = new[] { s1, s2, s3 };
        int idx = 0;
        var random = new Random(42);
        foreach (var cat in categories.Where(c => c.Slug != "bestseller"))
        {
            for (int i = 1; i <= 4; i++)
            {
                var seller = sellers[idx % sellers.Length];
                var price = (decimal)random.Next(50, 1500) * 1000m;
                var sold = random.Next(10, 800);
                var stock = random.Next(5, 200);
                var rating = 4.2 + random.NextDouble() * 0.8;
                var product = new Product
                {
                    Slug = $"{cat.Slug}-{i:00}",
                    Title = $"{cat.Name} #{i:00}",
                    CategorySlug = cat.Slug,
                    SellerId = seller.Id,
                    Price = price,
                    ComparePrice = price * 1.3m,
                    Delivery = i % 2 == 0 ? DeliveryMethod.Auto : DeliveryMethod.Manual,
                    WarrantyDays = i % 3 == 0 ? 30 : 7,
                    Stock = stock,
                    Sold = sold,
                    Rating = Math.Round(rating, 2),
                    ReviewCount = random.Next(20, 250),
                    ThumbnailColor = cat.Color,
                    ThumbnailIcon = cat.IconKey,
                    Description = $"Sản phẩm chất lượng cao thuộc danh mục {cat.Name}. Cam kết bảo hành đầy đủ.\n\nHàng có sẵn, giao trong 5 giây.",
                    FeaturesJson = JsonSerializer.Serialize(new[] { "Bảo hành 1-1", "Hỗ trợ 24/7", "Hoàn tiền trong 72h" }),
                    PoliciesJson = JsonSerializer.Serialize(new[] { "Không chia sẻ ngoài người mua", "Không vi phạm chính sách nền tảng" }),
                    FaqJson = JsonSerializer.Serialize(new[] {
                        new { Q = "Bao lâu nhận được hàng?", A = "Đơn auto giao trong < 5 giây sau khi thanh toán." },
                        new { Q = "Bảo hành thế nào?", A = "Bảo hành 1-1 trong 7 ngày kể từ khi nhận hàng." }
                    }),
                    BadgesJson = JsonSerializer.Serialize(i == 1 ? new[] { "Hot", "Bảo hành 1-1" } : new[] { "Bảo hành 1-1" }),
                };
                db.Products.Add(product);
                idx++;
            }
        }

        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedDemoCouponsAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.Coupons.AnyAsync(ct)) return;
        var now = DateTime.UtcNow;
        db.Coupons.AddRange(
            new Coupon { Code = "WELCOME100", Description = "Chào mừng thành viên mới — giảm 100.000₫",        Type = CouponType.Fixed,   Value = 100_000m, MinOrderAmount = 300_000m, MaxUses = 1,   ExpiresAt = now.AddDays(30) },
            new Coupon { Code = "SALE20",     Description = "Giảm 20% tối đa 150.000₫ cho mọi đơn hàng",      Type = CouponType.Percent, Value = 20m,      MinOrderAmount = 200_000m, MaxDiscount = 150_000m, MaxUses = 0, ExpiresAt = now.AddDays(7)  },
            new Coupon { Code = "FREESHIP",   Description = "Miễn phí gateway — giảm 5.000₫ phí giao dịch",   Type = CouponType.Fixed,   Value = 5_000m,   MinOrderAmount = 0m,       MaxUses = 0,  ExpiresAt = now.AddDays(14) },
            new Coupon { Code = "FLASH50K",   Description = "Flash Sale — giảm thẳng 50.000₫",                Type = CouponType.Fixed,   Value = 50_000m,  MinOrderAmount = 500_000m, MaxUses = 100,ExpiresAt = now.AddDays(1)  },
            new Coupon { Code = "VIP15",      Description = "Ưu đãi VIP — giảm 15% không giới hạn",           Type = CouponType.Percent, Value = 15m,      MinOrderAmount = 100_000m, MaxUses = 50, ExpiresAt = now.AddDays(60) },
            new Coupon { Code = "EXPIRED10",  Description = "Mã đã hết hạn (demo)",                            Type = CouponType.Fixed,   Value = 10_000m,  MinOrderAmount = 0m,       MaxUses = 0,  ExpiresAt = now.AddDays(-1), IsActive = true }
        );
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedDemoNotificationsAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.Notifications.AnyAsync(ct)) return;
        var buyer = await db.Users.FirstOrDefaultAsync(u => u.Email == "buyer@mmo.local", ct);
        if (buyer == null) return;
        var now = DateTime.UtcNow;
        db.Notifications.AddRange(
            new Notification { UserId = buyer.Id, Type = "system", Title = "Chào mừng đến MMO Market!", Body = "Tài khoản của bạn đã được kích hoạt. Khám phá hàng nghìn sản phẩm số chất lượng cao.", Link = "/marketplace", CreatedAt = now.AddDays(-7), IsRead = true },
            new Notification { UserId = buyer.Id, Type = "wallet", Title = "Nạp ví thành công", Body = "Số dư ví của bạn đã được cộng 5.000.000₫ từ quà chào mừng.", Link = "/account/wallet", CreatedAt = now.AddDays(-7).AddSeconds(5), IsRead = true },
            new Notification { UserId = buyer.Id, Type = "order",  Title = "Đơn hàng #MMK-1001 đã giao", Body = "Sản phẩm ChatGPT Plus 1 tháng đã được giao tự động. Vui lòng xác nhận nhận hàng.", Link = "/account/orders", CreatedAt = now.AddDays(-3), IsRead = true },
            new Notification { UserId = buyer.Id, Type = "system", Title = "Flash Sale hôm nay — giảm đến 40%", Body = "Hàng trăm sản phẩm AI & tool đang giảm giá mạnh trong 24 giờ. Mua ngay trước khi hết!", Link = "/flash-sale", CreatedAt = now.AddDays(-1), IsRead = false },
            new Notification { UserId = buyer.Id, Type = "wallet", Title = "Bạn nhận được 1.280 điểm tích lũy", Body = "Điểm thưởng từ các giao dịch đã được cộng vào tài khoản. Đổi ngay ưu đãi!", Link = "/account/loyalty", CreatedAt = now.AddHours(-5), IsRead = false },
            new Notification { UserId = buyer.Id, Type = "dispute", Title = "Khiếu nại #DIS-001 đã được giải quyết", Body = "Admin đã xử lý khiếu nại của bạn. Tiền đã được hoàn vào ví.", Link = "/account/disputes", CreatedAt = now.AddHours(-2), IsRead = false }
        );
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Idempotently apply schema changes for entities added after initial DB creation.
    /// Uses raw SQL with IF NOT EXISTS so it is safe to run on every startup.
    /// </summary>
    private static async Task UpgradeSchemaAsync(AppDbContext db, CancellationToken ct)
    {
        await db.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS DisputeMessages (
                Id TEXT NOT NULL CONSTRAINT PK_DisputeMessages PRIMARY KEY,
                DisputeId TEXT NOT NULL,
                AuthorUserId TEXT NOT NULL,
                AuthorRole TEXT NOT NULL,
                Body TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_DisputeMessages_DisputeId ON DisputeMessages(DisputeId);

            CREATE TABLE IF NOT EXISTS WithdrawRequests (
                Id TEXT NOT NULL CONSTRAINT PK_WithdrawRequests PRIMARY KEY,
                SellerUserId TEXT NOT NULL,
                Amount TEXT NOT NULL,
                Method TEXT NOT NULL,
                Account TEXT NOT NULL,
                Status INTEGER NOT NULL,
                Note TEXT NULL,
                AdminNote TEXT NULL,
                ProcessedAt TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_WithdrawRequests_SellerUserId ON WithdrawRequests(SellerUserId);

            CREATE TABLE IF NOT EXISTS WishlistItems (
                Id TEXT NOT NULL CONSTRAINT PK_WishlistItems PRIMARY KEY,
                UserId TEXT NOT NULL,
                ProductId TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_WishlistItems_UserId_ProductId ON WishlistItems(UserId, ProductId);

            CREATE TABLE IF NOT EXISTS Notifications (
                Id TEXT NOT NULL CONSTRAINT PK_Notifications PRIMARY KEY,
                UserId TEXT NOT NULL,
                Type TEXT NOT NULL,
                Title TEXT NOT NULL,
                Body TEXT NOT NULL,
                Link TEXT NULL,
                IsRead INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_Notifications_UserId ON Notifications(UserId);
            CREATE INDEX IF NOT EXISTS IX_Notifications_UserId_IsRead ON Notifications(UserId, IsRead);

            CREATE TABLE IF NOT EXISTS Coupons (
                Id TEXT NOT NULL CONSTRAINT PK_Coupons PRIMARY KEY,
                Code TEXT NOT NULL,
                Description TEXT NOT NULL,
                Type INTEGER NOT NULL DEFAULT 1,
                Value TEXT NOT NULL DEFAULT '0',
                MinOrderAmount TEXT NOT NULL DEFAULT '0',
                MaxDiscount TEXT NULL,
                MaxUses INTEGER NOT NULL DEFAULT 0,
                UsedCount INTEGER NOT NULL DEFAULT 0,
                ExpiresAt TEXT NULL,
                IsActive INTEGER NOT NULL DEFAULT 1,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Coupons_Code ON Coupons(Code);

            CREATE TABLE IF NOT EXISTS CouponUsages (
                Id TEXT NOT NULL CONSTRAINT PK_CouponUsages PRIMARY KEY,
                CouponId TEXT NOT NULL,
                UserId TEXT NOT NULL,
                OrderId TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_CouponUsages_CouponId_UserId ON CouponUsages(CouponId, UserId);

            CREATE TABLE IF NOT EXISTS Banners (
                Id TEXT NOT NULL CONSTRAINT PK_Banners PRIMARY KEY,
                Title TEXT NOT NULL,
                Subtitle TEXT NOT NULL DEFAULT '',
                LinkUrl TEXT NULL,
                BgColor TEXT NOT NULL DEFAULT '#7c3aed',
                TextColor TEXT NOT NULL DEFAULT '#ffffff',
                Position INTEGER NOT NULL DEFAULT 0,
                IsActive INTEGER NOT NULL DEFAULT 1,
                ClickCount INTEGER NOT NULL DEFAULT 0,
                StartsAt TEXT NULL,
                EndsAt TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_Banners_Position ON Banners(Position);

            CREATE TABLE IF NOT EXISTS FlashSales (
                Id TEXT NOT NULL CONSTRAINT PK_FlashSales PRIMARY KEY,
                Title TEXT NOT NULL,
                DiscountPercent INTEGER NOT NULL DEFAULT 10,
                StartsAt TEXT NOT NULL,
                EndsAt TEXT NOT NULL,
                Status TEXT NOT NULL DEFAULT 'Draft',
                ProductCount INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );

            CREATE TABLE IF NOT EXISTS Conversations (
                Id TEXT NOT NULL CONSTRAINT PK_Conversations PRIMARY KEY,
                BuyerId TEXT NOT NULL,
                SellerId TEXT NOT NULL,
                LastMessagePreview TEXT NOT NULL DEFAULT '',
                LastMessageAt TEXT NOT NULL,
                BuyerUnreadCount INTEGER NOT NULL DEFAULT 0,
                SellerUnreadCount INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_Conversations_BuyerId_SellerId ON Conversations(BuyerId, SellerId);
            CREATE INDEX IF NOT EXISTS IX_Conversations_BuyerId ON Conversations(BuyerId);
            CREATE INDEX IF NOT EXISTS IX_Conversations_SellerId ON Conversations(SellerId);
            CREATE INDEX IF NOT EXISTS IX_Conversations_LastMessageAt ON Conversations(LastMessageAt);

            CREATE TABLE IF NOT EXISTS ChatMessages (
                Id TEXT NOT NULL CONSTRAINT PK_ChatMessages PRIMARY KEY,
                ConversationId TEXT NOT NULL,
                SenderId TEXT NOT NULL,
                SenderName TEXT NOT NULL DEFAULT '',
                SenderRole TEXT NOT NULL DEFAULT 'Buyer',
                Body TEXT NOT NULL,
                CreatedAt TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_ChatMessages_ConversationId ON ChatMessages(ConversationId);

            CREATE TABLE IF NOT EXISTS SellerCoupons (
                Id TEXT NOT NULL CONSTRAINT PK_SellerCoupons PRIMARY KEY,
                SellerId TEXT NOT NULL,
                Code TEXT NOT NULL,
                Description TEXT NOT NULL DEFAULT '',
                Type INTEGER NOT NULL DEFAULT 0,
                Value TEXT NOT NULL DEFAULT '0',
                MinOrderAmount TEXT NOT NULL DEFAULT '0',
                MaxDiscount TEXT NULL,
                MaxUses INTEGER NOT NULL DEFAULT 0,
                UsedCount INTEGER NOT NULL DEFAULT 0,
                ExpiresAt TEXT NULL,
                IsActive INTEGER NOT NULL DEFAULT 1,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_SellerCoupons_SellerId_Code ON SellerCoupons(SellerId, Code);
            CREATE INDEX IF NOT EXISTS IX_SellerCoupons_SellerId ON SellerCoupons(SellerId);

            CREATE TABLE IF NOT EXISTS SiteConfigs (
                Key TEXT NOT NULL CONSTRAINT PK_SiteConfigs PRIMARY KEY,
                Value TEXT NOT NULL,
                UpdatedAt TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS LoyaltyRewards (
                Id TEXT NOT NULL CONSTRAINT PK_LoyaltyRewards PRIMARY KEY,
                Title TEXT NOT NULL,
                Description TEXT NOT NULL DEFAULT '',
                PointsCost INTEGER NOT NULL DEFAULT 100,
                Type TEXT NOT NULL DEFAULT 'Voucher',
                VoucherAmount TEXT NOT NULL DEFAULT '0',
                IsActive INTEGER NOT NULL DEFAULT 1,
                IsComingSoon INTEGER NOT NULL DEFAULT 0,
                Position INTEGER NOT NULL DEFAULT 0,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );

            -- P0: Audit log bất biến
            CREATE TABLE IF NOT EXISTS AuditLogs (
                Id TEXT NOT NULL CONSTRAINT PK_AuditLogs PRIMARY KEY,
                ActorUserId TEXT NULL,
                ActorRole TEXT NOT NULL DEFAULT 'System',
                Action TEXT NOT NULL DEFAULT '',
                EntityType TEXT NOT NULL DEFAULT '',
                EntityId TEXT NULL,
                Amount TEXT NULL,
                Detail TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_AuditLogs_CreatedAt ON AuditLogs(CreatedAt);
            CREATE INDEX IF NOT EXISTS IX_AuditLogs_EntityType_EntityId ON AuditLogs(EntityType, EntityId);

            -- P0: Lịch sử giao dịch cổng thanh toán
            CREATE TABLE IF NOT EXISTS PaymentTransactions (
                Id TEXT NOT NULL CONSTRAINT PK_PaymentTransactions PRIMARY KEY,
                OrderId TEXT NULL,
                Method INTEGER NOT NULL DEFAULT 0,
                Provider TEXT NOT NULL DEFAULT '',
                ProviderTxnId TEXT NOT NULL DEFAULT '',
                Amount TEXT NOT NULL DEFAULT '0',
                Status TEXT NOT NULL DEFAULT '',
                RawPayload TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_PaymentTransactions_Provider_ProviderTxnId ON PaymentTransactions(Provider, ProviderTxnId);
            CREATE INDEX IF NOT EXISTS IX_PaymentTransactions_OrderId ON PaymentTransactions(OrderId);

            -- P1: Cấu hình phí theo danh mục + ngưỡng giá
            CREATE TABLE IF NOT EXISTS FeeConfigs (
                Id TEXT NOT NULL CONSTRAINT PK_FeeConfigs PRIMARY KEY,
                CategorySlug TEXT NOT NULL DEFAULT '',
                MinPrice TEXT NOT NULL DEFAULT '0',
                MaxPrice TEXT NULL,
                SellerFeePercent TEXT NOT NULL DEFAULT '0',
                Note TEXT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_FeeConfigs_CategorySlug_MinPrice ON FeeConfigs(CategorySlug, MinPrice);

            -- P1: Gói thành viên Seller
            CREATE TABLE IF NOT EXISTS SellerPlans (
                Id TEXT NOT NULL CONSTRAINT PK_SellerPlans PRIMARY KEY,
                Code TEXT NOT NULL DEFAULT '',
                Name TEXT NOT NULL DEFAULT '',
                PricePerMonth TEXT NOT NULL DEFAULT '0',
                FeeDiscountPercent TEXT NOT NULL DEFAULT '0',
                MaxListings INTEGER NOT NULL DEFAULT -1,
                BoostsPerMonth INTEGER NOT NULL DEFAULT 0,
                Badge TEXT NULL,
                Position INTEGER NOT NULL DEFAULT 0,
                IsActive INTEGER NOT NULL DEFAULT 1,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS IX_SellerPlans_Code ON SellerPlans(Code);

            -- Boost / day tin
            CREATE TABLE IF NOT EXISTS BoostLogs (
                Id TEXT NOT NULL CONSTRAINT PK_BoostLogs PRIMARY KEY,
                SellerId TEXT NOT NULL,
                ProductId TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                UpdatedAt TEXT NULL
            );
            CREATE INDEX IF NOT EXISTS IX_BoostLogs_SellerId_CreatedAt ON BoostLogs(SellerId, CreatedAt);
        ", ct);

        // Thêm cột mới cho bảng đã tồn tại (SQLite không hỗ trợ ADD COLUMN IF NOT EXISTS).
        await AddColumnIfMissingAsync(db, "Orders", "DeliverDueAt", "TEXT NULL", ct);
        await AddColumnIfMissingAsync(db, "OrderLines", "FeeAmount", "TEXT NOT NULL DEFAULT '0'", ct);
        await AddColumnIfMissingAsync(db, "Sellers", "PlanCode", "TEXT NOT NULL DEFAULT 'free'", ct);
        await AddColumnIfMissingAsync(db, "Sellers", "PlanExpiresAt", "TEXT NULL", ct);
        await AddColumnIfMissingAsync(db, "Products", "DepositAmount", "TEXT NOT NULL DEFAULT '0'", ct);
        await AddColumnIfMissingAsync(db, "Products", "DepositStatus", "INTEGER NOT NULL DEFAULT 0", ct);
        await AddColumnIfMissingAsync(db, "Sellers", "TrustScore", "INTEGER NOT NULL DEFAULT 80", ct);
        await AddColumnIfMissingAsync(db, "Sellers", "LastViolationAt", "TEXT NULL", ct);
        await AddColumnIfMissingAsync(db, "Sellers", "LastTrustBonusAt", "TEXT NULL", ct);
        await AddColumnIfMissingAsync(db, "KycSubmissions", "FrontImage", "TEXT NULL", ct);
        await AddColumnIfMissingAsync(db, "KycSubmissions", "BackImage", "TEXT NULL", ct);
        await AddColumnIfMissingAsync(db, "Products", "BoostedUntil", "TEXT NULL", ct);
        await AddColumnIfMissingAsync(db, "Products", "ImageUrl", "TEXT NULL", ct);
        await AddColumnIfMissingAsync(db, "Users", "AffiliateRewarded", "INTEGER NOT NULL DEFAULT 0", ct);
        await AddColumnIfMissingAsync(db, "Sellers", "TrustBadgeUntil", "TEXT NULL", ct);
        await AddColumnIfMissingAsync(db, "BoostLogs", "Paid", "INTEGER NOT NULL DEFAULT 0", ct);
        await AddColumnIfMissingAsync(db, "Banners", "ViewCount", "INTEGER NOT NULL DEFAULT 0", ct);
        await AddColumnIfMissingAsync(db, "Banners", "CostModel", "TEXT NOT NULL DEFAULT 'none'", ct);
        await AddColumnIfMissingAsync(db, "Banners", "Rate", "TEXT NOT NULL DEFAULT '0'", ct);
    }

    /// <summary>Thêm cột vào bảng nếu chưa tồn tại (idempotent cho SQLite).</summary>
    private static async Task AddColumnIfMissingAsync(AppDbContext db, string table, string column, string definition, CancellationToken ct)
    {
        var count = await db.Database
            .SqlQueryRaw<long>($"SELECT COUNT(*) AS \"Value\" FROM pragma_table_info('{table}') WHERE name = {{0}}", column)
            .FirstAsync(ct);
        if (count == 0)
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {definition};", ct);
    }

    private static async Task SeedDefaultConfigAsync(AppDbContext db, CancellationToken ct)
    {
        var defaults = new Dictionary<string, string>
        {
            // Fee & Loyalty
            ["fee_rate"]               = "0.05",
            ["loyalty_pts_per_1000"]   = "1",
            ["loyalty_signup_bonus"]   = "100",
            ["loyalty_review_bonus"]   = "50",
            ["loyalty_referral_bonus"] = "200",
            ["loyalty_tier_silver"]    = "1000",
            ["loyalty_tier_gold"]      = "5000",
            ["loyalty_tier_diamond"]   = "15000",
            // Site info
            ["site_name"]              = "MMO Market",
            ["site_description"]       = "Sàn giao dịch tài khoản MMO, tool và dịch vụ số uy tín",
            ["contact_email"]          = "support@mmomarket.vn",
            ["contact_phone"]          = "",
            // Operations
            ["maintenance_mode"]       = "false",
            ["maintenance_message"]    = "Hệ thống đang bảo trì, vui lòng quay lại sau.",
            ["registration_enabled"]   = "true",
            ["welcome_bonus"]          = "100000",
            // Transaction rules
            ["min_withdraw"]           = "50000",
            ["max_withdraw"]           = "50000000",
            ["escrow_release_days"]    = "2",   // 48h (P0)
            ["deliver_window_hours"]   = "2",   // T+2h (P0)
            ["dispute_sla_hours"]      = "72",
            ["kyc_required_to_sell"]   = "true",
            // Giới hạn nạp/rút theo ngày theo cấp tài khoản (P1.3, §7.2). 0 = không giới hạn.
            ["limit_deposit_unverified"]  = "2000000",
            ["limit_withdraw_unverified"] = "1000000",
            ["limit_deposit_kyc"]         = "20000000",
            ["limit_withdraw_kyc"]        = "10000000",
            ["limit_deposit_seller"]      = "50000000",
            ["limit_withdraw_seller"]     = "30000000",
            ["limit_deposit_vip"]         = "0",
            ["limit_withdraw_vip"]        = "50000000",
            // Cọc đăng tin (P1.4)
            ["listing_deposit_enabled"]   = "true",
            ["listing_deposit_percent"]   = "5",
            ["listing_deposit_min"]       = "10000",
            ["listing_deposit_max"]       = "500000",
            ["boost_duration_hours"]      = "24",
            ["boost_paid_price"]          = "20000",
            ["affiliate_percent"]         = "30",
            ["trust_badge_price"]         = "200000",
            ["trust_badge_min_reviews"]   = "50",
            ["trust_badge_min_rating"]    = "4.5",
            // Trust Score (P2.1, §8)
            ["trust_start"]               = "80",
            ["trust_complete_5star"]      = "2",
            ["trust_complete_noreview"]   = "1",
            ["trust_review_low"]          = "-3",
            ["trust_dispute_lost"]        = "-10",
            ["trust_late_delivery"]       = "-5",
            ["trust_violation"]           = "-15",
            ["trust_clean_30d_bonus"]     = "5",
            // Chống lạm dụng tranh chấp (P2.3) + partial refund mặc định (P2.4)
            ["dispute_max_per_month"]     = "3",
            ["partial_refund_default_percent"] = "50",
            // Payment
            ["enabled_payments"]       = "Wallet,VietQr,Momo,ZaloPay,VnPay",
        };

        var existing = await db.SiteConfigs.Select(c => c.Key).ToListAsync(ct);
        var missing = defaults.Where(kv => !existing.Contains(kv.Key))
            .Select(kv => new Domain.Entities.SiteConfig { Key = kv.Key, Value = kv.Value })
            .ToList();
        if (missing.Count > 0)
        {
            db.SiteConfigs.AddRange(missing);
            await db.SaveChangesAsync(ct);
        }
    }

    private static async Task SeedSellerPlansAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.SellerPlans.AnyAsync(ct)) return;
        db.SellerPlans.AddRange(
            new SellerPlan { Code = "free",  Name = "Free",       PricePerMonth = 0m,       FeeDiscountPercent = 0m,  MaxListings = 10, BoostsPerMonth = 0,  Badge = null,       Position = 1 },
            new SellerPlan { Code = "basic", Name = "Seller Basic", PricePerMonth = 99_000m,  FeeDiscountPercent = 20m, MaxListings = 30, BoostsPerMonth = 5,  Badge = null,       Position = 2 },
            new SellerPlan { Code = "pro",   Name = "Seller Pro",   PricePerMonth = 299_000m, FeeDiscountPercent = 40m, MaxListings = -1, BoostsPerMonth = 20, Badge = "verified", Position = 3 },
            new SellerPlan { Code = "vip",   Name = "Seller VIP",   PricePerMonth = 599_000m, FeeDiscountPercent = 60m, MaxListings = -1, BoostsPerMonth = 50, Badge = "top",      Position = 4 }
        );
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedFeeConfigsAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.FeeConfigs.AnyAsync(ct)) return;
        db.FeeConfigs.AddRange(
            // Mặc định toàn sàn (fallback)
            new FeeConfig { CategorySlug = "",           MinPrice = 0m, MaxPrice = null,      SellerFeePercent = 10m, Note = "Mặc định" },
            // Acc/skin game: theo ngưỡng giá (acc thường <500k vs cao cấp ≥500k)
            new FeeConfig { CategorySlug = "game",       MinPrice = 0m,       MaxPrice = 500_000m, SellerFeePercent = 9m, Note = "Acc game thường (<500k)" },
            new FeeConfig { CategorySlug = "game",       MinPrice = 500_000m, MaxPrice = null,     SellerFeePercent = 6m, Note = "Acc game cao cấp (≥500k)" },
            // Phần mềm / license key
            new FeeConfig { CategorySlug = "tool",       MinPrice = 0m, MaxPrice = null, SellerFeePercent = 10m, Note = "Phần mềm / License Key" },
            new FeeConfig { CategorySlug = "ai",         MinPrice = 0m, MaxPrice = null, SellerFeePercent = 10m, Note = "AI account" },
            new FeeConfig { CategorySlug = "course",     MinPrice = 0m, MaxPrice = null, SellerFeePercent = 10m, Note = "Khoá học" },
            // Gift card
            new FeeConfig { CategorySlug = "giftcard",   MinPrice = 0m, MaxPrice = null, SellerFeePercent = 8m,  Note = "Gift card" },
            // Social / email / SĐT ảo — tỷ lệ tranh chấp cao
            new FeeConfig { CategorySlug = "social",     MinPrice = 0m, MaxPrice = null, SellerFeePercent = 15m, Note = "Social / Email / SĐT ảo" },
            // Dịch vụ / tăng tương tác — rủi ro cao
            new FeeConfig { CategorySlug = "engagement", MinPrice = 0m, MaxPrice = null, SellerFeePercent = 12m, Note = "Dịch vụ MMO / tăng tương tác" }
        );
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Đồng bộ rating shop = tổng hợp từ sản phẩm (bình quân có trọng số theo số đánh giá).
    /// Chạy mỗi lần khởi động để chữa dữ liệu shop bị lệch (vd rating về 0 do bug cũ).</summary>
    private static async Task ReconcileSellerRatingsAsync(AppDbContext db, CancellationToken ct)
    {
        var sellers = await db.Sellers.ToListAsync(ct);
        if (sellers.Count == 0) return;
        var changed = false;
        foreach (var seller in sellers)
        {
            var products = await db.Products.Where(p => p.SellerId == seller.Id)
                .Select(p => new { p.Rating, p.ReviewCount }).ToListAsync(ct);
            var total = products.Sum(p => p.ReviewCount);
            var rating = total == 0 ? 0 : Math.Round(products.Sum(p => p.Rating * p.ReviewCount) / total, 2);
            if (seller.ReviewCount != total || Math.Abs(seller.Rating - rating) > 0.001)
            {
                seller.ReviewCount = total;
                seller.Rating = rating;
                changed = true;
            }
        }
        if (changed) await db.SaveChangesAsync(ct);
    }

    private static async Task SeedDemoLoyaltyRewardsAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.LoyaltyRewards.AnyAsync(ct)) return;
        db.LoyaltyRewards.AddRange(
            new Domain.Entities.LoyaltyReward { Title = "Voucher 10.000₫",    Description = "Giảm thẳng vào đơn hàng bất kỳ",          PointsCost = 100,  Type = "Voucher",  VoucherAmount = 10000,  IsActive = true,  Position = 1 },
            new Domain.Entities.LoyaltyReward { Title = "Voucher 50.000₫",    Description = "Áp dụng cho đơn từ 200.000₫",             PointsCost = 500,  Type = "Voucher",  VoucherAmount = 50000,  IsActive = true,  Position = 2 },
            new Domain.Entities.LoyaltyReward { Title = "Voucher 100.000₫",   Description = "Áp dụng cho đơn từ 500.000₫",             PointsCost = 1000, Type = "Voucher",  VoucherAmount = 100000, IsActive = true,  Position = 3 },
            new Domain.Entities.LoyaltyReward { Title = "Miễn phí giao hàng", Description = "Miễn phí mọi loại phí trên 1 đơn",        PointsCost = 200,  Type = "Shipping", VoucherAmount = 0,      IsActive = true,  Position = 4 },
            new Domain.Entities.LoyaltyReward { Title = "Voucher 200.000₫",   Description = "Áp dụng cho đơn từ 1.000.000₫",           PointsCost = 2000, Type = "Voucher",  VoucherAmount = 200000, IsActive = true,  Position = 5 },
            new Domain.Entities.LoyaltyReward { Title = "Tài khoản Premium",  Description = "1 tháng ChatGPT Plus (giao tự động)",      PointsCost = 5000, Type = "Product",  VoucherAmount = 0,      IsActive = false, IsComingSoon = true, Position = 6 }
        );
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedDemoConversationsAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.Conversations.AnyAsync(ct)) return;
        var buyer = await db.Users.FirstOrDefaultAsync(u => u.Username == "buyer", ct);
        var kimchi = await db.Sellers.FirstOrDefaultAsync(s => s.Username == "kimchi", ct);
        if (buyer == null || kimchi == null) return;
        var now = DateTime.UtcNow;
        var conv = new Domain.Entities.Conversation
        {
            BuyerId = buyer.Id, SellerId = kimchi.Id,
            LastMessagePreview = "Bạn có thể giao tài khoản ngay không?",
            LastMessageAt = now.AddMinutes(-5),
            BuyerUnreadCount = 0, SellerUnreadCount = 1,
        };
        db.Conversations.Add(conv);
        await db.SaveChangesAsync(ct);
        db.ChatMessages.AddRange(
            new Domain.Entities.ChatMessage { ConversationId = conv.Id, SenderId = buyer.Id, SenderName = buyer.DisplayName, SenderRole = "Buyer", Body = "Chào shop, tôi muốn hỏi về sản phẩm ChatGPT Plus.", CreatedAt = now.AddMinutes(-30) },
            new Domain.Entities.ChatMessage { ConversationId = conv.Id, SenderId = kimchi.UserId, SenderName = "KimChi Shop", SenderRole = "Seller", Body = "Chào bạn! Mình có sản phẩm ChatGPT Plus chính hãng, giao tự động 24/7 nhé.", CreatedAt = now.AddMinutes(-25) },
            new Domain.Entities.ChatMessage { ConversationId = conv.Id, SenderId = buyer.Id, SenderName = buyer.DisplayName, SenderRole = "Buyer", Body = "Bạn có thể giao tài khoản ngay không?", CreatedAt = now.AddMinutes(-5) }
        );
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedDemoSellerCouponsAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.SellerCoupons.AnyAsync(ct)) return;
        var kimchi = await db.Sellers.FirstOrDefaultAsync(s => s.Username == "kimchi", ct);
        if (kimchi == null) return;
        var now = DateTime.UtcNow;
        db.SellerCoupons.AddRange(
            new Domain.Entities.SellerCoupon
            {
                SellerId = kimchi.Id, Code = "KIMCHI10",
                Description = "Giảm 10% cho đơn từ 200K", Type = Domain.Enums.CouponType.Percent,
                Value = 10, MinOrderAmount = 200000, MaxDiscount = 50000,
                MaxUses = 100, UsedCount = 12, IsActive = true,
                ExpiresAt = now.AddDays(30),
            },
            new Domain.Entities.SellerCoupon
            {
                SellerId = kimchi.Id, Code = "KIMCHI50K",
                Description = "Giảm 50.000₫ cho đơn từ 500K", Type = Domain.Enums.CouponType.Fixed,
                Value = 50000, MinOrderAmount = 500000,
                MaxUses = 50, UsedCount = 5, IsActive = true,
            },
            new Domain.Entities.SellerCoupon
            {
                SellerId = kimchi.Id, Code = "KCSALE20",
                Description = "Flash sale 20% - đã hết hạn", Type = Domain.Enums.CouponType.Percent,
                Value = 20, MinOrderAmount = 0, MaxDiscount = 100000,
                MaxUses = 200, UsedCount = 200, IsActive = false,
                ExpiresAt = now.AddDays(-5),
            }
        );
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedDemoBannersAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.Banners.AnyAsync(ct)) return;
        var now = DateTime.UtcNow;
        db.Banners.AddRange(
            new Domain.Entities.Banner
            {
                Title = "Siêu Sale Tháng 5 🎉",
                Subtitle = "Giảm đến 50% tài khoản AI & Tool cao cấp",
                LinkUrl = "/products?category=ai",
                BgColor = "#7c3aed",
                TextColor = "#ffffff",
                Position = 1,
                IsActive = true,
                StartsAt = now.AddDays(-10),
                EndsAt = now.AddDays(20),
            },
            new Domain.Entities.Banner
            {
                Title = "ChatGPT 4o Premium",
                Subtitle = "Tài khoản chính hãng, giao tự động 24/7",
                LinkUrl = "/products?category=ai",
                BgColor = "#0ea5e9",
                TextColor = "#ffffff",
                Position = 2,
                IsActive = true,
            },
            new Domain.Entities.Banner
            {
                Title = "Flash Sale Cuối Tuần",
                Subtitle = "Mỗi thứ 7 & CN giảm thêm 20% tất cả sản phẩm",
                LinkUrl = "/flash-sale",
                BgColor = "#ef4444",
                TextColor = "#ffffff",
                Position = 3,
                IsActive = false,
            }
        );
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedDemoFlashSalesAsync(AppDbContext db, CancellationToken ct)
    {
        if (await db.FlashSales.AnyAsync(ct)) return;
        var now = DateTime.UtcNow;
        db.FlashSales.AddRange(
            new Domain.Entities.FlashSale
            {
                Title = "Flash Sale Khai Trương",
                DiscountPercent = 30,
                StartsAt = now.AddDays(-30),
                EndsAt = now.AddDays(-20),
                Status = "Ended",
                ProductCount = 12,
            },
            new Domain.Entities.FlashSale
            {
                Title = "Khuyến Mãi Tháng 5",
                DiscountPercent = 15,
                StartsAt = now.AddDays(-5),
                EndsAt = now.AddDays(10),
                Status = "Active",
                ProductCount = 8,
            },
            new Domain.Entities.FlashSale
            {
                Title = "Mega Sale 6/6",
                DiscountPercent = 50,
                StartsAt = now.AddDays(5),
                EndsAt = now.AddDays(6),
                Status = "Draft",
                ProductCount = 0,
            }
        );
        await db.SaveChangesAsync(ct);
    }
}
