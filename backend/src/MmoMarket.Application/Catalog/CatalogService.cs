using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Domain.Entities;

namespace MmoMarket.Application.Catalog;

public class CatalogService
{
    private readonly IAppDbContext _db;
    public CatalogService(IAppDbContext db) => _db = db;

    public async Task<CategoryDto[]> GetCategoriesAsync(CancellationToken ct)
    {
        var categories = await _db.Categories.OrderBy(c => c.Position).ToListAsync(ct);
        var counts = await _db.Products
            .GroupBy(p => p.CategorySlug)
            .Select(g => new { Slug = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Slug, x => x.Count, ct);
        return categories.Select(c => new CategoryDto(c.Slug, c.Name, c.Short, c.IconKey, c.Description, c.Color, counts.GetValueOrDefault(c.Slug, 0))).ToArray();
    }

    public async Task<ProductListResponse> ListAsync(string? category, string? sort, int page, int pageSize, CancellationToken ct, string? q = null)
    {
        var now = DateTime.UtcNow;
        var query = _db.Products.Include(p => p.Seller).AsQueryable();
        if (!string.IsNullOrWhiteSpace(category) && category != "bestseller")
            query = query.Where(p => p.CategorySlug == category);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(p => EF.Functions.Like(p.Title, $"%{term}%") || EF.Functions.Like(p.Description, $"%{term}%"));
        }

        // Tin đang boost luôn lên đầu, sau đó tới tiêu chí sort được chọn (mặc định theo Sold).
        var ordered = query.OrderByDescending(p => p.BoostedUntil != null && p.BoostedUntil > now);
        ordered = sort switch
        {
            "price_asc"  => ordered.ThenBy(p => p.Price),
            "price_desc" => ordered.ThenByDescending(p => p.Price),
            "rating"     => ordered.ThenByDescending(p => p.Rating),
            "newest"     => ordered.ThenByDescending(p => p.CreatedAt),
            _            => ordered.ThenByDescending(p => p.Sold),
        };
        query = ordered;

        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new ProductListResponse(items.Select(MapList).ToArray(), total, page, pageSize);
    }

    public async Task<ProductDetailDto?> GetBySlugAsync(string slug, CancellationToken ct)
    {
        var p = await _db.Products
            .Include(x => x.Seller)
            .Include(x => x.Reviews).ThenInclude(r => r.User)
            .FirstOrDefaultAsync(x => x.Slug == slug, ct);
        if (p == null) return null;
        var seller = MapSeller(p.Seller!);
        return new ProductDetailDto(
            p.Id, p.Slug, p.Title, p.CategorySlug, p.Price, p.ComparePrice, p.Delivery.ToString(),
            p.WarrantyDays, p.Stock, p.Sold, p.Rating, p.ReviewCount, p.ThumbnailColor, p.ThumbnailIcon,
            p.ImageUrl,
            DeserializeArr(p.BadgesJson),
            p.Description,
            DeserializeArr(p.FeaturesJson),
            DeserializeArr(p.PoliciesJson),
            DeserializeFaq(p.FaqJson),
            seller,
            p.Reviews.OrderByDescending(r => r.CreatedAt).Select(r => new ReviewDto(
                r.Id, r.User?.DisplayName ?? "User", r.Rating, r.Comment, r.CreatedAt, r.Reply)).ToArray());
    }

    /// <summary>Flash sale đang chạy (now nằm trong khoảng StartsAt..EndsAt), gần kết thúc nhất.</summary>
    public async Task<ActiveFlashSaleDto?> GetActiveFlashSaleAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var sale = await _db.FlashSales
            .Where(f => f.StartsAt <= now && f.EndsAt > now)
            .OrderBy(f => f.EndsAt)
            .FirstOrDefaultAsync(ct);
        return sale == null ? null : new ActiveFlashSaleDto(sale.Id, sale.Title, sale.DiscountPercent, sale.StartsAt, sale.EndsAt);
    }

    public async Task<SellerSummaryDto[]> GetSellersAsync(CancellationToken ct)
    {
        var sellers = await _db.Sellers.Include(s => s.User)
            .OrderByDescending(s => s.TrustScore).ThenByDescending(s => s.TotalSold).ToListAsync(ct);
        return sellers.Select(MapSeller).ToArray();
    }

    public async Task<(SellerSummaryDto Seller, ProductListItemDto[] Products)?> GetSellerByUsernameAsync(string username, CancellationToken ct)
    {
        var s = await _db.Sellers.Include(s => s.User).FirstOrDefaultAsync(x => x.Username == username, ct);
        if (s == null) return null;
        var products = await _db.Products.Include(p => p.Seller).Where(p => p.SellerId == s.Id).ToListAsync(ct);
        return (MapSeller(s), products.Select(MapList).ToArray());
    }

    public static ProductListItemDto MapList(Product p)
    {
        var badges = DeserializeArr(p.BadgesJson);
        if (p.BoostedUntil.HasValue && p.BoostedUntil.Value > DateTime.UtcNow)
            badges = new[] { "Top" }.Concat(badges).ToArray();
        return new(
            p.Id, p.Slug, p.Title, p.CategorySlug, p.Price, p.ComparePrice,
            p.Delivery.ToString(), p.WarrantyDays, p.Stock, p.Sold, p.Rating, p.ReviewCount,
            p.ThumbnailColor, p.ThumbnailIcon, p.ImageUrl, badges, MapSeller(p.Seller!));
    }

    public static SellerSummaryDto MapSeller(Seller s) => new(
        s.Id, s.Username, s.DisplayName, s.AvatarColor, s.Rating, s.ReviewCount,
        s.TotalSold, s.Badge, s.User?.KycStatus.ToString() ?? "None", s.TrustScore,
        s.TrustBadgeUntil.HasValue && s.TrustBadgeUntil.Value > DateTime.UtcNow,
        s.JoinedAt, s.ResponseTime);

    public static string[] DeserializeArr(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();
        try { return JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>(); }
        catch { return Array.Empty<string>(); }
    }

    public static FaqItem[] DeserializeFaq(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<FaqItem>();
        try { return JsonSerializer.Deserialize<FaqItem[]>(json) ?? Array.Empty<FaqItem>(); }
        catch { return Array.Empty<FaqItem>(); }
    }
}
