using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Stats;

public record StatsOverviewDto(
    int TotalProducts,
    int TotalSellers,
    long Gmv30d,
    int Orders30d,
    int TotalCompletedOrders,
    double AvgRating,
    decimal AffiliateTotalPaid,
    int ActiveAffiliates);

/// <summary>Cấu hình số liệu marketing trang chủ (section "MarketingStats" trong appsettings).
/// Mỗi chỉ số hiển thị = Base + PerDay × số_ngày_kể_từ_LaunchDate + số_thật_từ_DB.</summary>
public class MarketingStatsOptions
{
    public DateTime LaunchDate { get; set; } = new(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    public long ProductsBase { get; set; } = 10_000;
    public long ProductsPerDay { get; set; } = 8;
    public long SellersBase { get; set; } = 6_800;
    public long SellersPerDay { get; set; } = 1;
    public long Gmv30dBase { get; set; } = 23_000_000_000;
    public long Gmv30dPerDay { get; set; } = 60_000_000;
    public long Orders30dBase { get; set; } = 8_500;
    public long Orders30dPerDay { get; set; } = 6;
    public long CompletedOrdersBase { get; set; } = 128_000;
    public long CompletedOrdersPerDay { get; set; } = 55;
    public long AffiliatePaidBase { get; set; } = 3_400_000_000;
    public long AffiliatePaidPerDay { get; set; } = 3_500_000;
    public long ActiveAffiliatesBase { get; set; } = 1_800;
    public long ActiveAffiliatesPerDay { get; set; } = 1;
    public double FallbackRating { get; set; } = 4.86;
}

public class StatsService
{
    private readonly IAppDbContext _db;
    private readonly MarketingStatsOptions _mkt;
    public StatsService(IAppDbContext db, MarketingStatsOptions mkt) { _db = db; _mkt = mkt; }

    /// <summary>Thống kê toàn sàn cho trang chủ/banner: mốc nền + tăng dần theo ngày + số thật từ DB.
    /// Các con số chỉ để hiển thị (vanity), KHÔNG dùng cho tính toán nghiệp vụ.</summary>
    public async Task<StatsOverviewDto> GetOverviewAsync(CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-30);
        var days = Math.Max(0, (long)(DateTime.UtcNow - _mkt.LaunchDate).TotalDays);
        long Grow(long baseVal, long perDay) => baseVal + perDay * days;

        // ── Số thật từ DB ──
        var realProducts = await _db.Products.CountAsync(p => p.Status == ProductStatus.Active, ct);
        var realSellers = await _db.Sellers.CountAsync(ct);
        var completed = _db.Orders.Where(o => o.Status == OrderStatus.Completed);
        // SQLite không SUM được decimal server-side -> materialize rồi sum trong bộ nhớ.
        var gmvAmounts = await completed.Where(o => o.CompletedAt >= since).Select(o => o.Total).ToListAsync(ct);
        var realGmv30d = gmvAmounts.Sum();
        var realOrders30d = await completed.CountAsync(o => o.CompletedAt >= since, ct);
        var realCompleted = await completed.CountAsync(ct);
        var ratings = await _db.Products.Where(p => p.ReviewCount > 0).Select(p => p.Rating).ToListAsync(ct);
        var realAvgRating = ratings.Count == 0 ? 0 : Math.Round(ratings.Average(), 2);
        var commissionAmounts = await _db.WalletTxns
            .Where(t => t.Type == WalletTxnType.Commission && t.Status == WalletTxnStatus.Completed)
            .Select(t => t.Amount).ToListAsync(ct);
        var realAffiliatePaid = commissionAmounts.Sum();
        var realActiveAffiliates = await _db.Users
            .Where(u => u.ReferredByUserId != null)
            .Select(u => u.ReferredByUserId)
            .Distinct().CountAsync(ct);

        // ── Số hiển thị = nền + tăng theo ngày + thật ──
        return new StatsOverviewDto(
            TotalProducts: (int)Grow(_mkt.ProductsBase, _mkt.ProductsPerDay) + realProducts,
            TotalSellers: (int)Grow(_mkt.SellersBase, _mkt.SellersPerDay) + realSellers,
            Gmv30d: Grow(_mkt.Gmv30dBase, _mkt.Gmv30dPerDay) + (long)realGmv30d,
            Orders30d: (int)Grow(_mkt.Orders30dBase, _mkt.Orders30dPerDay) + realOrders30d,
            TotalCompletedOrders: (int)Grow(_mkt.CompletedOrdersBase, _mkt.CompletedOrdersPerDay) + realCompleted,
            AvgRating: realAvgRating > 0 ? realAvgRating : _mkt.FallbackRating,
            AffiliateTotalPaid: Grow(_mkt.AffiliatePaidBase, _mkt.AffiliatePaidPerDay) + realAffiliatePaid,
            ActiveAffiliates: (int)Grow(_mkt.ActiveAffiliatesBase, _mkt.ActiveAffiliatesPerDay) + realActiveAffiliates);
    }
}
