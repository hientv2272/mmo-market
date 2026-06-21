using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Auth;
using MmoMarket.Application.Catalog;
using MmoMarket.Application.Common;
using MmoMarket.Application.Config;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Sellers;

public record SellerProductDto(
    Guid Id, string Slug, string Title, string CategorySlug, decimal Price, decimal? ComparePrice,
    string Delivery, int WarrantyDays, int Stock, int Sold, double Rating, int ReviewCount,
    string ThumbnailColor, string? ThumbnailIcon, string? ImageUrl, string Status, string Description,
    int InventoryAvailable, int InventoryReserved, int InventorySold,
    decimal DepositAmount, string DepositStatus, DateTime? BoostedUntil);

public record BoostInfoDto(int Quota, int Used, int Remaining, int DurationHours, decimal PaidPrice);

public record BadgeInfoDto(decimal Price, int MinReviews, double MinRating, int ReviewCount, double Rating,
    bool Eligible, int DurationMonths, DateTime? ActiveUntil);

public record SellerProductCreateDto(
    string Title, string CategorySlug, decimal Price, decimal? ComparePrice, string Delivery,
    int WarrantyDays, int Stock, string ThumbnailColor, string? ThumbnailIcon, string? ImageUrl, string Description);

public record SellerProductUpdateDto(
    string? Title, string? CategorySlug, decimal? Price, decimal? ComparePrice, string? Delivery,
    int? WarrantyDays, int? Stock, string? ThumbnailColor, string? ThumbnailIcon, string? ImageUrl, string? Description, string? Status);

public record SellerOrderLineDto(
    Guid OrderId, Guid OrderLineId, string OrderCode, string Status, Guid ProductId, string ProductTitle,
    int Quantity, decimal UnitPrice, decimal LineTotal, string Delivery, string BuyerDisplayName,
    DateTime CreatedAt, DateTime? PaidAt, DateTime? DeliveredAt, DateTime? CompletedAt, string[]? DeliveredItems);

public record SellerReviewDto(Guid Id, Guid ProductId, string ProductTitle, string BuyerName, int Rating, string Comment, DateTime CreatedAt, string? Reply);

public record SellerCouponDto(Guid Id, string Code, string Description, string Type, decimal Value, decimal MinOrderAmount, decimal? MaxDiscount, int MaxUses, int UsedCount, DateTime? ExpiresAt, bool IsActive, DateTime CreatedAt);
public record CreateSellerCouponDto(string Code, string Description, string Type, decimal Value, decimal MinOrderAmount, decimal? MaxDiscount, int MaxUses, DateTime? ExpiresAt);
public record UpdateSellerCouponDto(string Code, string Description, string Type, decimal Value, decimal MinOrderAmount, decimal? MaxDiscount, int MaxUses, DateTime? ExpiresAt, bool IsActive);

public record SellerInventoryDto(
    Guid ProductId, string ProductSlug, string ProductTitle,
    int Available, int Reserved, int SoldCount, InventoryItemDto[] Items);

public record InventoryItemDto(Guid Id, string Preview, bool Reserved, bool Sold, Guid? OrderId, DateTime CreatedAt);

public record InventoryUploadDto(string[] Items);
public record InventoryItemUpdateDto(string? Content, bool? Reserved);

public record WithdrawCreateDto(
    decimal Amount, string Method, string? Account, string? Note, string? TotpCode,
    Guid? PayoutMethodId,
    string? BankBin, string? BankName, string? AccountNumber, string? AccountHolder,
    string? CryptoNetwork, string? WalletAddress);

public record WithdrawDto(
    Guid Id, decimal Amount, string Method, string Account, string Status, string? Note, string? AdminNote,
    DateTime CreatedAt, DateTime? ProcessedAt,
    string? BankName, string? AccountNumber, string? AccountHolder, string? CryptoNetwork,
    string? WalletAddress, bool? HolderMatchesKyc, string? PayoutReference);

public record PayoutMethodDto(
    Guid Id, string Type, string Label, string? BankBin, string? BankName, string? AccountNumber,
    string? AccountHolder, string? CryptoNetwork, string? WalletAddress, bool IsDefault,
    bool HolderMatchesKyc, DateTime CreatedAt);

public record PayoutMethodSaveDto(
    string Type, string? Label, string? BankBin, string? BankName, string? AccountNumber,
    string? AccountHolder, string? CryptoNetwork, string? WalletAddress, bool IsDefault);

public record SellerDashboardDto(
    decimal Revenue30d, int Orders30d, int ProductsActive, int ProductsPending,
    int OrdersAwaitingDelivery, int OpenDisputes, int PendingWithdrawals,
    decimal AvailableBalance, int TrustScore,
    decimal MinWithdraw, decimal MaxWithdraw, bool KycVerified, string? KycFullName);

public record ShopSettingsDto(
    string DisplayName, string AvatarColor, string? Bio, string? ResponseTime,
    string? LogoUrl, string? BannerUrl, string? ContactEmail, string? ContactZalo, string? ContactTelegram,
    string? WarrantyPolicy, string? ReturnPolicy, bool IsOnVacation, string? VacationMessage);

public record ShopSettingsUpdateDto(
    string DisplayName, string AvatarColor, string? Bio, string? ResponseTime,
    string? LogoUrl, string? BannerUrl, string? ContactEmail, string? ContactZalo, string? ContactTelegram,
    string? WarrantyPolicy, string? ReturnPolicy, bool IsOnVacation, string? VacationMessage);

public class SellerService
{
    private readonly IAppDbContext _db;
    private readonly ConfigService _config;
    private readonly TotpService _totp;
    private readonly SellerPlanService _plans;
    private readonly Wallet.TransactionLimitService _limits;
    private readonly IEncryptionService _enc;
    public SellerService(IAppDbContext db, ConfigService config, TotpService totp, SellerPlanService plans, Wallet.TransactionLimitService limits, IEncryptionService enc)
    { _db = db; _config = config; _totp = totp; _plans = plans; _limits = limits; _enc = enc; }

    private async Task<Seller> GetSellerForUserAsync(Guid userId, CancellationToken ct)
    {
        var seller = await _db.Sellers.FirstOrDefaultAsync(s => s.UserId == userId, ct)
            ?? throw new AppException("Bạn chưa được kích hoạt seller. Hãy submit KYC trước.", 403);
        return seller;
    }

    public async Task<SellerDashboardDto> GetDashboardAsync(Guid userId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var since = DateTime.UtcNow.AddDays(-30);
        var revenue30dList = await _db.OrderLines
            .Include(l => l.Order)
            .Where(l => l.SellerId == seller.Id && l.Order!.Status == OrderStatus.Completed && l.Order.CompletedAt >= since)
            .Select(l => l.UnitPrice * l.Quantity)
            .ToListAsync(ct);
        var revenue30d = revenue30dList.Sum();
        var orders30d = await _db.OrderLines
            .Include(l => l.Order)
            .Where(l => l.SellerId == seller.Id && l.Order!.CreatedAt >= since)
            .Select(l => l.OrderId).Distinct().CountAsync(ct);
        var prodActive = await _db.Products.CountAsync(p => p.SellerId == seller.Id && p.Status == ProductStatus.Active, ct);
        var prodPending = await _db.Products.CountAsync(p => p.SellerId == seller.Id && p.Status == ProductStatus.Pending, ct);
        var awaiting = await _db.OrderLines
            .Include(l => l.Order)
            .CountAsync(l => l.SellerId == seller.Id && (l.Order!.Status == OrderStatus.EscrowLocked || l.Order.Status == OrderStatus.Delivering) && l.Delivery != DeliveryMethod.Auto, ct);
        var openDisputes = await _db.Disputes.CountAsync(d => d.SellerId == seller.Id && (d.Status == DisputeStatus.Open || d.Status == DisputeStatus.Investigating), ct);
        var pendingWd = await _db.WithdrawRequests.CountAsync(w => w.SellerUserId == userId && w.Status == WithdrawStatus.Pending, ct);
        var earnedRows = await _db.OrderLines
            .Include(l => l.Order)
            .Where(l => l.SellerId == seller.Id && l.Order!.Status == OrderStatus.Completed)
            .Select(l => new { Gross = l.UnitPrice * l.Quantity, l.FeeAmount })
            .ToListAsync(ct);
        var totalEarned = earnedRows.Sum(r => r.Gross - r.FeeAmount);
        // Giữ chỗ cả yêu cầu đang chờ duyệt (Pending) để không cho rút vượt số dư khi có nhiều yêu cầu chồng nhau.
        var withdrawnList = await _db.WithdrawRequests
            .Where(w => w.SellerUserId == userId && w.Status != WithdrawStatus.Rejected)
            .Select(w => w.Amount)
            .ToListAsync(ct);
        var totalWithdrawn = withdrawnList.Sum();
        var available = Math.Max(0m, totalEarned - totalWithdrawn);
        var minWithdraw = await _config.GetDecimalAsync(ConfigKeys.MinWithdraw, 50_000m, ct);
        var maxWithdraw = await _config.GetDecimalAsync(ConfigKeys.MaxWithdraw, 50_000_000m, ct);
        // KYC duyệt = trạng thái trên User (nguồn chuẩn); tên lấy từ hồ sơ KYC nếu có.
        var sellerUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        var kycVerified = sellerUser?.KycStatus == KycStatus.Approved;
        var kycFullName = await GetKycFullNameAsync(userId, ct);
        return new SellerDashboardDto(revenue30d, orders30d, prodActive, prodPending, awaiting, openDisputes, pendingWd, available, seller.TrustScore, minWithdraw, maxWithdraw, kycVerified, kycFullName);
    }

    private const int MaxImageDataUrlLength = 3_500_000; // ~2MB ảnh sau khi base64 (~33% overhead)

    public async Task<ShopSettingsDto> GetShopSettingsAsync(Guid userId, CancellationToken ct)
    {
        var s = await GetSellerForUserAsync(userId, ct);
        return MapShopSettings(s);
    }

    public async Task<ShopSettingsDto> UpdateShopSettingsAsync(Guid userId, ShopSettingsUpdateDto dto, CancellationToken ct)
    {
        var s = await GetSellerForUserAsync(userId, ct);

        var displayName = (dto.DisplayName ?? "").Trim();
        if (displayName.Length < 2) throw new AppException("Tên shop phải có ít nhất 2 ký tự.", 400);
        if (displayName.Length > 80) throw new AppException("Tên shop tối đa 80 ký tự.", 400);

        var bio = Trimmed(dto.Bio, 1000, "Mô tả shop tối đa 1000 ký tự.");
        var warranty = Trimmed(dto.WarrantyPolicy, 2000, "Chính sách bảo hành tối đa 2000 ký tự.");
        var ret = Trimmed(dto.ReturnPolicy, 2000, "Chính sách đổi trả tối đa 2000 ký tự.");
        var vacationMsg = Trimmed(dto.VacationMessage, 500, "Thông báo tạm nghỉ tối đa 500 ký tự.");

        ValidateImage(dto.LogoUrl, "Logo");
        ValidateImage(dto.BannerUrl, "Ảnh bìa");

        s.DisplayName = displayName;
        s.AvatarColor = string.IsNullOrWhiteSpace(dto.AvatarColor) ? s.AvatarColor : dto.AvatarColor.Trim();
        s.Bio = bio;
        s.ResponseTime = Trimmed(dto.ResponseTime, 50, "Thời gian phản hồi tối đa 50 ký tự.");
        s.LogoUrl = NullIfEmpty(dto.LogoUrl);
        s.BannerUrl = NullIfEmpty(dto.BannerUrl);
        s.ContactEmail = Trimmed(dto.ContactEmail, 120, "Email liên hệ quá dài.");
        s.ContactZalo = Trimmed(dto.ContactZalo, 60, "Zalo quá dài.");
        s.ContactTelegram = Trimmed(dto.ContactTelegram, 60, "Telegram quá dài.");
        s.WarrantyPolicy = warranty;
        s.ReturnPolicy = ret;
        s.IsOnVacation = dto.IsOnVacation;
        s.VacationMessage = vacationMsg;

        await _db.SaveChangesAsync(ct);
        return MapShopSettings(s);
    }

    private static ShopSettingsDto MapShopSettings(Seller s) => new(
        s.DisplayName, s.AvatarColor, s.Bio, s.ResponseTime,
        s.LogoUrl, s.BannerUrl, s.ContactEmail, s.ContactZalo, s.ContactTelegram,
        s.WarrantyPolicy, s.ReturnPolicy, s.IsOnVacation, s.VacationMessage);

    private static string? Trimmed(string? value, int max, string tooLongMsg)
    {
        var v = value?.Trim();
        if (string.IsNullOrEmpty(v)) return null;
        if (v.Length > max) throw new AppException(tooLongMsg, 400);
        return v;
    }

    private static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void ValidateImage(string? dataUrl, string label)
    {
        if (string.IsNullOrWhiteSpace(dataUrl)) return;
        if (!dataUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            throw new AppException($"{label} không hợp lệ.", 400);
        if (dataUrl.Length > MaxImageDataUrlLength)
            throw new AppException($"{label} quá lớn (tối đa ~2MB).", 400);
    }

    public async Task<SellerProductDto[]> ListMyProductsAsync(Guid userId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var products = await _db.Products.Where(p => p.SellerId == seller.Id).OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
        var ids = products.Select(p => p.Id).ToList();
        var inv = await _db.InventoryItems.Where(i => ids.Contains(i.ProductId)).ToListAsync(ct);
        return products.Select(p => MapProduct(p, inv.Where(i => i.ProductId == p.Id).ToList())).ToArray();
    }

    public async Task<SellerProductDto> CreateProductAsync(Guid userId, SellerProductCreateDto dto, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        if (!Enum.TryParse<DeliveryMethod>(dto.Delivery, true, out var deliv)) throw new AppException("Delivery không hợp lệ");
        var category = await _db.Categories.FirstOrDefaultAsync(c => c.Slug == dto.CategorySlug, ct)
            ?? throw new AppException("Danh mục không tồn tại");
        if (dto.Price <= 0) throw new AppException("Giá không hợp lệ");

        // Giới hạn số tin đăng theo gói thành viên (P1.2)
        var plan = await _plans.ResolvePlanAsync(seller, ct);
        if (plan.MaxListings >= 0)
        {
            var listingCount = await _db.Products.CountAsync(p => p.SellerId == seller.Id
                && p.Status != ProductStatus.Banned && p.Status != ProductStatus.Rejected, ct);
            if (listingCount >= plan.MaxListings)
                throw new AppException($"Gói {plan.Name} chỉ cho phép tối đa {plan.MaxListings} tin đăng. Vui lòng nâng cấp gói để đăng thêm.");
        }
        // Cọc đăng tin (P1.4): khóa % giá từ ví seller, hoàn khi gỡ tin / tịch thu khi bùng hàng.
        var deposit = await ComputeListingDepositAsync(dto.Price, ct);
        var sellerUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        if (deposit > 0 && sellerUser.WalletBalance < deposit)
            throw new AppException($"Cần đặt cọc {deposit:N0}đ để đăng tin nhưng số dư ví không đủ. Vui lòng nạp thêm.");

        var slugBase = string.IsNullOrWhiteSpace(dto.Title) ? Guid.NewGuid().ToString("N")[..8] : Slugify(dto.Title);
        var slug = slugBase;
        var i = 1;
        while (await _db.Products.AnyAsync(p => p.Slug == slug, ct))
        {
            slug = $"{slugBase}-{++i}";
        }
        var product = new Product
        {
            SellerId = seller.Id,
            Slug = slug,
            Title = dto.Title,
            CategorySlug = dto.CategorySlug,
            Price = dto.Price,
            ComparePrice = dto.ComparePrice,
            Delivery = deliv,
            WarrantyDays = Math.Max(1, dto.WarrantyDays),
            Stock = Math.Max(0, dto.Stock),
            ThumbnailColor = string.IsNullOrWhiteSpace(dto.ThumbnailColor) ? category.Color : dto.ThumbnailColor,
            ThumbnailIcon = dto.ThumbnailIcon ?? category.IconKey,
            ImageUrl = NormalizeProductImage(dto.ImageUrl),
            Description = dto.Description ?? "",
            FeaturesJson = JsonSerializer.Serialize(new[] { "Bảo hành 1-1", "Hỗ trợ 24/7" }),
            PoliciesJson = "[]",
            FaqJson = "[]",
            BadgesJson = JsonSerializer.Serialize(new[] { "Bảo hành 1-1" }),
            Status = ProductStatus.Pending,
            Rating = 0,
            ReviewCount = 0,
            Sold = 0,
            DepositAmount = deposit,
            DepositStatus = deposit > 0 ? ListingDepositStatus.Held : ListingDepositStatus.None,
        };
        _db.Products.Add(product);

        if (deposit > 0)
        {
            sellerUser.WalletBalance -= deposit;
            _db.WalletTxns.Add(new WalletTxn
            {
                UserId = userId,
                Type = WalletTxnType.Deposit,
                Amount = -deposit,
                Status = WalletTxnStatus.Completed,
                Note = $"Cọc đăng tin: {dto.Title}",
            });
            AddAudit(userId, "Seller", "listing_deposit_hold", "Product", product.Slug, deposit,
                $"Khóa cọc đăng tin {dto.Title}");
        }

        await _db.SaveChangesAsync(ct);
        return MapProduct(product, new());
    }

    public async Task<SellerProductDto> UpdateProductAsync(Guid userId, Guid productId, SellerProductUpdateDto dto, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId && p.SellerId == seller.Id, ct)
            ?? throw new AppException("Không tìm thấy sản phẩm", 404);
        if (!string.IsNullOrWhiteSpace(dto.Title)) product.Title = dto.Title;
        if (!string.IsNullOrWhiteSpace(dto.CategorySlug))
        {
            var cat = await _db.Categories.FirstOrDefaultAsync(c => c.Slug == dto.CategorySlug, ct);
            if (cat == null) throw new AppException("Danh mục không tồn tại");
            product.CategorySlug = dto.CategorySlug;
        }
        if (dto.Price.HasValue && dto.Price.Value > 0) product.Price = dto.Price.Value;
        if (dto.ComparePrice.HasValue) product.ComparePrice = dto.ComparePrice;
        if (!string.IsNullOrWhiteSpace(dto.Delivery) && Enum.TryParse<DeliveryMethod>(dto.Delivery, true, out var d)) product.Delivery = d;
        if (dto.WarrantyDays.HasValue) product.WarrantyDays = Math.Max(1, dto.WarrantyDays.Value);
        if (dto.Stock.HasValue) product.Stock = Math.Max(0, dto.Stock.Value);
        if (!string.IsNullOrWhiteSpace(dto.ThumbnailColor)) product.ThumbnailColor = dto.ThumbnailColor;
        if (dto.ThumbnailIcon != null) product.ThumbnailIcon = dto.ThumbnailIcon;
        // ImageUrl: "" (chuỗi rỗng) = gỡ ảnh, null = giữ nguyên, có giá trị = đổi ảnh.
        if (dto.ImageUrl != null) product.ImageUrl = dto.ImageUrl.Length == 0 ? null : NormalizeProductImage(dto.ImageUrl);
        if (dto.Description != null) product.Description = dto.Description;
        if (!string.IsNullOrWhiteSpace(dto.Status) && Enum.TryParse<ProductStatus>(dto.Status, true, out var st))
        {
            // Sellers can only set Hidden / Active(if previously approved). Disallow direct Approve.
            if (st == ProductStatus.Hidden || (st == ProductStatus.Active && product.Status == ProductStatus.Hidden))
                product.Status = st;
        }
        await _db.SaveChangesAsync(ct);
        var inv = await _db.InventoryItems.Where(i => i.ProductId == product.Id).ToListAsync(ct);
        return MapProduct(product, inv);
    }

    public async Task DeleteProductAsync(Guid userId, Guid productId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId && p.SellerId == seller.Id, ct)
            ?? throw new AppException("Không tìm thấy sản phẩm", 404);
        // Hoàn cọc đăng tin nếu đang khóa (P1.4)
        if (product.DepositStatus == ListingDepositStatus.Held && product.DepositAmount > 0)
        {
            var sellerUser = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
            if (sellerUser != null)
            {
                sellerUser.WalletBalance += product.DepositAmount;
                _db.WalletTxns.Add(new WalletTxn
                {
                    UserId = userId,
                    Type = WalletTxnType.DepositRefund,
                    Amount = product.DepositAmount,
                    Status = WalletTxnStatus.Completed,
                    Note = $"Hoàn cọc đăng tin: {product.Title}",
                });
                AddAudit(userId, "Seller", "listing_deposit_refund", "Product", product.Slug, product.DepositAmount,
                    $"Hoàn cọc khi gỡ tin {product.Title}");
            }
            product.DepositStatus = ListingDepositStatus.Refunded;
        }

        var hasOrders = await _db.OrderLines.AnyAsync(l => l.ProductId == productId, ct);
        if (hasOrders)
        {
            // soft delete
            product.Status = ProductStatus.Hidden;
        }
        else
        {
            _db.Products.Remove(product);
        }
        await _db.SaveChangesAsync(ct);
    }

    // ── Boost / đẩy tin ───────────────────────────────────────────────────────
    // Mốc đầu tháng theo giờ VN (UTC+7), trả về dưới dạng UTC để so sánh với CreatedAt.
    // VD: 00:00 ngày 1 giờ VN = 17:00 ngày cuối tháng trước theo UTC.
    private const int VnUtcOffsetHours = 7;
    private static DateTime VnMonthStartUtc(DateTime utcNow)
    {
        var vnNow = utcNow.AddHours(VnUtcOffsetHours);
        var vnMonthStart = new DateTime(vnNow.Year, vnNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return vnMonthStart.AddHours(-VnUtcOffsetHours);
    }

    public async Task<SellerProductDto> BoostProductAsync(Guid userId, Guid productId, bool payWithWallet, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId && p.SellerId == seller.Id, ct)
            ?? throw new AppException("Không tìm thấy sản phẩm", 404);
        if (product.Status != ProductStatus.Active)
            throw new AppException("Chỉ boost được sản phẩm đang hoạt động (Active)");

        var now = DateTime.UtcNow;
        if (product.BoostedUntil.HasValue && product.BoostedUntil.Value > now)
            throw new AppException($"Sản phẩm đang được boost (đến {product.BoostedUntil.Value:HH:mm dd/MM})");

        var plan = await _plans.ResolvePlanAsync(seller, ct);
        var monthStart = VnMonthStartUtc(now);
        // chỉ đếm lượt boost MIỄN PHÍ (Paid=false) cho quota gói
        var usedFree = await _db.BoostLogs.CountAsync(b => b.SellerId == seller.Id && b.CreatedAt >= monthStart && !b.Paid, ct);
        var free = usedFree < plan.BoostsPerMonth;

        var price = await _config.GetDecimalAsync(ConfigKeys.BoostPaidPrice, 20000m, ct);
        if (!free)
        {
            // Hết quota → boost trả phí (cần xác nhận)
            if (!payWithWallet)
                throw new AppException($"Hết lượt boost miễn phí tháng này. Boost trả phí {price:N0}đ — xác nhận để tiếp tục.");
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
                ?? throw new AppException("User không tồn tại", 404);
            if (user.WalletBalance < price)
                throw new AppException($"Số dư ví không đủ để boost trả phí ({price:N0}đ).");
            user.WalletBalance -= price;
            _db.WalletTxns.Add(new WalletTxn
            {
                UserId = userId, Type = WalletTxnType.Purchase, Amount = -price,
                Status = WalletTxnStatus.Completed, Note = $"Phí đẩy tin: {product.Title}",
            });
        }

        var hours = await _config.GetIntAsync(ConfigKeys.BoostDurationHours, 24, ct);
        product.BoostedUntil = now.AddHours(hours);
        _db.BoostLogs.Add(new BoostLog { SellerId = seller.Id, ProductId = product.Id, Paid = !free });
        AddAudit(userId, "Seller", "product_boost", "Product", product.Slug, free ? null : price,
            $"Boost {(free ? "miễn phí" : "trả phí")} sản phẩm {product.Title} trong {hours}h");
        await _db.SaveChangesAsync(ct);
        var inv = await _db.InventoryItems.Where(i => i.ProductId == product.Id).ToListAsync(ct);
        return MapProduct(product, inv);
    }

    public async Task<BoostInfoDto> GetBoostInfoAsync(Guid userId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var plan = await _plans.ResolvePlanAsync(seller, ct);
        var now = DateTime.UtcNow;
        var monthStart = VnMonthStartUtc(now);
        var usedFree = await _db.BoostLogs.CountAsync(b => b.SellerId == seller.Id && b.CreatedAt >= monthStart && !b.Paid, ct);
        var hours = await _config.GetIntAsync(ConfigKeys.BoostDurationHours, 24, ct);
        var price = await _config.GetDecimalAsync(ConfigKeys.BoostPaidPrice, 20000m, ct);
        return new BoostInfoDto(plan.BoostsPerMonth, usedFree, Math.Max(0, plan.BoostsPerMonth - usedFree), hours, price);
    }

    // ── Badge Uy tín (§3.4) ─────────────────────────────────────────────────────
    public async Task<BadgeInfoDto> GetTrustBadgeInfoAsync(Guid userId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var minReviews = await _config.GetIntAsync(ConfigKeys.TrustBadgeMinReviews, 50, ct);
        var minRating = (double)await _config.GetDecimalAsync(ConfigKeys.TrustBadgeMinRating, 4.5m, ct);
        var price = await _config.GetDecimalAsync(ConfigKeys.TrustBadgePrice, 200000m, ct);
        var eligible = seller.ReviewCount >= minReviews && seller.Rating >= minRating;
        return new BadgeInfoDto(price, minReviews, minRating, seller.ReviewCount, seller.Rating, eligible, 12, seller.TrustBadgeUntil);
    }

    public async Task<CurrentPlanDto> BuyTrustBadgeAsync(Guid userId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var minReviews = await _config.GetIntAsync(ConfigKeys.TrustBadgeMinReviews, 50, ct);
        var minRating = (double)await _config.GetDecimalAsync(ConfigKeys.TrustBadgeMinRating, 4.5m, ct);
        if (seller.ReviewCount < minReviews || seller.Rating < minRating)
            throw new AppException($"Cần ≥{minReviews} đánh giá và rating ≥{minRating:0.0}★ để mua badge Uy tín (hiện {seller.ReviewCount} đánh giá, {seller.Rating:0.0}★).");

        var price = await _config.GetDecimalAsync(ConfigKeys.TrustBadgePrice, 200000m, ct);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        if (user.WalletBalance < price)
            throw new AppException($"Số dư ví không đủ để mua badge Uy tín ({price:N0}đ).");

        user.WalletBalance -= price;
        _db.WalletTxns.Add(new WalletTxn
        {
            UserId = userId, Type = WalletTxnType.Purchase, Amount = -price,
            Status = WalletTxnStatus.Completed, Note = "Mua badge Uy tín (1 năm)",
        });
        var now = DateTime.UtcNow;
        var baseDate = seller.TrustBadgeUntil.HasValue && seller.TrustBadgeUntil.Value > now ? seller.TrustBadgeUntil.Value : now;
        seller.TrustBadgeUntil = baseDate.AddYears(1);
        AddAudit(userId, "Seller", "trust_badge_buy", "Seller", seller.Id.ToString(), price,
            $"Mua badge Uy tín đến {seller.TrustBadgeUntil:yyyy-MM-dd}");
        await _db.SaveChangesAsync(ct);
        return await _plans.GetMyPlanAsync(userId, ct);
    }

    public async Task<SellerOrderLineDto[]> ListMyOrdersAsync(Guid userId, string? status, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var query = _db.OrderLines
            .Include(l => l.Order).ThenInclude(o => o!.Buyer)
            .Where(l => l.SellerId == seller.Id);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OrderStatus>(status, true, out var s))
            query = query.Where(l => l.Order!.Status == s);
        var lines = await query.OrderByDescending(l => l.Order!.CreatedAt).ToListAsync(ct);
        return lines.Select(MapOrderLine).ToArray();
    }

    public async Task<SellerOrderLineDto> DeliverManualAsync(Guid userId, Guid orderLineId, string[] deliveredItems, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var line = await _db.OrderLines.Include(l => l.Order).ThenInclude(o => o!.Buyer)
            .FirstOrDefaultAsync(l => l.Id == orderLineId && l.SellerId == seller.Id, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (line.Order!.Status != OrderStatus.EscrowLocked && line.Order.Status != OrderStatus.Delivering)
            throw new AppException($"Chỉ có thể giao đơn ở trạng thái EscrowLocked/Delivering (hiện {line.Order.Status})");
        if (line.Delivery == DeliveryMethod.Hybrid && Orders.OrderService.IsLineFullyDelivered(line))
            throw new AppException("Dòng này đã được giao đủ từ kho.");

        var clean = (deliveredItems ?? Array.Empty<string>()).Select(x => (x ?? "").Trim()).Where(s => s.Length > 0).ToArray();
        if (clean.Length == 0) throw new AppException("Hãy nhập ít nhất 1 nội dung bàn giao.");

        if (line.Delivery == DeliveryMethod.Hybrid)
        {
            // Gộp phần đã giao tự động từ kho (nếu có) với phần seller giao tay cho đủ số lượng.
            var existing = Orders.OrderService.DeliveredItemCount(line.DeliveredItemsJson) > 0
                ? JsonSerializer.Deserialize<string[]>(line.DeliveredItemsJson!) ?? Array.Empty<string>()
                : Array.Empty<string>();
            line.DeliveredItemsJson = JsonSerializer.Serialize(existing.Concat(clean).ToArray());
        }
        else
        {
            line.DeliveredItemsJson = JsonSerializer.Serialize(clean);
        }

        // Nếu tất cả line đã bàn giao đủ → vào cửa sổ kiểm tra của buyer (Checking)
        var allLines = await _db.OrderLines.Where(l => l.OrderId == line.OrderId).ToListAsync(ct);
        if (allLines.All(Orders.OrderService.IsLineFullyDelivered))
        {
            var releaseDays = await _config.GetIntAsync(ConfigKeys.EscrowReleaseDays, 2, ct);
            line.Order.Status = OrderStatus.Checking;
            line.Order.DeliveredAt = DateTime.UtcNow;
            line.Order.DeliverDueAt = null; // đã giao đúng hạn → bỏ deadline auto-cancel
            line.Order.EscrowReleaseAt = DateTime.UtcNow.AddDays(releaseDays);
        }
        else
        {
            line.Order.Status = OrderStatus.Delivering;
        }
        await _db.SaveChangesAsync(ct);
        return MapOrderLine(line);
    }

    public async Task<SellerInventoryDto> GetInventoryAsync(Guid userId, Guid productId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId && p.SellerId == seller.Id, ct)
            ?? throw new AppException("Không tìm thấy sản phẩm", 404);
        var items = await _db.InventoryItems.Where(i => i.ProductId == productId).OrderByDescending(i => i.CreatedAt).ToListAsync(ct);
        return new SellerInventoryDto(
            product.Id, product.Slug, product.Title,
            items.Count(i => !i.Reserved && !i.Sold),
            items.Count(i => i.Reserved && !i.Sold),
            items.Count(i => i.Sold),
            items.Select(i => new InventoryItemDto(i.Id, MaskPreview(SafeDecrypt(i.EncryptedPayload)), i.Reserved, i.Sold, i.OrderId, i.CreatedAt)).ToArray());
    }

    public async Task<int> UploadInventoryAsync(Guid userId, Guid productId, string[] items, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId && p.SellerId == seller.Id, ct)
            ?? throw new AppException("Không tìm thấy sản phẩm", 404);
        var added = 0;
        var existingHashes = await _db.InventoryItems.Where(i => i.ProductId == productId).Select(i => i.ContentHash).ToListAsync(ct);
        var existingSet = new HashSet<string>(existingHashes);
        foreach (var raw in items)
        {
            var trimmed = (raw ?? "").Trim();
            if (string.IsNullOrEmpty(trimmed)) continue;
            var hash = Sha256(trimmed);
            if (existingSet.Contains(hash)) continue;
            existingSet.Add(hash);
            _db.InventoryItems.Add(new InventoryItem
            {
                ProductId = productId,
                EncryptedPayload = _enc.Encrypt(trimmed), // AES-256-GCM at rest
                ContentHash = hash,                        // hash trên plaintext để dedup
                Reserved = false,
                Sold = false,
            });
            added++;
        }
        await _db.SaveChangesAsync(ct);
        await RecomputeStockAsync(productId, ct);
        return added;
    }

    /// <summary>Sửa nội dung và/hoặc bật-tắt trạng thái "Tạm ẩn" (Reserved) của 1 mục kho. Mục đã giao không sửa được.</summary>
    public async Task<SellerInventoryDto> UpdateInventoryItemAsync(Guid userId, Guid itemId, string? content, bool? reserved, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var item = await _db.InventoryItems.Include(i => i.Product)
            .FirstOrDefaultAsync(i => i.Id == itemId, ct)
            ?? throw new AppException("Không tìm thấy mục kho", 404);
        if (item.Product == null || item.Product.SellerId != seller.Id)
            throw new AppException("Không có quyền thao tác mục kho này", 403);
        if (item.Sold)
            throw new AppException("Mục đã giao cho khách, không thể chỉnh sửa.");

        if (content != null)
        {
            var trimmed = content.Trim();
            if (string.IsNullOrEmpty(trimmed)) throw new AppException("Nội dung không được để trống.");
            item.EncryptedPayload = _enc.Encrypt(trimmed); // AES-256-GCM at rest
            item.ContentHash = Sha256(trimmed);
        }
        if (reserved.HasValue) item.Reserved = reserved.Value;
        item.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await RecomputeStockAsync(item.ProductId, ct);
        return await GetInventoryAsync(userId, item.ProductId, ct);
    }

    /// <summary>Xoá 1 mục kho. Mục đã giao không xoá được (giữ lịch sử bàn giao).</summary>
    public async Task<SellerInventoryDto> DeleteInventoryItemAsync(Guid userId, Guid itemId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var item = await _db.InventoryItems.Include(i => i.Product)
            .FirstOrDefaultAsync(i => i.Id == itemId, ct)
            ?? throw new AppException("Không tìm thấy mục kho", 404);
        if (item.Product == null || item.Product.SellerId != seller.Id)
            throw new AppException("Không có quyền thao tác mục kho này", 403);
        if (item.Sold)
            throw new AppException("Mục đã giao cho khách, không thể xoá.");

        var productId = item.ProductId;
        _db.InventoryItems.Remove(item);
        await _db.SaveChangesAsync(ct);
        await RecomputeStockAsync(productId, ct);
        return await GetInventoryAsync(userId, productId, ct);
    }

    /// <summary>Đồng bộ Stock = số mục "Có sẵn" thật (chưa bán, chưa tạm ẩn) — đúng số có thể bán/giao.</summary>
    private async Task RecomputeStockAsync(Guid productId, CancellationToken ct)
    {
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product == null) return;
        product.Stock = await _db.InventoryItems.CountAsync(i => i.ProductId == productId && !i.Sold && !i.Reserved, ct);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<WithdrawDto> CreateWithdrawAsync(Guid userId, WithdrawCreateDto dto, CancellationToken ct)
    {
        await GetSellerForUserAsync(userId, ct);
        var dashboard = await GetDashboardAsync(userId, ct);
        if (dto.Amount <= 0) throw new AppException("Số tiền không hợp lệ");
        var min = await _config.GetDecimalAsync(ConfigKeys.MinWithdraw, 50_000m, ct);
        var max = await _config.GetDecimalAsync(ConfigKeys.MaxWithdraw, 50_000_000m, ct);
        if (dto.Amount < min) throw new AppException($"Số tiền rút tối thiểu là {min:N0}đ");
        if (dto.Amount > max) throw new AppException($"Số tiền rút tối đa mỗi lần là {max:N0}đ");
        if (dto.Amount > dashboard.AvailableBalance) throw new AppException($"Vượt quá số dư khả dụng ({dashboard.AvailableBalance:N0})");
        await _limits.EnsureWithdrawAllowedAsync(userId, dto.Amount, ct);

        var user = await _db.Users.FindAsync(new object[] { userId }, ct);
        if (user?.TwoFactorEnabled == true)
        {
            if (string.IsNullOrWhiteSpace(dto.TotpCode))
                throw new AppException("Tài khoản đã bật bảo mật 2 lớp. Vui lòng nhập mã xác thực.", 403);
            if (!_totp.Verify(user.TotpSecret!, dto.TotpCode))
                throw new AppException("Mã xác thực 2FA không đúng hoặc đã hết hạn.", 400);
        }
        // Rút về ví nội bộ → xử lý tức thì (tiền vẫn ở trong sàn, không cần admin duyệt).
        var toWallet = string.Equals(dto.Method, "Wallet", StringComparison.OrdinalIgnoreCase);
        var w = new WithdrawRequest
        {
            SellerUserId = userId,
            Amount = dto.Amount,
            Note = dto.Note,
            Status = toWallet ? WithdrawStatus.Paid : WithdrawStatus.Pending,
            ProcessedAt = toWallet ? DateTime.UtcNow : null,
        };

        if (toWallet)
        {
            if (user == null) throw new AppException("User không tồn tại", 404);
            w.Method = "Wallet";
            w.Account = "Ví nội bộ";
            user.WalletBalance += dto.Amount;
            _db.WalletTxns.Add(new WalletTxn
            {
                UserId = userId,
                Type = WalletTxnType.RevenueToWallet,
                Amount = dto.Amount,
                Status = WalletTxnStatus.Completed,
                Note = "Chuyển doanh thu vào ví",
            });
            AddAudit(userId, "Seller", "withdraw_to_wallet", "WithdrawRequest", w.Id.ToString(), dto.Amount,
                $"Rút {dto.Amount:N0}đ doanh thu vào ví nội bộ");
        }
        else
        {
            // Lấy thông tin nhận tiền: ưu tiên tài khoản đã lưu, nếu không thì nhập trực tiếp.
            PayoutDetails d;
            if (dto.PayoutMethodId.HasValue)
            {
                var m = await _db.SellerPayoutMethods.FirstOrDefaultAsync(x => x.Id == dto.PayoutMethodId.Value && x.SellerUserId == userId, ct)
                    ?? throw new AppException("Không tìm thấy tài khoản nhận tiền đã lưu", 404);
                d = new PayoutDetails(m.Type, m.BankBin, m.BankName, m.AccountNumber, m.AccountHolder, m.CryptoNetwork, m.WalletAddress);
            }
            else
            {
                d = ValidateAndNormalizePayout(dto.Method, dto.BankBin, dto.BankName, dto.AccountNumber, dto.AccountHolder, dto.CryptoNetwork, dto.WalletAddress);
            }
            var kycName = await GetKycFullNameAsync(userId, ct);
            w.Method = d.Type;
            w.Account = BuildAccountSummary(d);
            w.BankBin = d.BankBin;
            w.BankName = d.BankName;
            w.AccountNumber = d.AccountNumber;
            w.AccountHolder = d.AccountHolder;
            w.CryptoNetwork = d.CryptoNetwork;
            w.WalletAddress = d.WalletAddress;
            w.HolderMatchesKyc = ComputeHolderMatch(d, kycName);
        }

        _db.WithdrawRequests.Add(w);
        await _db.SaveChangesAsync(ct);
        return MapWithdraw(w);
    }

    public async Task<WithdrawDto[]> ListMyWithdrawsAsync(Guid userId, CancellationToken ct)
    {
        var ws = await _db.WithdrawRequests.Where(w => w.SellerUserId == userId).OrderByDescending(w => w.CreatedAt).ToListAsync(ct);
        return ws.Select(MapWithdraw).ToArray();
    }

    // ── Sổ tài khoản nhận tiền (payout methods) ─────────────────────────────────
    public async Task<PayoutMethodDto[]> ListPayoutMethodsAsync(Guid userId, CancellationToken ct)
    {
        await GetSellerForUserAsync(userId, ct);
        var ms = await _db.SellerPayoutMethods
            .Where(m => m.SellerUserId == userId)
            .OrderByDescending(m => m.IsDefault).ThenByDescending(m => m.CreatedAt)
            .ToListAsync(ct);
        return ms.Select(MapPayoutMethod).ToArray();
    }

    public async Task<PayoutMethodDto> CreatePayoutMethodAsync(Guid userId, PayoutMethodSaveDto dto, CancellationToken ct)
    {
        await GetSellerForUserAsync(userId, ct);
        var d = ValidateAndNormalizePayout(dto.Type, dto.BankBin, dto.BankName, dto.AccountNumber, dto.AccountHolder, dto.CryptoNetwork, dto.WalletAddress);
        var kycName = await GetKycFullNameAsync(userId, ct);
        var existing = await _db.SellerPayoutMethods.Where(x => x.SellerUserId == userId).ToListAsync(ct);
        var makeDefault = dto.IsDefault || existing.Count == 0;
        if (makeDefault) foreach (var e in existing) e.IsDefault = false;
        var m = new SellerPayoutMethod
        {
            SellerUserId = userId,
            Type = d.Type,
            Label = string.IsNullOrWhiteSpace(dto.Label) ? BuildAccountSummary(d) : dto.Label.Trim(),
            BankBin = d.BankBin,
            BankName = d.BankName,
            AccountNumber = d.AccountNumber,
            AccountHolder = d.AccountHolder,
            CryptoNetwork = d.CryptoNetwork,
            WalletAddress = d.WalletAddress,
            IsDefault = makeDefault,
            HolderMatchesKyc = ComputeHolderMatch(d, kycName) ?? false,
        };
        _db.SellerPayoutMethods.Add(m);
        await _db.SaveChangesAsync(ct);
        return MapPayoutMethod(m);
    }

    public async Task<PayoutMethodDto> UpdatePayoutMethodAsync(Guid userId, Guid id, PayoutMethodSaveDto dto, CancellationToken ct)
    {
        await GetSellerForUserAsync(userId, ct);
        var m = await _db.SellerPayoutMethods.FirstOrDefaultAsync(x => x.Id == id && x.SellerUserId == userId, ct)
            ?? throw new AppException("Không tìm thấy tài khoản nhận tiền", 404);
        var d = ValidateAndNormalizePayout(dto.Type, dto.BankBin, dto.BankName, dto.AccountNumber, dto.AccountHolder, dto.CryptoNetwork, dto.WalletAddress);
        var kycName = await GetKycFullNameAsync(userId, ct);
        m.Type = d.Type;
        m.Label = string.IsNullOrWhiteSpace(dto.Label) ? BuildAccountSummary(d) : dto.Label.Trim();
        m.BankBin = d.BankBin;
        m.BankName = d.BankName;
        m.AccountNumber = d.AccountNumber;
        m.AccountHolder = d.AccountHolder;
        m.CryptoNetwork = d.CryptoNetwork;
        m.WalletAddress = d.WalletAddress;
        m.HolderMatchesKyc = ComputeHolderMatch(d, kycName) ?? false;
        m.UpdatedAt = DateTime.UtcNow;
        if (dto.IsDefault && !m.IsDefault)
        {
            foreach (var e in await _db.SellerPayoutMethods.Where(x => x.SellerUserId == userId && x.Id != id).ToListAsync(ct))
                e.IsDefault = false;
            m.IsDefault = true;
        }
        await _db.SaveChangesAsync(ct);
        return MapPayoutMethod(m);
    }

    public async Task DeletePayoutMethodAsync(Guid userId, Guid id, CancellationToken ct)
    {
        await GetSellerForUserAsync(userId, ct);
        var m = await _db.SellerPayoutMethods.FirstOrDefaultAsync(x => x.Id == id && x.SellerUserId == userId, ct)
            ?? throw new AppException("Không tìm thấy tài khoản nhận tiền", 404);
        var wasDefault = m.IsDefault;
        _db.SellerPayoutMethods.Remove(m);
        await _db.SaveChangesAsync(ct);
        // Nếu xoá tài khoản mặc định → đặt cái còn lại mới nhất làm mặc định.
        if (wasDefault)
        {
            var next = await _db.SellerPayoutMethods.Where(x => x.SellerUserId == userId)
                .OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct);
            if (next != null) { next.IsDefault = true; await _db.SaveChangesAsync(ct); }
        }
    }

    public async Task<PayoutMethodDto> SetDefaultPayoutMethodAsync(Guid userId, Guid id, CancellationToken ct)
    {
        await GetSellerForUserAsync(userId, ct);
        var all = await _db.SellerPayoutMethods.Where(x => x.SellerUserId == userId).ToListAsync(ct);
        var m = all.FirstOrDefault(x => x.Id == id) ?? throw new AppException("Không tìm thấy tài khoản nhận tiền", 404);
        foreach (var e in all) e.IsDefault = e.Id == id;
        m.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapPayoutMethod(m);
    }

    private record PayoutDetails(string Type, string? BankBin, string? BankName, string? AccountNumber,
        string? AccountHolder, string? CryptoNetwork, string? WalletAddress);

    /// <summary>Kiểm tra & chuẩn hoá thông tin nhận tiền theo từng phương thức. Ném lỗi nếu thiếu/sai định dạng.</summary>
    private static PayoutDetails ValidateAndNormalizePayout(string? type, string? bankBin, string? bankName,
        string? accountNumber, string? accountHolder, string? network, string? address)
    {
        static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        var t = (type ?? "").Trim();

        if (string.Equals(t, "Bank", StringComparison.OrdinalIgnoreCase))
        {
            var bn = Clean(bankName);
            var num = Clean(accountNumber);
            var holder = Clean(accountHolder);
            if (string.IsNullOrEmpty(bn)) throw new AppException("Vui lòng chọn ngân hàng.");
            if (string.IsNullOrEmpty(num) || !System.Text.RegularExpressions.Regex.IsMatch(num, @"^\d{6,19}$"))
                throw new AppException("Số tài khoản không hợp lệ (6-19 chữ số).");
            if (string.IsNullOrEmpty(holder)) throw new AppException("Vui lòng nhập tên chủ tài khoản.");
            return new PayoutDetails("Bank", Clean(bankBin), bn, num, holder.ToUpperInvariant(), null, null);
        }
        if (string.Equals(t, "Momo", StringComparison.OrdinalIgnoreCase))
        {
            var num = Clean(accountNumber);
            var holder = Clean(accountHolder);
            if (string.IsNullOrEmpty(num) || !System.Text.RegularExpressions.Regex.IsMatch(num, @"^0\d{9}$"))
                throw new AppException("Số điện thoại MoMo không hợp lệ (10 số, bắt đầu bằng 0).");
            if (string.IsNullOrEmpty(holder)) throw new AppException("Vui lòng nhập tên chủ ví MoMo.");
            return new PayoutDetails("Momo", null, null, num, holder.ToUpperInvariant(), null, null);
        }
        if (string.Equals(t, "Usdt", StringComparison.OrdinalIgnoreCase))
        {
            var net = (Clean(network) ?? "TRC20").ToUpperInvariant();
            var addr = Clean(address);
            if (string.IsNullOrEmpty(addr)) throw new AppException("Vui lòng nhập địa chỉ ví USDT.");
            if (net == "TRC20" && !System.Text.RegularExpressions.Regex.IsMatch(addr, @"^T[1-9A-HJ-NP-Za-km-z]{33}$"))
                throw new AppException("Địa chỉ ví TRC20 không hợp lệ (bắt đầu bằng T, dài 34 ký tự).");
            if ((net == "ERC20" || net == "BEP20") && !System.Text.RegularExpressions.Regex.IsMatch(addr, @"^0x[0-9a-fA-F]{40}$"))
                throw new AppException($"Địa chỉ ví {net} không hợp lệ (bắt đầu bằng 0x, dài 42 ký tự).");
            return new PayoutDetails("Usdt", null, null, null, null, net, addr);
        }
        throw new AppException("Phương thức nhận tiền không hợp lệ.");
    }

    private static string BuildAccountSummary(PayoutDetails d) => d.Type switch
    {
        "Bank" => $"{d.BankName} · {d.AccountNumber} · {d.AccountHolder}",
        "Momo" => $"MoMo {d.AccountNumber} · {d.AccountHolder}",
        "Usdt" => $"USDT {d.CryptoNetwork} · {d.WalletAddress}",
        _ => "",
    };

    /// <summary>Đối chiếu tên chủ TK với tên KYC. null = không thể xác minh (USDT, hoặc chưa có tên KYC trên hồ sơ).</summary>
    private static bool? ComputeHolderMatch(PayoutDetails d, string? kycFullName)
    {
        if (d.Type != "Bank" && d.Type != "Momo") return null;
        var holder = NormalizeName(d.AccountHolder);
        var kyc = NormalizeName(kycFullName);
        if (holder.Length == 0 || kyc.Length == 0) return null; // không có tên để so → chưa xác minh
        return holder == kyc;
    }

    /// <summary>Chuẩn hoá tên để so khớp: bỏ dấu, viết hoa, gộp khoảng trắng.</summary>
    private static string NormalizeName(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        var normalized = s.Normalize(System.Text.NormalizationForm.FormD);
        var sb = new System.Text.StringBuilder();
        foreach (var c in normalized)
        {
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        var ascii = sb.ToString().Normalize(System.Text.NormalizationForm.FormC).ToUpperInvariant();
        ascii = System.Text.RegularExpressions.Regex.Replace(ascii, @"[^A-Z0-9]+", " ").Trim();
        return ascii;
    }

    private async Task<string?> GetKycFullNameAsync(Guid userId, CancellationToken ct)
    {
        var kyc = await _db.KycSubmissions
            .Where(k => k.UserId == userId && k.Status == KycStatus.Approved)
            .OrderByDescending(k => k.ReviewedAt ?? k.CreatedAt)
            .FirstOrDefaultAsync(ct);
        return kyc?.FullName;
    }

    private static PayoutMethodDto MapPayoutMethod(SellerPayoutMethod m) => new(
        m.Id, m.Type, m.Label, m.BankBin, m.BankName, m.AccountNumber, m.AccountHolder,
        m.CryptoNetwork, m.WalletAddress, m.IsDefault, m.HolderMatchesKyc, m.CreatedAt);

    private static SellerProductDto MapProduct(Product p, List<InventoryItem> inv) => new(
        p.Id, p.Slug, p.Title, p.CategorySlug, p.Price, p.ComparePrice,
        p.Delivery.ToString(), p.WarrantyDays, p.Stock, p.Sold, p.Rating, p.ReviewCount,
        p.ThumbnailColor, p.ThumbnailIcon, p.ImageUrl, p.Status.ToString(), p.Description,
        inv.Count(i => !i.Reserved && !i.Sold),
        inv.Count(i => i.Reserved && !i.Sold),
        inv.Count(i => i.Sold),
        p.DepositAmount, p.DepositStatus.ToString(), p.BoostedUntil);

    private static SellerOrderLineDto MapOrderLine(OrderLine l)
    {
        string[]? items = null;
        if (!string.IsNullOrWhiteSpace(l.DeliveredItemsJson))
        {
            try { items = JsonSerializer.Deserialize<string[]>(l.DeliveredItemsJson); }
            catch { items = new[] { l.DeliveredItemsJson }; }
        }
        return new SellerOrderLineDto(
            l.OrderId, l.Id, l.Order?.Code ?? "", l.Order?.Status.ToString() ?? "",
            l.ProductId, l.Title, l.Quantity, l.UnitPrice, l.UnitPrice * l.Quantity,
            l.Delivery.ToString(),
            l.Order?.Buyer?.DisplayName ?? "(buyer)",
            l.Order?.CreatedAt ?? DateTime.UtcNow,
            l.Order?.PaidAt, l.Order?.DeliveredAt, l.Order?.CompletedAt,
            items);
    }

    public static WithdrawDto MapWithdraw(WithdrawRequest w) => new(
        w.Id, w.Amount, w.Method, w.Account, w.Status.ToString(), w.Note, w.AdminNote, w.CreatedAt, w.ProcessedAt,
        w.BankName, w.AccountNumber, w.AccountHolder, w.CryptoNetwork, w.WalletAddress, w.HolderMatchesKyc, w.PayoutReference);

    private string SafeDecrypt(string stored)
    {
        try { return _enc.Decrypt(stored); }
        catch { return stored; } // dữ liệu cũ/không giải mã được → giữ nguyên
    }

    private static string MaskPreview(string raw)
    {
        if (string.IsNullOrEmpty(raw)) return "";
        if (raw.Length <= 6) return new string('•', raw.Length);
        return raw[..3] + new string('•', Math.Min(8, raw.Length - 6)) + raw[^3..];
    }

    /// <summary>Kiểm tra ảnh đại diện: cho phép URL http(s) hoặc data URL ảnh base64 (≤2MB). Trả null nếu rỗng.</summary>
    private static string? NormalizeProductImage(string? raw)
    {
        var s = raw?.Trim();
        if (string.IsNullOrEmpty(s)) return null;
        if (s.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            s.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return s;
        if (s.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
        {
            // data URL base64 ~ 4/3 kích thước file. Giới hạn 2MB ảnh => ~2.8MB chuỗi.
            if (s.Length > 2_800_000) throw new AppException("Ảnh quá lớn (tối đa 2MB). Vui lòng chọn ảnh nhỏ hơn.");
            return s;
        }
        throw new AppException("Ảnh không hợp lệ. Chỉ chấp nhận file ảnh hoặc đường dẫn http(s).");
    }

    private static string Sha256(string s)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        return Convert.ToHexString(sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(s))).ToLowerInvariant();
    }

    /// <summary>Cọc đăng tin = % giá (clamp min/max). Trả 0 nếu tắt.</summary>
    private async Task<decimal> ComputeListingDepositAsync(decimal price, CancellationToken ct)
    {
        var enabled = await _config.GetBoolAsync(ConfigKeys.ListingDepositEnabled, false, ct);
        if (!enabled) return 0m;
        var percent = await _config.GetDecimalAsync(ConfigKeys.ListingDepositPercent, 5m, ct);
        var min = await _config.GetDecimalAsync(ConfigKeys.ListingDepositMin, 0m, ct);
        var max = await _config.GetDecimalAsync(ConfigKeys.ListingDepositMax, 0m, ct);
        var deposit = Math.Round(price * percent / 100m, 0, MidpointRounding.AwayFromZero);
        if (min > 0 && deposit < min) deposit = min;
        if (max > 0 && deposit > max) deposit = max;
        return deposit;
    }

    private void AddAudit(Guid? actorId, string actorRole, string action, string entityType, string? entityId, decimal? amount, string? detail)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorId,
            ActorRole = actorRole,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Amount = amount,
            Detail = detail,
        });
    }

    // ── Seller Coupons ────────────────────────────────────────────────────────
    public async Task<SellerCouponDto[]> ListMyCouponsAsync(Guid userId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var coupons = await _db.SellerCoupons
            .Where(c => c.SellerId == seller.Id)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);
        return coupons.Select(MapSellerCoupon).ToArray();
    }

    public async Task<SellerCouponDto> CreateSellerCouponAsync(Guid userId, CreateSellerCouponDto dto, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var code = dto.Code.Trim().ToUpperInvariant();
        if (await _db.SellerCoupons.AnyAsync(c => c.SellerId == seller.Id && c.Code == code, ct))
            throw new AppException("Mã giảm giá này đã tồn tại trong shop của bạn");
        if (!Enum.TryParse<CouponType>(dto.Type, true, out var type))
            throw new AppException("Loại coupon không hợp lệ");
        var coupon = new SellerCoupon
        {
            SellerId = seller.Id, Code = code, Description = dto.Description,
            Type = type, Value = dto.Value, MinOrderAmount = dto.MinOrderAmount,
            MaxDiscount = dto.MaxDiscount, MaxUses = dto.MaxUses, ExpiresAt = dto.ExpiresAt,
        };
        _db.SellerCoupons.Add(coupon);
        await _db.SaveChangesAsync(ct);
        return MapSellerCoupon(coupon);
    }

    public async Task<SellerCouponDto> UpdateSellerCouponAsync(Guid userId, Guid id, UpdateSellerCouponDto dto, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var coupon = await _db.SellerCoupons.FirstOrDefaultAsync(c => c.Id == id && c.SellerId == seller.Id, ct)
            ?? throw new AppException("Không tìm thấy mã giảm giá", 404);
        var code = dto.Code.Trim().ToUpperInvariant();
        if (code != coupon.Code && await _db.SellerCoupons.AnyAsync(c => c.SellerId == seller.Id && c.Code == code, ct))
            throw new AppException("Mã giảm giá này đã tồn tại trong shop của bạn");
        if (!Enum.TryParse<CouponType>(dto.Type, true, out var type))
            throw new AppException("Loại coupon không hợp lệ");
        coupon.Code = code; coupon.Description = dto.Description;
        coupon.Type = type; coupon.Value = dto.Value;
        coupon.MinOrderAmount = dto.MinOrderAmount; coupon.MaxDiscount = dto.MaxDiscount;
        coupon.MaxUses = dto.MaxUses; coupon.ExpiresAt = dto.ExpiresAt;
        coupon.IsActive = dto.IsActive; coupon.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapSellerCoupon(coupon);
    }

    public async Task DeleteSellerCouponAsync(Guid userId, Guid id, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var coupon = await _db.SellerCoupons.FirstOrDefaultAsync(c => c.Id == id && c.SellerId == seller.Id, ct)
            ?? throw new AppException("Không tìm thấy mã giảm giá", 404);
        _db.SellerCoupons.Remove(coupon);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<SellerCouponDto> ToggleSellerCouponAsync(Guid userId, Guid id, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var coupon = await _db.SellerCoupons.FirstOrDefaultAsync(c => c.Id == id && c.SellerId == seller.Id, ct)
            ?? throw new AppException("Không tìm thấy mã giảm giá", 404);
        coupon.IsActive = !coupon.IsActive;
        coupon.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapSellerCoupon(coupon);
    }

    private static SellerCouponDto MapSellerCoupon(SellerCoupon c) =>
        new(c.Id, c.Code, c.Description, c.Type.ToString(), c.Value, c.MinOrderAmount,
            c.MaxDiscount, c.MaxUses, c.UsedCount, c.ExpiresAt, c.IsActive, c.CreatedAt);

    public async Task<SellerReviewDto[]> ListMyReviewsAsync(Guid userId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var productIds = await _db.Products.Where(p => p.SellerId == seller.Id).Select(p => p.Id).ToListAsync(ct);
        var reviews = await _db.Reviews
            .Include(r => r.Product)
            .Include(r => r.User)
            .Where(r => productIds.Contains(r.ProductId))
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);
        return reviews.Select(r => new SellerReviewDto(
            r.Id, r.ProductId, r.Product?.Title ?? "", r.User?.DisplayName ?? "(buyer)",
            r.Rating, r.Comment, r.CreatedAt, r.Reply
        )).ToArray();
    }

    public static string Slugify(string s)
    {
        if (string.IsNullOrEmpty(s)) return Guid.NewGuid().ToString("N")[..8];
        var normalized = s.Normalize(System.Text.NormalizationForm.FormD);
        var sb = new System.Text.StringBuilder();
        foreach (var c in normalized)
        {
            var cat = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
            if (cat != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        var ascii = sb.ToString().Normalize(System.Text.NormalizationForm.FormC).ToLowerInvariant();
        ascii = System.Text.RegularExpressions.Regex.Replace(ascii, @"[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrEmpty(ascii)) ascii = Guid.NewGuid().ToString("N")[..8];
        return ascii;
    }
}
