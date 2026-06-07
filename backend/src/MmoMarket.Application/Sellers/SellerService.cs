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
    string ThumbnailColor, string? ThumbnailIcon, string Status, string Description,
    int InventoryAvailable, int InventoryReserved, int InventorySold,
    decimal DepositAmount, string DepositStatus, DateTime? BoostedUntil);

public record BoostInfoDto(int Quota, int Used, int Remaining, int DurationHours);

public record SellerProductCreateDto(
    string Title, string CategorySlug, decimal Price, decimal? ComparePrice, string Delivery,
    int WarrantyDays, int Stock, string ThumbnailColor, string? ThumbnailIcon, string Description);

public record SellerProductUpdateDto(
    string? Title, string? CategorySlug, decimal? Price, decimal? ComparePrice, string? Delivery,
    int? WarrantyDays, int? Stock, string? ThumbnailColor, string? ThumbnailIcon, string? Description, string? Status);

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

public record WithdrawCreateDto(decimal Amount, string Method, string Account, string? Note, string? TotpCode);
public record WithdrawDto(Guid Id, decimal Amount, string Method, string Account, string Status, string? Note, string? AdminNote, DateTime CreatedAt, DateTime? ProcessedAt);

public record SellerDashboardDto(
    decimal Revenue30d, int Orders30d, int ProductsActive, int ProductsPending,
    int OrdersAwaitingDelivery, int OpenDisputes, int PendingWithdrawals,
    decimal AvailableBalance, int TrustScore);

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
        var withdrawnList = await _db.WithdrawRequests
            .Where(w => w.SellerUserId == userId && (w.Status == WithdrawStatus.Approved || w.Status == WithdrawStatus.Paid))
            .Select(w => w.Amount)
            .ToListAsync(ct);
        var totalWithdrawn = withdrawnList.Sum();
        var available = Math.Max(0m, totalEarned - totalWithdrawn);
        return new SellerDashboardDto(revenue30d, orders30d, prodActive, prodPending, awaiting, openDisputes, pendingWd, available, seller.TrustScore);
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
    public async Task<SellerProductDto> BoostProductAsync(Guid userId, Guid productId, CancellationToken ct)
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
        if (plan.BoostsPerMonth <= 0)
            throw new AppException("Gói hiện tại không có lượt boost. Vui lòng nâng cấp gói.");

        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var used = await _db.BoostLogs.CountAsync(b => b.SellerId == seller.Id && b.CreatedAt >= monthStart, ct);
        if (used >= plan.BoostsPerMonth)
            throw new AppException($"Đã hết lượt boost tháng này ({used}/{plan.BoostsPerMonth}). Nâng cấp gói để có thêm.");

        var hours = await _config.GetIntAsync(ConfigKeys.BoostDurationHours, 24, ct);
        product.BoostedUntil = now.AddHours(hours);
        _db.BoostLogs.Add(new BoostLog { SellerId = seller.Id, ProductId = product.Id });
        AddAudit(userId, "Seller", "product_boost", "Product", product.Slug, null,
            $"Boost sản phẩm {product.Title} trong {hours}h");
        await _db.SaveChangesAsync(ct);
        var inv = await _db.InventoryItems.Where(i => i.ProductId == product.Id).ToListAsync(ct);
        return MapProduct(product, inv);
    }

    public async Task<BoostInfoDto> GetBoostInfoAsync(Guid userId, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var plan = await _plans.ResolvePlanAsync(seller, ct);
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var used = await _db.BoostLogs.CountAsync(b => b.SellerId == seller.Id && b.CreatedAt >= monthStart, ct);
        var hours = await _config.GetIntAsync(ConfigKeys.BoostDurationHours, 24, ct);
        return new BoostInfoDto(plan.BoostsPerMonth, used, Math.Max(0, plan.BoostsPerMonth - used), hours);
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
        line.DeliveredItemsJson = JsonSerializer.Serialize(deliveredItems);
        // Nếu tất cả line đã bàn giao → vào cửa sổ kiểm tra của buyer (Checking)
        var allLines = await _db.OrderLines.Where(l => l.OrderId == line.OrderId).ToListAsync(ct);
        if (allLines.All(l => l.Id == line.Id || !string.IsNullOrWhiteSpace(l.DeliveredItemsJson)))
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
        // Update stock to total available items
        product.Stock = await _db.InventoryItems.CountAsync(i => i.ProductId == productId && !i.Sold, ct) + added;
        await _db.SaveChangesAsync(ct);
        return added;
    }

    public async Task<WithdrawDto> CreateWithdrawAsync(Guid userId, WithdrawCreateDto dto, CancellationToken ct)
    {
        var seller = await GetSellerForUserAsync(userId, ct);
        var dashboard = await GetDashboardAsync(userId, ct);
        if (dto.Amount <= 0) throw new AppException("Số tiền không hợp lệ");
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
        var w = new WithdrawRequest
        {
            SellerUserId = userId,
            Amount = dto.Amount,
            Method = dto.Method,
            Account = dto.Account,
            Note = dto.Note,
            Status = WithdrawStatus.Pending,
        };
        _db.WithdrawRequests.Add(w);
        await _db.SaveChangesAsync(ct);
        return MapWithdraw(w);
    }

    public async Task<WithdrawDto[]> ListMyWithdrawsAsync(Guid userId, CancellationToken ct)
    {
        var ws = await _db.WithdrawRequests.Where(w => w.SellerUserId == userId).OrderByDescending(w => w.CreatedAt).ToListAsync(ct);
        return ws.Select(MapWithdraw).ToArray();
    }

    private static SellerProductDto MapProduct(Product p, List<InventoryItem> inv) => new(
        p.Id, p.Slug, p.Title, p.CategorySlug, p.Price, p.ComparePrice,
        p.Delivery.ToString(), p.WarrantyDays, p.Stock, p.Sold, p.Rating, p.ReviewCount,
        p.ThumbnailColor, p.ThumbnailIcon, p.Status.ToString(), p.Description,
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
        w.Id, w.Amount, w.Method, w.Account, w.Status.ToString(), w.Note, w.AdminNote, w.CreatedAt, w.ProcessedAt);

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
