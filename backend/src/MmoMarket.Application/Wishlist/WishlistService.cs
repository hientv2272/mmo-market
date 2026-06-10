using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Domain.Entities;

namespace MmoMarket.Application.Wishlist;

public record WishlistProductDto(
    Guid Id, string Slug, string Title, string CategorySlug,
    decimal Price, decimal? ComparePrice,
    string ThumbnailColor, string? ThumbnailIcon, string? ImageUrl,
    double Rating, int ReviewCount, int Sold,
    string Delivery, int WarrantyDays,
    string SellerUsername, string SellerAvatarColor,
    DateTime AddedAt);

public class WishlistService
{
    private readonly IAppDbContext _db;
    public WishlistService(IAppDbContext db) => _db = db;

    public async Task<WishlistProductDto[]> GetAsync(Guid userId, CancellationToken ct)
    {
        var items = await _db.WishlistItems
            .Where(w => w.UserId == userId)
            .Include(w => w.Product!.Seller!.User)
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync(ct);

        return items.Select(w =>
        {
            var p = w.Product!;
            var seller = p.Seller;
            return new WishlistProductDto(
                p.Id, p.Slug, p.Title, p.CategorySlug,
                p.Price, p.ComparePrice,
                p.ThumbnailColor, p.ThumbnailIcon, p.ImageUrl,
                p.Rating, p.ReviewCount, p.Sold,
                p.Delivery.ToString(), p.WarrantyDays,
                seller?.Username ?? "", seller?.User?.AvatarColor ?? "#7c3aed",
                w.CreatedAt);
        }).ToArray();
    }

    public async Task<string[]> GetIdsAsync(Guid userId, CancellationToken ct)
    {
        var ids = await _db.WishlistItems
            .Where(w => w.UserId == userId)
            .Select(w => w.ProductId.ToString())
            .ToListAsync(ct);
        return ids.ToArray();
    }

    // Returns true if added, false if removed
    public async Task<bool> ToggleAsync(Guid userId, Guid productId, CancellationToken ct)
    {
        var existing = await _db.WishlistItems
            .FirstOrDefaultAsync(w => w.UserId == userId && w.ProductId == productId, ct);

        if (existing != null)
        {
            _db.WishlistItems.Remove(existing);
            await _db.SaveChangesAsync(ct);
            return false;
        }

        var product = await _db.Products.FindAsync([productId], ct)
            ?? throw new AppException("Sản phẩm không tồn tại", 404);

        _db.WishlistItems.Add(new WishlistItem { UserId = userId, ProductId = productId });
        await _db.SaveChangesAsync(ct);
        return true;
    }
}
