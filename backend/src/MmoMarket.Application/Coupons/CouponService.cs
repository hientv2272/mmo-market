using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Coupons;

public record CouponDto(
    Guid Id, string Code, string Description,
    string Type, decimal Value, decimal MinOrderAmount,
    decimal? MaxDiscount, int MaxUses, int UsedCount,
    DateTime? ExpiresAt, bool IsActive, bool UsedByMe);

public record ValidateResult(bool Valid, string? Error, decimal Discount, string? Message);

public class CouponService
{
    private readonly IAppDbContext _db;
    public CouponService(IAppDbContext db) => _db = db;

    public async Task<CouponDto[]> GetAvailableAsync(Guid userId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var coupons = await _db.Coupons
            .Where(c => c.IsActive)
            .OrderBy(c => c.ExpiresAt)
            .ToListAsync(ct);

        var usedIds = await _db.CouponUsages
            .Where(u => u.UserId == userId)
            .Select(u => u.CouponId)
            .ToListAsync(ct);
        var usedSet = usedIds.ToHashSet();

        return coupons.Select(c => Map(c, usedSet.Contains(c.Id))).ToArray();
    }

    public async Task<ValidateResult> ValidateAsync(
        Guid userId, string code, decimal orderAmount, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var normalCode = code.Trim().ToUpperInvariant();
        var coupon = await _db.Coupons
            .FirstOrDefaultAsync(c => c.Code == normalCode, ct);

        // Fall back to seller coupons if not found in platform coupons
        if (coupon is null)
            return await ValidateSellerCouponAsync(userId, normalCode, orderAmount, now, ct);
        if (coupon is null)
            return new(false, "Mã giảm giá không tồn tại", 0, null);
        if (!coupon.IsActive)
            return new(false, "Mã giảm giá không còn hiệu lực", 0, null);
        if (coupon.ExpiresAt.HasValue && coupon.ExpiresAt < now)
            return new(false, "Mã giảm giá đã hết hạn", 0, null);
        if (coupon.MaxUses > 0 && coupon.UsedCount >= coupon.MaxUses)
            return new(false, "Mã giảm giá đã hết lượt sử dụng", 0, null);
        if (orderAmount < coupon.MinOrderAmount)
            return new(false, $"Đơn hàng tối thiểu {coupon.MinOrderAmount:N0}₫ để dùng mã này", 0, null);

        var alreadyUsed = await _db.CouponUsages
            .AnyAsync(u => u.CouponId == coupon.Id && u.UserId == userId, ct);
        if (alreadyUsed)
            return new(false, "Bạn đã sử dụng mã này rồi", 0, null);

        var discount = coupon.Type == CouponType.Percent
            ? Math.Min(orderAmount * coupon.Value / 100m, coupon.MaxDiscount ?? decimal.MaxValue)
            : Math.Min(coupon.Value, orderAmount);

        discount = Math.Round(discount, 0);
        var msg = coupon.Type == CouponType.Percent
            ? $"Giảm {coupon.Value}% — tiết kiệm {discount:N0}₫"
            : $"Giảm {discount:N0}₫";

        return new(true, null, discount, msg);
    }

    // Called internally from OrderService
    public async Task RecordUsageAsync(
        Guid userId, string code, Guid orderId, CancellationToken ct)
    {
        var normalCode = code.Trim().ToUpperInvariant();
        var coupon = await _db.Coupons.FirstOrDefaultAsync(c => c.Code == normalCode, ct);
        if (coupon != null)
        {
            coupon.UsedCount++;
            _db.CouponUsages.Add(new CouponUsage { CouponId = coupon.Id, UserId = userId, OrderId = orderId });
            await _db.SaveChangesAsync(ct);
            return;
        }
        // Seller coupon
        var sellerCoupon = await _db.SellerCoupons.FirstOrDefaultAsync(c => c.Code == normalCode, ct);
        if (sellerCoupon != null)
        {
            sellerCoupon.UsedCount++;
            await _db.SaveChangesAsync(ct);
        }
    }

    // Hoàn lượt dùng coupon (platform) khi đơn bị huỷ. KHÔNG SaveChanges — để caller lưu chung.
    // Coupon của seller không lưu theo đơn nên không hoàn được (chấp nhận giới hạn này).
    public async Task ReleaseUsageByOrderAsync(Guid orderId, CancellationToken ct)
    {
        var usage = await _db.CouponUsages.FirstOrDefaultAsync(u => u.OrderId == orderId, ct);
        if (usage == null) return;
        var coupon = await _db.Coupons.FirstOrDefaultAsync(c => c.Id == usage.CouponId, ct);
        if (coupon != null && coupon.UsedCount > 0) coupon.UsedCount--;
        _db.CouponUsages.Remove(usage);
    }

    private async Task<ValidateResult> ValidateSellerCouponAsync(
        Guid userId, string code, decimal orderAmount, DateTime now, CancellationToken ct)
    {
        var coupon = await _db.SellerCoupons
            .FirstOrDefaultAsync(c => c.Code == code, ct);
        if (coupon is null)
            return new(false, "Mã giảm giá không tồn tại", 0, null);
        if (!coupon.IsActive)
            return new(false, "Mã giảm giá không còn hiệu lực", 0, null);
        if (coupon.ExpiresAt.HasValue && coupon.ExpiresAt < now)
            return new(false, "Mã giảm giá đã hết hạn", 0, null);
        if (coupon.MaxUses > 0 && coupon.UsedCount >= coupon.MaxUses)
            return new(false, "Mã giảm giá đã hết lượt sử dụng", 0, null);
        if (orderAmount < coupon.MinOrderAmount)
            return new(false, $"Đơn hàng tối thiểu {coupon.MinOrderAmount:N0}₫ để dùng mã này", 0, null);

        var discount = coupon.Type == CouponType.Percent
            ? Math.Min(orderAmount * coupon.Value / 100m, coupon.MaxDiscount ?? decimal.MaxValue)
            : Math.Min(coupon.Value, orderAmount);
        discount = Math.Round(discount, 0);
        var msg = coupon.Type == CouponType.Percent
            ? $"Giảm {coupon.Value}% — tiết kiệm {discount:N0}₫"
            : $"Giảm {discount:N0}₫";
        return new(true, null, discount, msg);
    }

    private static CouponDto Map(Coupon c, bool usedByMe) => new(
        c.Id, c.Code, c.Description,
        c.Type.ToString(), c.Value, c.MinOrderAmount,
        c.MaxDiscount, c.MaxUses, c.UsedCount,
        c.ExpiresAt, c.IsActive, usedByMe);
}
