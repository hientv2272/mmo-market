using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Application.Sellers;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Reviews;

public record ReviewCreateDto(Guid OrderId, Guid ProductId, int Rating, string Comment);
public record ReviewUpdateDto(int Rating, string Comment);
public record OwnReviewDto(Guid Id, Guid ProductId, string ProductTitle, string? ProductSlug, int Rating, string Comment, DateTime CreatedAt, string? Reply, Guid? OrderId);

public class ReviewService
{
    private readonly IAppDbContext _db;
    private readonly TrustScoreService _trust;
    public ReviewService(IAppDbContext db, TrustScoreService trust) { _db = db; _trust = trust; }

    public async Task<OwnReviewDto> CreateAsync(Guid userId, ReviewCreateDto dto, CancellationToken ct)
    {
        if (dto.Rating < 1 || dto.Rating > 5) throw new AppException("Rating phải từ 1-5");
        if (string.IsNullOrWhiteSpace(dto.Comment)) throw new AppException("Vui lòng nhập nhận xét");

        var order = await _db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == dto.OrderId && o.BuyerId == userId, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != OrderStatus.Completed && order.Status != OrderStatus.Checking)
            throw new AppException("Chỉ review đơn đã giao/hoàn thành");
        if (!order.Lines.Any(l => l.ProductId == dto.ProductId))
            throw new AppException("Sản phẩm không thuộc đơn này");

        // Mỗi đơn chỉ được đánh giá 1 lần cho mỗi sản phẩm. Muốn sửa thì dùng PUT /api/reviews/{id}.
        var existing = await _db.Reviews.FirstOrDefaultAsync(r => r.OrderId == dto.OrderId && r.ProductId == dto.ProductId && r.UserId == userId, ct);
        if (existing != null)
            throw new AppException("Bạn đã đánh giá sản phẩm này trong đơn rồi. Vào mục Đánh giá để chỉnh sửa.");

        var review = new Review
        {
            OrderId = dto.OrderId,
            ProductId = dto.ProductId,
            UserId = userId,
            Rating = dto.Rating,
            Comment = dto.Comment.Trim(),
        };
        _db.Reviews.Add(review);

        // Recompute product rating + count (gồm cả review mới chưa lưu)
        var productReviews = await _db.Reviews.Where(r => r.ProductId == dto.ProductId).ToListAsync(ct);
        productReviews.Add(review);
        var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == dto.ProductId, ct);
        if (product != null)
        {
            product.ReviewCount = productReviews.Count;
            product.Rating = Math.Round(productReviews.Average(r => (double)r.Rating), 2);
            await RecomputeSellerRatingAsync(product.SellerId, ct);
            await _trust.OnReviewAsync(product.SellerId, dto.Rating, ct);
        }

        await _db.SaveChangesAsync(ct);

        return new OwnReviewDto(review.Id, review.ProductId, product?.Title ?? "", product?.Slug, review.Rating, review.Comment, review.CreatedAt, review.Reply, review.OrderId);
    }

    public async Task<OwnReviewDto[]> GetMineAsync(Guid userId, CancellationToken ct)
    {
        var reviews = await _db.Reviews.Include(r => r.Product).Where(r => r.UserId == userId).OrderByDescending(r => r.CreatedAt).ToListAsync(ct);
        return reviews.Select(r => new OwnReviewDto(r.Id, r.ProductId, r.Product?.Title ?? "", r.Product?.Slug, r.Rating, r.Comment, r.CreatedAt, r.Reply, r.OrderId)).ToArray();
    }

    public async Task<OwnReviewDto> UpdateAsync(Guid userId, Guid reviewId, ReviewUpdateDto dto, CancellationToken ct)
    {
        if (dto.Rating < 1 || dto.Rating > 5) throw new AppException("Rating phải từ 1-5");
        if (string.IsNullOrWhiteSpace(dto.Comment)) throw new AppException("Vui lòng nhập nhận xét");

        var review = await _db.Reviews.Include(r => r.Product)
            .FirstOrDefaultAsync(r => r.Id == reviewId && r.UserId == userId, ct)
            ?? throw new AppException("Không tìm thấy đánh giá", 404);

        review.Rating = dto.Rating;
        review.Comment = dto.Comment.Trim();

        var product = review.Product;
        if (product != null)
        {
            var productReviews = await _db.Reviews.Where(r => r.ProductId == product.Id).ToListAsync(ct);
            product.Rating = Math.Round(productReviews.Average(r => (double)r.Rating), 2);
            await RecomputeSellerRatingAsync(product.SellerId, ct);
        }

        await _db.SaveChangesAsync(ct);
        return new OwnReviewDto(review.Id, review.ProductId, product?.Title ?? "", product?.Slug, review.Rating, review.Comment, review.CreatedAt, review.Reply, review.OrderId);
    }

    /// <summary>Tổng hợp rating shop từ toàn bộ sản phẩm của shop: bình quân có trọng số theo số đánh giá mỗi SP.</summary>
    private async Task RecomputeSellerRatingAsync(Guid sellerId, CancellationToken ct)
    {
        var seller = await _db.Sellers.FirstOrDefaultAsync(s => s.Id == sellerId, ct);
        if (seller == null) return;
        var products = await _db.Products.Where(p => p.SellerId == sellerId).Select(p => new { p.Rating, p.ReviewCount }).ToListAsync(ct);
        var totalCount = products.Sum(p => p.ReviewCount);
        seller.ReviewCount = totalCount;
        seller.Rating = totalCount == 0
            ? 0
            : Math.Round(products.Sum(p => p.Rating * p.ReviewCount) / totalCount, 2);
    }
}
