using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Sellers;

public record SellerPlanDto(string Code, string Name, decimal PricePerMonth, decimal FeeDiscountPercent,
    int MaxListings, int BoostsPerMonth, string? Badge, int Position, bool IsActive);

public record CurrentPlanDto(string Code, string Name, decimal FeeDiscountPercent, int MaxListings,
    int BoostsPerMonth, string? Badge, DateTime? ExpiresAt, bool Active, DateTime? TrustBadgeUntil);

public record AdminPlanUpsertDto(string Code, string Name, decimal PricePerMonth, decimal FeeDiscountPercent,
    int MaxListings, int BoostsPerMonth, string? Badge, int Position, bool IsActive);

public record AdminPlanDto(Guid Id, string Code, string Name, decimal PricePerMonth, decimal FeeDiscountPercent,
    int MaxListings, int BoostsPerMonth, string? Badge, int Position, bool IsActive);

public class SellerPlanService
{
    private readonly IAppDbContext _db;
    public SellerPlanService(IAppDbContext db) => _db = db;

    public async Task<SellerPlanDto[]> ListPlansAsync(CancellationToken ct)
    {
        var plans = await _db.SellerPlans.Where(p => p.IsActive).OrderBy(p => p.Position).ToListAsync(ct);
        return plans.Select(Map).ToArray();
    }

    /// <summary>Gói đang có hiệu lực của seller (hết hạn → Free).</summary>
    public async Task<SellerPlan> ResolvePlanAsync(Seller? seller, CancellationToken ct)
    {
        var code = "free";
        if (seller != null && seller.PlanCode != "free"
            && seller.PlanExpiresAt.HasValue && seller.PlanExpiresAt.Value > DateTime.UtcNow)
            code = seller.PlanCode;
        var plan = await _db.SellerPlans.FirstOrDefaultAsync(p => p.Code == code, ct);
        return plan ?? new SellerPlan { Code = "free", Name = "Free", FeeDiscountPercent = 0m, MaxListings = 10 };
    }

    public async Task<SellerPlan> GetEffectivePlanBySellerIdAsync(Guid sellerId, CancellationToken ct)
    {
        var seller = await _db.Sellers.FirstOrDefaultAsync(s => s.Id == sellerId, ct);
        return await ResolvePlanAsync(seller, ct);
    }

    public async Task<CurrentPlanDto> GetMyPlanAsync(Guid userId, CancellationToken ct)
    {
        var seller = await _db.Sellers.FirstOrDefaultAsync(s => s.UserId == userId, ct)
            ?? throw new AppException("Bạn chưa được kích hoạt seller.", 403);
        var effective = await ResolvePlanAsync(seller, ct);
        var active = seller.PlanCode != "free" && seller.PlanExpiresAt.HasValue && seller.PlanExpiresAt.Value > DateTime.UtcNow;
        return new CurrentPlanDto(effective.Code, effective.Name, effective.FeeDiscountPercent,
            effective.MaxListings, effective.BoostsPerMonth, effective.Badge, seller.PlanExpiresAt, active, seller.TrustBadgeUntil);
    }

    public async Task<CurrentPlanDto> SubscribeAsync(Guid userId, string planCode, CancellationToken ct)
    {
        var seller = await _db.Sellers.FirstOrDefaultAsync(s => s.UserId == userId, ct)
            ?? throw new AppException("Bạn chưa được kích hoạt seller.", 403);
        var plan = await _db.SellerPlans.FirstOrDefaultAsync(p => p.Code == planCode && p.IsActive, ct)
            ?? throw new AppException("Gói không tồn tại");
        if (plan.Code == "free") throw new AppException("Không cần đăng ký gói Free");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        if (user.WalletBalance < plan.PricePerMonth)
            throw new AppException($"Số dư ví không đủ để mua gói (cần {plan.PricePerMonth:N0}đ)");

        user.WalletBalance -= plan.PricePerMonth;
        _db.WalletTxns.Add(new WalletTxn
        {
            UserId = userId,
            Type = WalletTxnType.Purchase,
            Amount = -plan.PricePerMonth,
            Status = WalletTxnStatus.Completed,
            Note = $"Đăng ký gói {plan.Name} (30 ngày)",
        });

        // Gia hạn: nếu đang còn hạn cùng gói thì cộng dồn, khác gói thì tính từ bây giờ.
        var baseDate = (seller.PlanCode == plan.Code && seller.PlanExpiresAt.HasValue && seller.PlanExpiresAt.Value > DateTime.UtcNow)
            ? seller.PlanExpiresAt.Value : DateTime.UtcNow;
        seller.PlanCode = plan.Code;
        seller.PlanExpiresAt = baseDate.AddDays(30);
        if (!string.IsNullOrEmpty(plan.Badge)) seller.Badge = plan.Badge;

        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = userId,
            ActorRole = "Seller",
            Action = "seller_plan_subscribe",
            EntityType = "SellerPlan",
            EntityId = plan.Code,
            Amount = plan.PricePerMonth,
            Detail = $"Đăng ký gói {plan.Name}, hiệu lực đến {seller.PlanExpiresAt:yyyy-MM-dd}",
        });

        await _db.SaveChangesAsync(ct);
        return await GetMyPlanAsync(userId, ct);
    }

    private static SellerPlanDto Map(SellerPlan p) => new(
        p.Code, p.Name, p.PricePerMonth, p.FeeDiscountPercent,
        p.MaxListings, p.BoostsPerMonth, p.Badge, p.Position, p.IsActive);

    // ── Admin CRUD ────────────────────────────────────────────────────────────
    private static AdminPlanDto MapAdmin(SellerPlan p) => new(
        p.Id, p.Code, p.Name, p.PricePerMonth, p.FeeDiscountPercent,
        p.MaxListings, p.BoostsPerMonth, p.Badge, p.Position, p.IsActive);

    public async Task<AdminPlanDto[]> ListAllPlansAsync(CancellationToken ct)
    {
        var plans = await _db.SellerPlans.OrderBy(p => p.Position).ToListAsync(ct);
        return plans.Select(MapAdmin).ToArray();
    }

    public async Task<AdminPlanDto> CreatePlanAsync(AdminPlanUpsertDto dto, CancellationToken ct)
    {
        var code = (dto.Code ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(code)) throw new AppException("Mã gói (code) bắt buộc");
        if (await _db.SellerPlans.AnyAsync(p => p.Code == code, ct))
            throw new AppException("Mã gói đã tồn tại");
        var plan = new SellerPlan
        {
            Code = code, Name = dto.Name, PricePerMonth = Math.Max(0m, dto.PricePerMonth),
            FeeDiscountPercent = Math.Clamp(dto.FeeDiscountPercent, 0m, 100m),
            MaxListings = dto.MaxListings, BoostsPerMonth = Math.Max(0, dto.BoostsPerMonth),
            Badge = string.IsNullOrWhiteSpace(dto.Badge) ? null : dto.Badge,
            Position = dto.Position, IsActive = dto.IsActive,
        };
        _db.SellerPlans.Add(plan);
        await _db.SaveChangesAsync(ct);
        return MapAdmin(plan);
    }

    public async Task<AdminPlanDto> UpdatePlanAsync(Guid id, AdminPlanUpsertDto dto, CancellationToken ct)
    {
        var plan = await _db.SellerPlans.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new AppException("Không tìm thấy gói", 404);
        var code = (dto.Code ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(code)) throw new AppException("Mã gói (code) bắt buộc");
        if (code != plan.Code && await _db.SellerPlans.AnyAsync(p => p.Code == code && p.Id != id, ct))
            throw new AppException("Mã gói đã tồn tại");
        plan.Code = code; plan.Name = dto.Name; plan.PricePerMonth = Math.Max(0m, dto.PricePerMonth);
        plan.FeeDiscountPercent = Math.Clamp(dto.FeeDiscountPercent, 0m, 100m);
        plan.MaxListings = dto.MaxListings; plan.BoostsPerMonth = Math.Max(0, dto.BoostsPerMonth);
        plan.Badge = string.IsNullOrWhiteSpace(dto.Badge) ? null : dto.Badge;
        plan.Position = dto.Position; plan.IsActive = dto.IsActive;
        await _db.SaveChangesAsync(ct);
        return MapAdmin(plan);
    }

    public async Task DeletePlanAsync(Guid id, CancellationToken ct)
    {
        var plan = await _db.SellerPlans.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new AppException("Không tìm thấy gói", 404);
        if (plan.Code == "free") throw new AppException("Không thể xóa gói Free (gói mặc định)");
        _db.SellerPlans.Remove(plan);
        await _db.SaveChangesAsync(ct);
    }
}
