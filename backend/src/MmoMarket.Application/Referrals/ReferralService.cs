using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Referrals;

public record ReferredUserDto(string DisplayName, string Username, DateTime JoinedAt, int Orders, decimal Commission);
public record ReferralStatsDto(
    string ReferralCode,
    int TotalReferred,
    int NewReferred7d,
    decimal TotalCommission,
    int OrdersFromReferred,
    ReferredUserDto[] Referred);

public class ReferralService
{
    private readonly IAppDbContext _db;
    public ReferralService(IAppDbContext db) { _db = db; }

    /// <summary>Thống kê giới thiệu thật của 1 user: số người đã giới thiệu, hoa hồng, danh sách.</summary>
    public async Task<ReferralStatsDto> GetMyStatsAsync(Guid userId, CancellationToken ct)
    {
        var me = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);

        var referred = await _db.Users.Where(u => u.ReferredByUserId == userId).ToListAsync(ct);
        var since7 = DateTime.UtcNow.AddDays(-7);
        var newReferred7d = referred.Count(u => u.CreatedAt >= since7);
        var referredIds = referred.Select(u => u.Id).ToList();

        // Hoa hồng đã nhận (txn Commission về ví mình)
        var commTxns = await _db.WalletTxns
            .Where(t => t.UserId == userId && t.Type == WalletTxnType.Commission && t.Status == WalletTxnStatus.Completed)
            .ToListAsync(ct);
        var totalCommission = commTxns.Sum(t => t.Amount);

        // Quy hoa hồng về từng người được giới thiệu qua OrderId -> Order.BuyerId
        var orderIds = commTxns.Where(t => t.OrderId != null).Select(t => t.OrderId!.Value).ToList();
        var orderBuyers = await _db.Orders.Where(o => orderIds.Contains(o.Id))
            .Select(o => new { o.Id, o.BuyerId }).ToListAsync(ct);
        var buyerByOrder = orderBuyers.ToDictionary(o => o.Id, o => o.BuyerId);
        var commByBuyer = commTxns
            .Where(t => t.OrderId != null && buyerByOrder.ContainsKey(t.OrderId!.Value))
            .GroupBy(t => buyerByOrder[t.OrderId!.Value])
            .ToDictionary(g => g.Key, g => g.Sum(t => t.Amount));

        // Số đơn hoàn thành của từng người được giới thiệu
        var ordersByBuyer = referredIds.Count == 0
            ? new Dictionary<Guid, int>()
            : (await _db.Orders
                .Where(o => referredIds.Contains(o.BuyerId) && o.Status == OrderStatus.Completed)
                .GroupBy(o => o.BuyerId)
                .Select(g => new { BuyerId = g.Key, Count = g.Count() })
                .ToListAsync(ct))
              .ToDictionary(x => x.BuyerId, x => x.Count);

        var list = referred
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new ReferredUserDto(
                u.DisplayName, u.Username, u.CreatedAt,
                ordersByBuyer.TryGetValue(u.Id, out var oc) ? oc : 0,
                commByBuyer.TryGetValue(u.Id, out var cm) ? cm : 0m))
            .ToArray();

        return new ReferralStatsDto(
            me.ReferralCode ?? "",
            referred.Count,
            newReferred7d,
            totalCommission,
            ordersByBuyer.Values.Sum(),
            list);
    }
}
