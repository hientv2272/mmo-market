using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Loyalty;

public record LoyaltyRewardDto(Guid Id, string Title, string Description, int PointsCost, string Type, decimal VoucherAmount, bool IsComingSoon);
public record RedeemResultDto(string CouponCode, decimal VoucherAmount, int PointsLeft, DateTime ExpiresAt);

public class LoyaltyService
{
    private readonly IAppDbContext _db;
    public LoyaltyService(IAppDbContext db) { _db = db; }

    /// <summary>Danh sách phần thưởng đang mở (cho buyer đổi điểm).</summary>
    public async Task<LoyaltyRewardDto[]> ListRewardsAsync(CancellationToken ct)
    {
        var rewards = await _db.LoyaltyRewards
            .Where(r => r.IsActive)
            .OrderBy(r => r.Position).ThenBy(r => r.PointsCost)
            .ToListAsync(ct);
        return rewards
            .Select(r => new LoyaltyRewardDto(r.Id, r.Title, r.Description, r.PointsCost, r.Type, r.VoucherAmount, r.IsComingSoon))
            .ToArray();
    }

    /// <summary>Đổi điểm lấy phần thưởng: trừ điểm thật + phát mã voucher dùng 1 lần (hết hạn 30 ngày).</summary>
    public async Task<RedeemResultDto> RedeemAsync(Guid userId, Guid rewardId, CancellationToken ct)
    {
        var reward = await _db.LoyaltyRewards.FirstOrDefaultAsync(r => r.Id == rewardId, ct)
            ?? throw new AppException("Không tìm thấy phần thưởng", 404);
        if (!reward.IsActive || reward.IsComingSoon)
            throw new AppException("Phần thưởng chưa mở để đổi.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        if (user.LoyaltyPoints < reward.PointsCost)
            throw new AppException($"Không đủ điểm. Cần {reward.PointsCost}, bạn có {user.LoyaltyPoints}.");

        user.LoyaltyPoints -= reward.PointsCost;

        var expiresAt = DateTime.UtcNow.AddDays(30);
        var code = "LOYALTY-" + Guid.NewGuid().ToString("N")[..8].ToUpper();
        _db.Coupons.Add(new Coupon
        {
            Code = code,
            Description = $"Đổi điểm: {reward.Title}",
            Type = CouponType.Fixed,
            Value = reward.VoucherAmount,
            MinOrderAmount = 0,
            MaxUses = 1,
            ExpiresAt = expiresAt,
            IsActive = true,
        });

        await _db.SaveChangesAsync(ct);
        return new RedeemResultDto(code, reward.VoucherAmount, user.LoyaltyPoints, expiresAt);
    }
}
