using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Wallet;

public record WalletTxnDto(Guid Id, string Type, string Status, decimal Amount, string Note, DateTime CreatedAt);
public record WalletStateDto(decimal Balance, decimal HeldBalance, int LoyaltyPoints, WalletTxnDto[] Transactions);

public class WalletService
{
    private readonly IAppDbContext _db;
    public WalletService(IAppDbContext db) { _db = db; }

    public async Task<WalletStateDto> GetAsync(Guid userId, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        var txns = await _db.WalletTxns
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .Take(50)
            .ToListAsync(ct);
        var heldTotals = await _db.Orders
            .Where(o => o.BuyerId == userId && (o.Status == OrderStatus.EscrowLocked || o.Status == OrderStatus.Delivering || o.Status == OrderStatus.Checking))
            .Select(o => o.Total)
            .ToListAsync(ct);
        var held = heldTotals.Sum();
        return new WalletStateDto(user.WalletBalance, held, user.LoyaltyPoints,
            txns.Select(t => new WalletTxnDto(t.Id, t.Type.ToString(), t.Status.ToString(), t.Amount, t.Note, t.CreatedAt)).ToArray());
    }
}
