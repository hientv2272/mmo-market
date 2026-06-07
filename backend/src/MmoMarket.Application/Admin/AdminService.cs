using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Application.Config;
using MmoMarket.Application.Sellers;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Admin;

public record AdminMetricsDto(
    decimal Gmv,
    decimal Revenue,
    int OrdersCompleted,
    int NewUsers,
    int KycPending,
    int ProductsPending,
    int OpenDisputes,
    int PendingWithdrawals);

public record AdminUserDto(Guid Id, string Email, string Username, string DisplayName, string Role, string AvatarColor, decimal WalletBalance, int LoyaltyPoints, string KycStatus, string? PhoneNumber, DateTime CreatedAt);
public record AdminOrderLineDto(Guid Id, Guid ProductId, string Title, decimal UnitPrice, int Quantity, string Delivery);
public record AdminOrderDto(
    Guid Id, string Code, string Status, string PaymentMethod,
    decimal Subtotal, decimal Discount, decimal Fee, decimal Total,
    string BuyerUsername, string BuyerEmail, string BuyerAvatarColor,
    string? Note, DateTime CreatedAt, DateTime? PaidAt, DateTime? DeliveredAt, DateTime? CompletedAt,
    AdminOrderLineDto[] Lines);
public record AdminProductDto(Guid Id, string Slug, string Title, string CategorySlug, decimal Price, int Stock, int Sold, double Rating, string Status, string SellerUsername, DateTime CreatedAt);
public record AdminWithdrawDto(Guid Id, Guid SellerUserId, string SellerUsername, decimal Amount, string Method, string Account, string Status, string? Note, string? AdminNote, DateTime CreatedAt, DateTime? ProcessedAt);
public record AdminWalletUserDto(Guid Id, string Email, string Username, string DisplayName, string Role, decimal WalletBalance, int LoyaltyPoints, int TxnCount, DateTime CreatedAt);
public record AdminWalletOverview(decimal TotalBalance, int TotalUsers, decimal TotalTopup, decimal TotalSpent, int PendingTopups);
public record AdminTopupDto(decimal Amount, string Note);
public record AdminWalletTxnDto(Guid Id, string Type, string Status, decimal Amount, string Note, DateTime CreatedAt);
public record KvInt(string Key, int Value);
public record KvDecimal(string Key, decimal Value);
public record TopUserDto(string Username, string AvatarColor, decimal Total, int OrderCount);
public record TopProductDto(string Title, int Sold, decimal Price, string SellerUsername);
public record AdminReportDto(
    // Users
    int TotalUsers, int TotalSellers, decimal TotalWalletBalance,
    KvInt[] UserByRole, KvInt[] UserByKyc,
    // Orders
    int TotalOrders, decimal TotalGmv, decimal TotalRevenue,
    KvInt[] OrderByStatus, KvInt[] OrderByPayment, KvDecimal[] RevenueByPayment, TopUserDto[] TopBuyers,
    // Products
    int TotalProducts, int TotalSold,
    KvInt[] ProductByStatus, KvInt[] ProductByCategory, TopProductDto[] TopProducts,
    // Wallet
    decimal TotalTopup, decimal TotalPurchase, decimal TotalRefund, decimal TotalWithdraw,
    // Disputes
    int TotalDisputes, KvInt[] DisputeByStatus
);

public record SystemSettingsDto(
    string SiteName, string SiteDescription, string ContactEmail, string ContactPhone,
    bool MaintenanceMode, string MaintenanceMessage, bool RegistrationEnabled, decimal WelcomeBonus,
    decimal MinWithdraw, decimal MaxWithdraw, int EscrowReleaseDays, int DisputeSlaHours, bool KycRequiredToSell,
    string[] EnabledPayments);

public record FeeConfigDto(decimal FeePercent);
public record FinanceReconciliationDto(
    decimal PlatformRevenue, decimal EscrowHeld, decimal TotalRefunded,
    decimal DepositsHeld, decimal DepositsForfeited,
    decimal TotalTopup, decimal TotalWithdrawn, decimal UserWalletTotal);
public record FeeTierDto(Guid Id, string CategorySlug, decimal MinPrice, decimal? MaxPrice, decimal SellerFeePercent, string? Note);
public record FeeTierUpsertDto(string? CategorySlug, decimal MinPrice, decimal? MaxPrice, decimal SellerFeePercent, string? Note);
public record LoyaltyConfigDto(int PtsPer1000, int SignupBonus, int ReviewBonus, int ReferralBonus, int TierSilver, int TierGold, int TierDiamond);
public record LoyaltyRewardDto(Guid Id, string Title, string Description, int PointsCost, string Type, decimal VoucherAmount, bool IsActive, bool IsComingSoon, int Position, DateTime CreatedAt);
public record CreateLoyaltyRewardDto(string Title, string Description, int PointsCost, string Type, decimal VoucherAmount, bool IsComingSoon, int Position);
public record UpdateLoyaltyRewardDto(string Title, string Description, int PointsCost, string Type, decimal VoucherAmount, bool IsActive, bool IsComingSoon, int Position);

public record BannerDto(Guid Id, string Title, string Subtitle, string? LinkUrl, string BgColor, string TextColor, int Position, bool IsActive, int ClickCount, int ViewCount, string CostModel, decimal Rate, decimal EstimatedCost, DateTime? StartsAt, DateTime? EndsAt, DateTime CreatedAt);
public record CreateBannerDto(string Title, string Subtitle, string? LinkUrl, string BgColor, string TextColor, int Position, DateTime? StartsAt, DateTime? EndsAt, string? CostModel = null, decimal Rate = 0);
public record UpdateBannerDto(string Title, string Subtitle, string? LinkUrl, string BgColor, string TextColor, int Position, bool IsActive, DateTime? StartsAt, DateTime? EndsAt, string? CostModel = null, decimal Rate = 0);

public record FlashSaleDto(Guid Id, string Title, int DiscountPercent, DateTime StartsAt, DateTime EndsAt, string Status, int ProductCount, DateTime CreatedAt);
public record CreateFlashSaleDto(string Title, int DiscountPercent, DateTime StartsAt, DateTime EndsAt);
public record UpdateFlashSaleDto(string Title, int DiscountPercent, DateTime StartsAt, DateTime EndsAt, string Status);

public class AdminService
{
    private readonly IAppDbContext _db;
    private readonly ConfigService _config;
    private readonly Sellers.TrustScoreService _trust;
    public AdminService(IAppDbContext db, ConfigService config, Sellers.TrustScoreService trust)
    { _db = db; _config = config; _trust = trust; }

    public async Task<AdminMetricsDto> GetMetricsAsync(CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-30);
        var gmvTotals = await _db.Orders.Where(o => o.CreatedAt >= since && o.Status != OrderStatus.Cancelled).Select(o => o.Total).ToListAsync(ct);
        var gmv = gmvTotals.Sum();
        // Doanh thu = tổng phí sàn thực thu (Order.Fee đã khóa theo danh mục + gói), bỏ đơn hủy/hoàn/chưa thanh toán.
        var revenueFees = await _db.Orders
            .Where(o => o.CreatedAt >= since
                && o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Refunded && o.Status != OrderStatus.PendingPayment)
            .Select(o => o.Fee)
            .ToListAsync(ct);
        var revenue = revenueFees.Sum();
        var ordersCompleted = await _db.Orders.CountAsync(o => o.Status == OrderStatus.Completed, ct);
        var newUsers = await _db.Users.CountAsync(u => u.CreatedAt >= since, ct);
        var kyc = await _db.KycSubmissions.CountAsync(k => k.Status == KycStatus.Pending, ct);
        var pending = await _db.Products.CountAsync(p => p.Status == ProductStatus.Pending, ct);
        var disputes = await _db.Disputes.CountAsync(d => d.Status == DisputeStatus.Open || d.Status == DisputeStatus.Investigating, ct);
        var pendingWd = await _db.WithdrawRequests.CountAsync(w => w.Status == WithdrawStatus.Pending, ct);
        return new AdminMetricsDto(gmv, revenue, ordersCompleted, newUsers, kyc, pending, disputes, pendingWd);
    }

    // Báo cáo đối soát dòng tiền (P2.5) — ledger đơn + tài khoản logic Platform/Reserve/Escrow.
    public async Task<FinanceReconciliationDto> GetFinanceReconciliationAsync(CancellationToken ct)
    {
        var platformRevenue = (await _db.Orders
            .Where(o => o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Refunded && o.Status != OrderStatus.PendingPayment)
            .Select(o => o.Fee).ToListAsync(ct)).Sum();
        var escrowHeld = (await _db.Orders
            .Where(o => o.Status == OrderStatus.EscrowLocked || o.Status == OrderStatus.Delivering || o.Status == OrderStatus.Checking)
            .Select(o => o.Total).ToListAsync(ct)).Sum();
        var totalRefunded = (await _db.WalletTxns
            .Where(t => t.Type == WalletTxnType.Refund && t.Status == WalletTxnStatus.Completed)
            .Select(t => t.Amount).ToListAsync(ct)).Sum();
        var depositsHeld = (await _db.Products
            .Where(p => p.DepositStatus == ListingDepositStatus.Held)
            .Select(p => p.DepositAmount).ToListAsync(ct)).Sum();
        var depositsForfeited = (await _db.Products
            .Where(p => p.DepositStatus == ListingDepositStatus.Forfeited)
            .Select(p => p.DepositAmount).ToListAsync(ct)).Sum();
        var totalTopup = (await _db.WalletTxns
            .Where(t => t.Type == WalletTxnType.Topup && t.Status == WalletTxnStatus.Completed)
            .Select(t => t.Amount).ToListAsync(ct)).Sum();
        var totalWithdrawn = (await _db.WithdrawRequests
            .Where(w => w.Status == WithdrawStatus.Approved || w.Status == WithdrawStatus.Paid)
            .Select(w => w.Amount).ToListAsync(ct)).Sum();
        var userWalletTotal = (await _db.Users.Select(u => u.WalletBalance).ToListAsync(ct)).Sum();
        return new FinanceReconciliationDto(platformRevenue, escrowHeld, totalRefunded,
            depositsHeld, depositsForfeited, totalTopup, totalWithdrawn, userWalletTotal);
    }

    public async Task<AdminUserDto[]> ListUsersAsync(string? role, string? search, CancellationToken ct)
    {
        var query = _db.Users.AsQueryable();
        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<UserRole>(role, true, out var r))
            query = query.Where(u => u.Role == r);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLowerInvariant();
            query = query.Where(u => u.Email.Contains(s) || u.Username.Contains(s) || u.DisplayName.Contains(s));
        }
        var users = await query.OrderByDescending(u => u.CreatedAt).Take(200).ToListAsync(ct);
        return users.Select(MapUser).ToArray();
    }

    public async Task<AdminUserDto> ChangeRoleAsync(Guid userId, string newRole, CancellationToken ct)
    {
        if (!Enum.TryParse<UserRole>(newRole, true, out var role) || role == UserRole.SuperAdmin)
            throw new AppException("Vai trò không hợp lệ");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        user.Role = role;
        await _db.SaveChangesAsync(ct);
        return MapUser(user);
    }

    private static AdminUserDto MapUser(User u) =>
        new(u.Id, u.Email, u.Username, u.DisplayName, u.Role.ToString(), u.AvatarColor,
            u.WalletBalance, u.LoyaltyPoints, u.KycStatus.ToString(), u.PhoneNumber, u.CreatedAt);

    public async Task<AdminProductDto[]> ListProductsAsync(string? status, CancellationToken ct)
    {
        var query = _db.Products.Include(p => p.Seller).ThenInclude(s => s!.User).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ProductStatus>(status, true, out var st))
            query = query.Where(p => p.Status == st);
        var products = await query.OrderByDescending(p => p.CreatedAt).Take(200).ToListAsync(ct);
        return products.Select(p => new AdminProductDto(
            p.Id, p.Slug, p.Title, p.CategorySlug, p.Price, p.Stock, p.Sold, p.Rating,
            p.Status.ToString(), p.Seller?.Username ?? "", p.CreatedAt)).ToArray();
    }

    public async Task<AdminProductDto> ApproveProductAsync(Guid productId, CancellationToken ct)
    {
        var product = await _db.Products.Include(p => p.Seller).FirstOrDefaultAsync(p => p.Id == productId, ct)
            ?? throw new AppException("Không tìm thấy sản phẩm", 404);
        product.Status = ProductStatus.Active;
        await _db.SaveChangesAsync(ct);
        return new AdminProductDto(product.Id, product.Slug, product.Title, product.CategorySlug, product.Price, product.Stock, product.Sold, product.Rating, product.Status.ToString(), product.Seller?.Username ?? "", product.CreatedAt);
    }

    public async Task<AdminProductDto> RejectProductAsync(Guid productId, string reason, CancellationToken ct)
    {
        var product = await _db.Products.Include(p => p.Seller).FirstOrDefaultAsync(p => p.Id == productId, ct)
            ?? throw new AppException("Không tìm thấy sản phẩm", 404);
        product.Status = ProductStatus.Rejected;
        product.Description = string.IsNullOrEmpty(reason) ? product.Description : $"[REJECTED: {reason}]\n{product.Description}";
        await _db.SaveChangesAsync(ct);
        return new AdminProductDto(product.Id, product.Slug, product.Title, product.CategorySlug, product.Price, product.Stock, product.Sold, product.Rating, product.Status.ToString(), product.Seller?.Username ?? "", product.CreatedAt);
    }

    // Khóa vĩnh viễn sản phẩm vi phạm + trừ trust score seller (P2.6 + P2.1)
    public async Task<AdminProductDto> BanProductAsync(Guid productId, string reason, CancellationToken ct)
    {
        var product = await _db.Products.Include(p => p.Seller).FirstOrDefaultAsync(p => p.Id == productId, ct)
            ?? throw new AppException("Không tìm thấy sản phẩm", 404);
        product.Status = ProductStatus.Banned;
        product.Description = string.IsNullOrEmpty(reason) ? product.Description : $"[BANNED: {reason}]\n{product.Description}";
        _db.AuditLogs.Add(new AuditLog
        {
            ActorRole = "Admin", Action = "product_ban", EntityType = "Product", EntityId = product.Slug,
            Detail = $"Khóa vĩnh viễn sản phẩm {product.Title}. Lý do: {reason}",
        });
        await _trust.OnViolationAsync(product.SellerId, ct);
        await _db.SaveChangesAsync(ct);
        return new AdminProductDto(product.Id, product.Slug, product.Title, product.CategorySlug, product.Price, product.Stock, product.Sold, product.Rating, product.Status.ToString(), product.Seller?.Username ?? "", product.CreatedAt);
    }

    public async Task<AdminWithdrawDto[]> ListWithdrawalsAsync(string? status, CancellationToken ct)
    {
        var query = _db.WithdrawRequests.Include(w => w.SellerUser).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<WithdrawStatus>(status, true, out var s))
            query = query.Where(w => w.Status == s);
        var ws = await query.OrderByDescending(w => w.CreatedAt).Take(200).ToListAsync(ct);
        return ws.Select(w => new AdminWithdrawDto(
            w.Id, w.SellerUserId, w.SellerUser?.Username ?? "", w.Amount, w.Method, w.Account,
            w.Status.ToString(), w.Note, w.AdminNote, w.CreatedAt, w.ProcessedAt)).ToArray();
    }

    public async Task<AdminWithdrawDto> ProcessWithdrawAsync(Guid id, bool approve, string? adminNote, CancellationToken ct)
    {
        var w = await _db.WithdrawRequests.Include(x => x.SellerUser).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new AppException("Không tìm thấy yêu cầu", 404);
        if (w.Status != WithdrawStatus.Pending) throw new AppException("Yêu cầu đã xử lý");
        w.Status = approve ? WithdrawStatus.Paid : WithdrawStatus.Rejected;
        w.AdminNote = adminNote;
        w.ProcessedAt = DateTime.UtcNow;
        if (approve)
        {
            _db.WalletTxns.Add(new WalletTxn
            {
                UserId = w.SellerUserId,
                Type = WalletTxnType.Withdraw,
                Amount = -w.Amount,
                Status = WalletTxnStatus.Completed,
                Note = $"Rút tiền — {w.Method} {w.Account}",
            });
        }
        await _db.SaveChangesAsync(ct);
        return new AdminWithdrawDto(w.Id, w.SellerUserId, w.SellerUser?.Username ?? "", w.Amount, w.Method, w.Account, w.Status.ToString(), w.Note, w.AdminNote, w.CreatedAt, w.ProcessedAt);
    }

    public async Task<AdminWalletOverview> GetWalletOverviewAsync(CancellationToken ct)
    {
        var balanceList = await _db.Users.Select(u => u.WalletBalance).ToListAsync(ct);
        var totalBalance = balanceList.Sum();
        var totalUsers = await _db.Users.CountAsync(u => u.WalletBalance > 0, ct);
        var topupList = await _db.WalletTxns
            .Where(t => t.Type == WalletTxnType.Topup && t.Status == WalletTxnStatus.Completed)
            .Select(t => t.Amount).ToListAsync(ct);
        var totalTopup = topupList.Sum();
        var spentList = await _db.WalletTxns
            .Where(t => t.Type == WalletTxnType.Purchase && t.Status == WalletTxnStatus.Completed)
            .Select(t => t.Amount).ToListAsync(ct);
        var totalSpent = spentList.Sum();
        var pendingTopups = await _db.WalletTxns
            .CountAsync(t => t.Type == WalletTxnType.Topup && t.Status == WalletTxnStatus.Pending, ct);
        return new AdminWalletOverview(totalBalance, totalUsers, totalTopup, Math.Abs(totalSpent), pendingTopups);
    }

    public async Task<AdminWalletUserDto[]> ListWalletUsersAsync(string? search, CancellationToken ct)
    {
        var query = _db.Users.AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(u => u.Username.Contains(search) || u.Email.Contains(search) || u.DisplayName.Contains(search));
        var allUsers = await query.ToListAsync(ct);
        var users = allUsers.OrderByDescending(u => u.WalletBalance).Take(200).ToList();
        var userIds = users.Select(u => u.Id).ToList();
        var txnCounts = await _db.WalletTxns
            .Where(t => userIds.Contains(t.UserId))
            .GroupBy(t => t.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var countMap = txnCounts.ToDictionary(x => x.UserId, x => x.Count);
        return users.Select(u => new AdminWalletUserDto(
            u.Id, u.Email, u.Username, u.DisplayName, u.Role.ToString(),
            u.WalletBalance, u.LoyaltyPoints,
            countMap.GetValueOrDefault(u.Id, 0), u.CreatedAt)).ToArray();
    }

    public async Task<AdminWalletTxnDto[]> GetUserTransactionsAsync(Guid userId, CancellationToken ct)
    {
        var txns = await _db.WalletTxns
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(100)
            .ToListAsync(ct);
        return txns.Select(t => new AdminWalletTxnDto(
            t.Id, t.Type.ToString(), t.Status.ToString(), t.Amount, t.Note, t.CreatedAt)).ToArray();
    }

    public async Task<AdminWalletUserDto> AdminTopupAsync(Guid userId, AdminTopupDto dto, CancellationToken ct)
    {
        if (dto.Amount <= 0) throw new AppException("Số tiền không hợp lệ");
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("Không tìm thấy user", 404);
        user.WalletBalance += dto.Amount;
        _db.WalletTxns.Add(new WalletTxn
        {
            UserId = userId,
            Type = WalletTxnType.Topup,
            Amount = dto.Amount,
            Status = WalletTxnStatus.Completed,
            Note = string.IsNullOrWhiteSpace(dto.Note) ? "Admin nạp tiền" : dto.Note,
        });
        await _db.SaveChangesAsync(ct);
        var txnCount = await _db.WalletTxns.CountAsync(t => t.UserId == userId, ct);
        return new AdminWalletUserDto(user.Id, user.Email, user.Username, user.DisplayName, user.Role.ToString(), user.WalletBalance, user.LoyaltyPoints, txnCount, user.CreatedAt);
    }

    // ── Orders ────────────────────────────────────────────────────────────────

    public async Task<AdminOrderDto[]> GetAllOrdersAsync(string? status, string? search, CancellationToken ct)
    {
        var query = _db.Orders
            .Include(o => o.Buyer)
            .Include(o => o.Lines)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OrderStatus>(status, true, out var s))
            query = query.Where(o => o.Status == s);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.Trim().ToLowerInvariant();
            query = query.Where(o =>
                o.Code.Contains(q) ||
                (o.Buyer != null && (o.Buyer.Username.Contains(q) || o.Buyer.Email.Contains(q))));
        }

        var orders = await query
            .OrderByDescending(o => o.CreatedAt)
            .Take(300)
            .ToListAsync(ct);

        return orders.Select(MapOrder).ToArray();
    }

    public async Task<AdminOrderDto> UpdateOrderStatusAsync(Guid orderId, string newStatus, CancellationToken ct)
    {
        if (!Enum.TryParse<OrderStatus>(newStatus, true, out var status))
            throw new AppException("Trạng thái không hợp lệ");

        var order = await _db.Orders
            .Include(o => o.Buyer)
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct)
            ?? throw new AppException("Không tìm thấy đơn hàng", 404);

        var prev = order.Status;
        order.Status = status;

        if (status == OrderStatus.Completed && order.CompletedAt == null)
            order.CompletedAt = DateTime.UtcNow;
        if (status == OrderStatus.Cancelled || status == OrderStatus.Refunded)
        {
            // Refund to wallet if paid via wallet
            if (order.Buyer != null && prev >= OrderStatus.EscrowLocked && order.PaymentMethod == PaymentMethod.Wallet)
            {
                order.Buyer.WalletBalance += order.Total;
                _db.WalletTxns.Add(new WalletTxn
                {
                    UserId = order.Buyer.Id,
                    Type = WalletTxnType.Refund,
                    Amount = order.Total,
                    Status = WalletTxnStatus.Completed,
                    Note = $"Hoàn tiền đơn {order.Code} (admin)",
                    OrderId = order.Id,
                });
            }
        }

        await _db.SaveChangesAsync(ct);
        return MapOrder(order);
    }

    // ── Reports ───────────────────────────────────────────────────────────────

    public async Task<AdminReportDto> GetReportsAsync(CancellationToken ct)
    {
        // Users
        var users = await _db.Users.ToListAsync(ct);
        var userByRole   = users.GroupBy(u => u.Role.ToString())
            .Select(g => new KvInt(g.Key, g.Count())).ToArray();
        var userByKyc    = users.GroupBy(u => u.KycStatus.ToString())
            .Select(g => new KvInt(g.Key, g.Count())).ToArray();
        var totalWalletBalance = users.Sum(u => u.WalletBalance);

        // Orders
        var orders = await _db.Orders.Include(o => o.Buyer).Include(o => o.Lines).ToListAsync(ct);
        var totalGmv       = orders.Where(o => o.Status != OrderStatus.Cancelled).Sum(o => o.Total);
        // Doanh thu = tổng phí sàn thực thu (Order.Fee theo danh mục + gói), bỏ đơn hủy/hoàn/chưa thanh toán.
        var totalRevenue   = orders
            .Where(o => o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Refunded && o.Status != OrderStatus.PendingPayment)
            .Sum(o => o.Fee);
        var orderByStatus  = orders.GroupBy(o => o.Status.ToString())
            .Select(g => new KvInt(g.Key, g.Count())).ToArray();
        var orderByPayment = orders.GroupBy(o => o.PaymentMethod.ToString())
            .Select(g => new KvInt(g.Key, g.Count())).ToArray();
        var revenueByPayment = orders
            .Where(o => o.Status != OrderStatus.Cancelled && o.Status != OrderStatus.Refunded)
            .GroupBy(o => o.PaymentMethod.ToString())
            .Select(g => new KvDecimal(g.Key, g.Sum(o => o.Total))).ToArray();

        // Top buyers (by spend)
        var topBuyers = orders
            .Where(o => o.Status == OrderStatus.Completed || o.Status == OrderStatus.Checking)
            .GroupBy(o => new { o.BuyerId, Username = o.Buyer?.Username ?? "", AvatarColor = o.Buyer?.AvatarColor ?? "#7c3aed" })
            .Select(g => new TopUserDto(g.Key.Username, g.Key.AvatarColor, g.Sum(o => o.Total), g.Count()))
            .OrderByDescending(x => x.Total)
            .Take(10).ToArray();

        // Products
        var products = await _db.Products.Include(p => p.Seller).ToListAsync(ct);
        var productByStatus   = products.GroupBy(p => p.Status.ToString())
            .Select(g => new KvInt(g.Key, g.Count())).ToArray();
        var productByCategory = products.GroupBy(p => p.CategorySlug)
            .Select(g => new KvInt(g.Key, g.Count())).ToArray();
        var topProducts = products
            .OrderByDescending(p => p.Sold)
            .Take(10)
            .Select(p => new TopProductDto(p.Title, p.Sold, p.Price, p.Seller?.Username ?? ""))
            .ToArray();

        // Wallet transactions
        var txns = await _db.WalletTxns.Where(t => t.Status == WalletTxnStatus.Completed).ToListAsync(ct);
        var totalTopup     = txns.Where(t => t.Type == WalletTxnType.Topup).Sum(t => t.Amount);
        var totalPurchase  = txns.Where(t => t.Type == WalletTxnType.Purchase).Sum(t => Math.Abs(t.Amount));
        var totalRefund    = txns.Where(t => t.Type == WalletTxnType.Refund).Sum(t => t.Amount);
        var totalWithdraw  = txns.Where(t => t.Type == WalletTxnType.Withdraw).Sum(t => Math.Abs(t.Amount));

        // Disputes
        var disputes = await _db.Disputes.ToListAsync(ct);
        var disputeByStatus = disputes.GroupBy(d => d.Status.ToString())
            .Select(g => new KvInt(g.Key, g.Count())).ToArray();

        return new AdminReportDto(
            // Users
            users.Count, users.Count(u => u.Role == UserRole.Seller), totalWalletBalance,
            userByRole, userByKyc,
            // Orders
            orders.Count, totalGmv, totalRevenue,
            orderByStatus, orderByPayment, revenueByPayment, topBuyers,
            // Products
            products.Count, products.Sum(p => p.Sold),
            productByStatus, productByCategory, topProducts,
            // Wallet
            totalTopup, totalPurchase, totalRefund, totalWithdraw,
            // Disputes
            disputes.Count, disputeByStatus
        );
    }

    private static AdminOrderDto MapOrder(Order o) => new(
        o.Id, o.Code, o.Status.ToString(), o.PaymentMethod.ToString(),
        o.Subtotal, o.Discount, o.Fee, o.Total,
        o.Buyer?.Username ?? "", o.Buyer?.Email ?? "", o.Buyer?.AvatarColor ?? "#7c3aed",
        o.Note, o.CreatedAt, o.PaidAt, o.DeliveredAt, o.CompletedAt,
        o.Lines.Select(l => new AdminOrderLineDto(l.Id, l.ProductId, l.Title, l.UnitPrice, l.Quantity, l.Delivery.ToString())).ToArray());

    // ── Banners ──────────────────────────────────────────────────────────────
    public async Task<BannerDto[]> ListBannersAsync(CancellationToken ct)
    {
        var banners = await _db.Banners.OrderBy(b => b.Position).ThenBy(b => b.CreatedAt).ToListAsync(ct);
        return banners.Select(MapBanner).ToArray();
    }

    public async Task<BannerDto> CreateBannerAsync(CreateBannerDto dto, CancellationToken ct)
    {
        var banner = new Banner
        {
            Title = dto.Title, Subtitle = dto.Subtitle, LinkUrl = dto.LinkUrl,
            BgColor = dto.BgColor, TextColor = dto.TextColor,
            Position = dto.Position, StartsAt = dto.StartsAt, EndsAt = dto.EndsAt,
            CostModel = NormalizeCostModel(dto.CostModel), Rate = Math.Max(0m, dto.Rate),
        };
        _db.Banners.Add(banner);
        await _db.SaveChangesAsync(ct);
        return MapBanner(banner);
    }

    public async Task<BannerDto> UpdateBannerAsync(Guid id, UpdateBannerDto dto, CancellationToken ct)
    {
        var banner = await _db.Banners.FirstOrDefaultAsync(b => b.Id == id, ct)
            ?? throw new InvalidOperationException("Banner not found");
        banner.Title = dto.Title; banner.Subtitle = dto.Subtitle; banner.LinkUrl = dto.LinkUrl;
        banner.BgColor = dto.BgColor; banner.TextColor = dto.TextColor;
        banner.Position = dto.Position; banner.IsActive = dto.IsActive;
        banner.StartsAt = dto.StartsAt; banner.EndsAt = dto.EndsAt;
        banner.CostModel = NormalizeCostModel(dto.CostModel); banner.Rate = Math.Max(0m, dto.Rate);
        banner.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapBanner(banner);
    }

    public async Task IncrementBannerViewAsync(Guid id, CancellationToken ct)
    {
        var banner = await _db.Banners.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (banner == null) return;
        banner.ViewCount++;
        await _db.SaveChangesAsync(ct);
    }

    public async Task IncrementBannerClickAsync(Guid id, CancellationToken ct)
    {
        var banner = await _db.Banners.FirstOrDefaultAsync(b => b.Id == id, ct);
        if (banner == null) return;
        banner.ClickCount++;
        await _db.SaveChangesAsync(ct);
    }

    private static string NormalizeCostModel(string? m)
    {
        m = (m ?? "none").Trim().ToLowerInvariant();
        return m is "cpm" or "cpc" ? m : "none";
    }

    public async Task DeleteBannerAsync(Guid id, CancellationToken ct)
    {
        var banner = await _db.Banners.FirstOrDefaultAsync(b => b.Id == id, ct)
            ?? throw new InvalidOperationException("Banner not found");
        _db.Banners.Remove(banner);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<BannerDto> ToggleBannerAsync(Guid id, CancellationToken ct)
    {
        var banner = await _db.Banners.FirstOrDefaultAsync(b => b.Id == id, ct)
            ?? throw new InvalidOperationException("Banner not found");
        banner.IsActive = !banner.IsActive;
        banner.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapBanner(banner);
    }

    private static BannerDto MapBanner(Banner b)
    {
        var estCost = b.CostModel switch
        {
            "cpm" => Math.Round(b.ViewCount / 1000m * b.Rate, 0, MidpointRounding.AwayFromZero),
            "cpc" => b.ClickCount * b.Rate,
            _ => 0m,
        };
        return new(b.Id, b.Title, b.Subtitle, b.LinkUrl, b.BgColor, b.TextColor, b.Position, b.IsActive,
            b.ClickCount, b.ViewCount, b.CostModel, b.Rate, estCost, b.StartsAt, b.EndsAt, b.CreatedAt);
    }

    // ── Flash Sales ───────────────────────────────────────────────────────────
    public async Task<FlashSaleDto[]> ListFlashSalesAsync(CancellationToken ct)
    {
        var sales = await _db.FlashSales.OrderByDescending(f => f.CreatedAt).ToListAsync(ct);
        var now = DateTime.UtcNow;
        var changed = false;
        foreach (var s in sales)
        {
            if (s.Status == "Active" && now > s.EndsAt) { s.Status = "Ended"; changed = true; }
            else if (s.Status == "Draft" && now >= s.StartsAt && now <= s.EndsAt) { s.Status = "Active"; changed = true; }
        }
        if (changed) await _db.SaveChangesAsync(ct);
        return sales.Select(MapFlashSale).ToArray();
    }

    public async Task<FlashSaleDto> CreateFlashSaleAsync(CreateFlashSaleDto dto, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var status = now >= dto.StartsAt && now <= dto.EndsAt ? "Active" : "Draft";
        var sale = new FlashSale
        {
            Title = dto.Title, DiscountPercent = dto.DiscountPercent,
            StartsAt = dto.StartsAt, EndsAt = dto.EndsAt, Status = status,
        };
        _db.FlashSales.Add(sale);
        await _db.SaveChangesAsync(ct);
        return MapFlashSale(sale);
    }

    public async Task<FlashSaleDto> UpdateFlashSaleAsync(Guid id, UpdateFlashSaleDto dto, CancellationToken ct)
    {
        var sale = await _db.FlashSales.FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw new InvalidOperationException("Flash sale not found");
        sale.Title = dto.Title; sale.DiscountPercent = dto.DiscountPercent;
        sale.StartsAt = dto.StartsAt; sale.EndsAt = dto.EndsAt;
        sale.Status = dto.Status; sale.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapFlashSale(sale);
    }

    public async Task DeleteFlashSaleAsync(Guid id, CancellationToken ct)
    {
        var sale = await _db.FlashSales.FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw new InvalidOperationException("Flash sale not found");
        _db.FlashSales.Remove(sale);
        await _db.SaveChangesAsync(ct);
    }

    private static FlashSaleDto MapFlashSale(FlashSale f) =>
        new(f.Id, f.Title, f.DiscountPercent, f.StartsAt, f.EndsAt, f.Status, f.ProductCount, f.CreatedAt);

    // ── Fee & Loyalty Config ──────────────────────────────────────────────────
    public async Task<FeeConfigDto> GetFeeConfigAsync(CancellationToken ct)
    {
        var rate = await _config.GetDecimalAsync(ConfigKeys.FeeRate, 0.05m, ct);
        return new FeeConfigDto(rate * 100);
    }

    public async Task<FeeConfigDto> SetFeeRateAsync(decimal percent, CancellationToken ct)
    {
        var rate = Math.Clamp(percent, 0m, 50m) / 100m;
        await _config.SetAsync(ConfigKeys.FeeRate, rate.ToString("F4", System.Globalization.CultureInfo.InvariantCulture), ct);
        return new FeeConfigDto(percent);
    }

    // ── Fee config theo danh mục (P1.1) ───────────────────────────────────────
    public async Task<FeeTierDto[]> ListFeeTiersAsync(CancellationToken ct)
    {
        var list = await _db.FeeConfigs.OrderBy(f => f.CategorySlug).ThenBy(f => f.MinPrice).ToListAsync(ct);
        return list.Select(MapFeeTier).ToArray();
    }

    public async Task<FeeTierDto> CreateFeeTierAsync(FeeTierUpsertDto dto, CancellationToken ct)
    {
        var fc = new FeeConfig
        {
            CategorySlug = (dto.CategorySlug ?? "").Trim(),
            MinPrice = Math.Max(0m, dto.MinPrice),
            MaxPrice = dto.MaxPrice,
            SellerFeePercent = Math.Clamp(dto.SellerFeePercent, 0m, 50m),
            Note = dto.Note,
        };
        _db.FeeConfigs.Add(fc);
        await _db.SaveChangesAsync(ct);
        return MapFeeTier(fc);
    }

    public async Task<FeeTierDto> UpdateFeeTierAsync(Guid id, FeeTierUpsertDto dto, CancellationToken ct)
    {
        var fc = await _db.FeeConfigs.FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw new AppException("Không tìm thấy cấu hình phí", 404);
        fc.CategorySlug = (dto.CategorySlug ?? "").Trim();
        fc.MinPrice = Math.Max(0m, dto.MinPrice);
        fc.MaxPrice = dto.MaxPrice;
        fc.SellerFeePercent = Math.Clamp(dto.SellerFeePercent, 0m, 50m);
        fc.Note = dto.Note;
        await _db.SaveChangesAsync(ct);
        return MapFeeTier(fc);
    }

    public async Task DeleteFeeTierAsync(Guid id, CancellationToken ct)
    {
        var fc = await _db.FeeConfigs.FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw new AppException("Không tìm thấy cấu hình phí", 404);
        _db.FeeConfigs.Remove(fc);
        await _db.SaveChangesAsync(ct);
    }

    private static FeeTierDto MapFeeTier(FeeConfig f) =>
        new(f.Id, f.CategorySlug, f.MinPrice, f.MaxPrice, f.SellerFeePercent, f.Note);

    public async Task<LoyaltyConfigDto> GetLoyaltyConfigAsync(CancellationToken ct)
    {
        var all = await _config.GetAllAsync(ct);
        static int G(Dictionary<string, string> d, string k, int def) =>
            d.TryGetValue(k, out var v) && int.TryParse(v, out var i) ? i : def;
        return new LoyaltyConfigDto(
            G(all, ConfigKeys.LoyaltyPtsPer1000,   1),
            G(all, ConfigKeys.LoyaltySignupBonus,   100),
            G(all, ConfigKeys.LoyaltyReviewBonus,   50),
            G(all, ConfigKeys.LoyaltyReferralBonus, 200),
            G(all, ConfigKeys.LoyaltyTierSilver,    1000),
            G(all, ConfigKeys.LoyaltyTierGold,      5000),
            G(all, ConfigKeys.LoyaltyTierDiamond,   15000)
        );
    }

    public async Task<LoyaltyConfigDto> SetLoyaltyConfigAsync(LoyaltyConfigDto dto, CancellationToken ct)
    {
        await _config.SetAsync(ConfigKeys.LoyaltyPtsPer1000,   dto.PtsPer1000.ToString(),   ct);
        await _config.SetAsync(ConfigKeys.LoyaltySignupBonus,   dto.SignupBonus.ToString(),  ct);
        await _config.SetAsync(ConfigKeys.LoyaltyReviewBonus,   dto.ReviewBonus.ToString(),  ct);
        await _config.SetAsync(ConfigKeys.LoyaltyReferralBonus, dto.ReferralBonus.ToString(),ct);
        await _config.SetAsync(ConfigKeys.LoyaltyTierSilver,    dto.TierSilver.ToString(),   ct);
        await _config.SetAsync(ConfigKeys.LoyaltyTierGold,      dto.TierGold.ToString(),     ct);
        await _config.SetAsync(ConfigKeys.LoyaltyTierDiamond,   dto.TierDiamond.ToString(),  ct);
        return dto;
    }

    // ── Loyalty Rewards ───────────────────────────────────────────────────────
    public async Task<LoyaltyRewardDto[]> ListLoyaltyRewardsAsync(CancellationToken ct)
    {
        var rewards = await _db.LoyaltyRewards.OrderBy(r => r.Position).ThenBy(r => r.PointsCost).ToListAsync(ct);
        return rewards.Select(MapReward).ToArray();
    }

    public async Task<LoyaltyRewardDto> CreateLoyaltyRewardAsync(CreateLoyaltyRewardDto dto, CancellationToken ct)
    {
        var reward = new LoyaltyReward
        {
            Title = dto.Title, Description = dto.Description, PointsCost = dto.PointsCost,
            Type = dto.Type, VoucherAmount = dto.VoucherAmount,
            IsComingSoon = dto.IsComingSoon, Position = dto.Position,
        };
        _db.LoyaltyRewards.Add(reward);
        await _db.SaveChangesAsync(ct);
        return MapReward(reward);
    }

    public async Task<LoyaltyRewardDto> UpdateLoyaltyRewardAsync(Guid id, UpdateLoyaltyRewardDto dto, CancellationToken ct)
    {
        var reward = await _db.LoyaltyRewards.FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new InvalidOperationException("Reward not found");
        reward.Title = dto.Title; reward.Description = dto.Description;
        reward.PointsCost = dto.PointsCost; reward.Type = dto.Type;
        reward.VoucherAmount = dto.VoucherAmount; reward.IsActive = dto.IsActive;
        reward.IsComingSoon = dto.IsComingSoon; reward.Position = dto.Position;
        reward.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapReward(reward);
    }

    public async Task DeleteLoyaltyRewardAsync(Guid id, CancellationToken ct)
    {
        var reward = await _db.LoyaltyRewards.FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new InvalidOperationException("Reward not found");
        _db.LoyaltyRewards.Remove(reward);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<LoyaltyRewardDto> ToggleLoyaltyRewardAsync(Guid id, CancellationToken ct)
    {
        var reward = await _db.LoyaltyRewards.FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new InvalidOperationException("Reward not found");
        reward.IsActive = !reward.IsActive;
        reward.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return MapReward(reward);
    }

    private static LoyaltyRewardDto MapReward(LoyaltyReward r) =>
        new(r.Id, r.Title, r.Description, r.PointsCost, r.Type, r.VoucherAmount, r.IsActive, r.IsComingSoon, r.Position, r.CreatedAt);

    // ── System Settings ───────────────────────────────────────────────────────
    public async Task<SystemSettingsDto> GetSystemSettingsAsync(CancellationToken ct)
    {
        var all = await _config.GetAllAsync(ct);
        static string G(Dictionary<string, string> d, string k, string def) =>
            d.TryGetValue(k, out var v) ? v : def;
        static bool B(Dictionary<string, string> d, string k, bool def) =>
            d.TryGetValue(k, out var v) ? v == "true" : def;
        static decimal D(Dictionary<string, string> d, string k, decimal def) =>
            d.TryGetValue(k, out var v) && decimal.TryParse(v, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var r) ? r : def;
        static int I(Dictionary<string, string> d, string k, int def) =>
            d.TryGetValue(k, out var v) && int.TryParse(v, out var r) ? r : def;

        var payments = G(all, ConfigKeys.EnabledPayments, "Wallet,VietQr,Momo,ZaloPay,VnPay");
        return new SystemSettingsDto(
            G(all, ConfigKeys.SiteName,         "MMO Market"),
            G(all, ConfigKeys.SiteDescription,  "Sàn giao dịch tài khoản MMO uy tín"),
            G(all, ConfigKeys.ContactEmail,      "support@mmomarket.vn"),
            G(all, ConfigKeys.ContactPhone,      ""),
            B(all, ConfigKeys.MaintenanceMode,   false),
            G(all, ConfigKeys.MaintenanceMessage,"Hệ thống đang bảo trì, vui lòng quay lại sau."),
            B(all, ConfigKeys.RegistrationEnabled, true),
            D(all, ConfigKeys.WelcomeBonus,      100_000m),
            D(all, ConfigKeys.MinWithdraw,       50_000m),
            D(all, ConfigKeys.MaxWithdraw,       50_000_000m),
            I(all, ConfigKeys.EscrowReleaseDays, 3),
            I(all, ConfigKeys.DisputeSlaHours,   72),
            B(all, ConfigKeys.KycRequiredToSell, true),
            payments.Split(',', StringSplitOptions.RemoveEmptyEntries)
        );
    }

    public async Task<SystemSettingsDto> SetSystemSettingsAsync(SystemSettingsDto dto, CancellationToken ct)
    {
        await _config.SetBatchAsync(new Dictionary<string, string>
        {
            [ConfigKeys.SiteName]           = dto.SiteName,
            [ConfigKeys.SiteDescription]    = dto.SiteDescription,
            [ConfigKeys.ContactEmail]       = dto.ContactEmail,
            [ConfigKeys.ContactPhone]       = dto.ContactPhone,
            [ConfigKeys.MaintenanceMode]    = dto.MaintenanceMode.ToString().ToLowerInvariant(),
            [ConfigKeys.MaintenanceMessage] = dto.MaintenanceMessage,
            [ConfigKeys.RegistrationEnabled]= dto.RegistrationEnabled.ToString().ToLowerInvariant(),
            [ConfigKeys.WelcomeBonus]       = dto.WelcomeBonus.ToString(System.Globalization.CultureInfo.InvariantCulture),
            [ConfigKeys.MinWithdraw]        = dto.MinWithdraw.ToString(System.Globalization.CultureInfo.InvariantCulture),
            [ConfigKeys.MaxWithdraw]        = dto.MaxWithdraw.ToString(System.Globalization.CultureInfo.InvariantCulture),
            [ConfigKeys.EscrowReleaseDays]  = dto.EscrowReleaseDays.ToString(),
            [ConfigKeys.DisputeSlaHours]    = dto.DisputeSlaHours.ToString(),
            [ConfigKeys.KycRequiredToSell]  = dto.KycRequiredToSell.ToString().ToLowerInvariant(),
            [ConfigKeys.EnabledPayments]    = string.Join(",", dto.EnabledPayments),
        }, ct);
        return dto;
    }
}
