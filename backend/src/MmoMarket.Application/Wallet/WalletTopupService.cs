using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Application.Notifications;
using MmoMarket.Application.Payments;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Wallet;

public record CreateTopupDto(decimal Amount, string Method);
public record CancelTopupDto(string? Code);
public record TopupIntentDto(Guid Id, string Code, decimal Amount, string Method, string Status);
public record TopupStatusDto(Guid Id, string Code, decimal Amount, string Status);

/// <summary>
/// Nạp ví qua cổng thanh toán thật (VietQR/MoMo/ZaloPay/VNPay/USDT).
/// Khác với trước đây (cộng tiền ngay), luồng này tạo một giao dịch <see cref="WalletTxnStatus.Pending"/>
/// và CHỈ cộng số dư khi webhook/cổng xác nhận đã nhận tiền (idempotent).
/// </summary>
public class WalletTopupService
{
    private readonly IAppDbContext _db;
    private readonly NotificationService _notify;
    private readonly TransactionLimitService _limits;
    private readonly SePayPgService _sepay;
    public WalletTopupService(IAppDbContext db, NotificationService notify, TransactionLimitService limits, SePayPgService sepay)
    { _db = db; _notify = notify; _limits = limits; _sepay = sepay; }

    // Hình thức nạp hợp lệ — đồng bộ với PaymentMethod (trừ Wallet, vì nạp vào chính ví).
    private static readonly string[] AllowedMethods = { "VietQr", "Momo", "ZaloPay", "VnPay", "Usdt" };

    private const string CodePattern = @"NAP-\d{7}";

    // Tạo giao dịch nạp ở trạng thái chờ — KHÔNG cộng tiền ngay.
    public async Task<TopupIntentDto> CreateIntentAsync(Guid userId, CreateTopupDto dto, CancellationToken ct)
    {
        if (dto.Amount <= 0) throw new AppException("Số tiền không hợp lệ");
        var method = AllowedMethods.FirstOrDefault(m => string.Equals(m, dto.Method, StringComparison.OrdinalIgnoreCase))
            ?? throw new AppException("Hình thức thanh toán không hợp lệ");
        await _limits.EnsureDepositAllowedAsync(userId, dto.Amount, ct);
        _ = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);

        var code = "NAP-" + DateTime.UtcNow.Ticks.ToString()[^7..];
        var txn = new WalletTxn
        {
            UserId = userId,
            Type = WalletTxnType.Topup,
            Amount = dto.Amount,
            Status = WalletTxnStatus.Pending,
            Note = $"Nạp ví qua {method} · {code}",
        };
        _db.WalletTxns.Add(txn);
        await _db.SaveChangesAsync(ct);
        return new TopupIntentDto(txn.Id, code, txn.Amount, method, txn.Status.ToString());
    }

    public async Task<TopupStatusDto> GetStatusAsync(Guid userId, Guid id, CancellationToken ct)
    {
        var txn = await GetTxnForUserAsync(userId, id, ct);
        return new TopupStatusDto(txn.Id, ExtractCode(txn.Note), txn.Amount, txn.Status.ToString());
    }

    // Lấy giao dịch nạp của user (404 nếu không có / không thuộc user).
    public async Task<WalletTxn> GetTxnForUserAsync(Guid userId, Guid id, CancellationToken ct)
        => await _db.WalletTxns.FirstOrDefaultAsync(
               t => t.Id == id && t.UserId == userId && t.Type == WalletTxnType.Topup, ct)
           ?? throw new AppException("Không tìm thấy giao dịch nạp", 404);

    // Topup Pending quá hạn này sẽ tự huỷ (nếu chưa thanh toán).
    private static readonly TimeSpan PendingTtl = TimeSpan.FromMinutes(30);

    // Đối soát cho 1 user (gọi từ trang ví): xác nhận đơn đã CAPTURED, huỷ đơn quá hạn.
    public async Task ReconcileForUserAsync(Guid userId, CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddHours(-2);
        var pendings = await _db.WalletTxns
            .Where(t => t.UserId == userId && t.Type == WalletTxnType.Topup
                && t.Status == WalletTxnStatus.Pending && t.CreatedAt >= since)
            .OrderByDescending(t => t.CreatedAt)
            .Take(20)
            .ToListAsync(ct);
        await ProcessPendingsAsync(pendings, DateTime.UtcNow - PendingTtl, ct);
    }

    // Worker định kỳ: mọi giao dịch nạp quá hạn còn Pending → cộng nếu thực ra đã trả, ngược lại huỷ.
    public async Task<int> ExpireStalePendingAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow - PendingTtl;
        var stale = await _db.WalletTxns
            .Where(t => t.Type == WalletTxnType.Topup && t.Status == WalletTxnStatus.Pending && t.CreatedAt < cutoff)
            .OrderBy(t => t.CreatedAt)
            .Take(100)
            .ToListAsync(ct);
        return await ProcessPendingsAsync(stale, cutoff, ct);
    }

    // Người dùng bấm "Huỷ giao dịch" trên trang SePay → đánh dấu Cancelled (nếu còn Pending & chưa thực trả).
    public async Task<bool> CancelByCodeAsync(Guid userId, string code, CancellationToken ct)
    {
        var c = ExtractCode(code ?? "");
        if (string.IsNullOrEmpty(c)) return false;
        var txn = await _db.WalletTxns.FirstOrDefaultAsync(t => t.UserId == userId
            && t.Type == WalletTxnType.Topup && t.Status == WalletTxnStatus.Pending && t.Note.Contains(c), ct);
        if (txn == null) return false;
        // Phòng trường hợp thực ra đã thanh toán: ưu tiên cộng ví thay vì huỷ nhầm.
        if (_sepay.Enabled)
        {
            var st = await _sepay.GetOrderStatusAsync(c, ct);
            if (st.Found && SePayPgService.IsPaid(st.Status))
                return await CreditAsync(txn, st.Amount, ct);
        }
        txn.Status = WalletTxnStatus.Cancelled;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // Lõi: duyệt danh sách Pending — đơn đã CAPTURED thì cộng ví; đơn cũ hơn cutoff thì huỷ.
    private async Task<int> ProcessPendingsAsync(IReadOnlyList<WalletTxn> pendings, DateTime expireCutoff, CancellationToken ct)
    {
        var changed = 0;
        foreach (var txn in pendings)
        {
            if (txn.Status != WalletTxnStatus.Pending) continue;
            var code = ExtractCode(txn.Note);
            if (!string.IsNullOrEmpty(code) && _sepay.Enabled)
            {
                var st = await _sepay.GetOrderStatusAsync(code, ct);
                if (st.Found && SePayPgService.IsPaid(st.Status))
                {
                    if (await CreditAsync(txn, st.Amount, ct)) changed++;
                    continue;
                }
            }
            if (txn.CreatedAt < expireCutoff)
            {
                txn.Status = WalletTxnStatus.Cancelled;
                changed++;
            }
        }
        if (changed > 0) await _db.SaveChangesAsync(ct);
        return changed;
    }

    // Như trên nhưng yêu cầu còn đang chờ thanh toán (dùng cho các endpoint tạo mã thanh toán).
    public async Task<WalletTxn> GetPendingForUserAsync(Guid userId, Guid id, CancellationToken ct)
    {
        var txn = await GetTxnForUserAsync(userId, id, ct);
        if (txn.Status != WalletTxnStatus.Pending)
            throw new AppException("Giao dịch nạp không ở trạng thái chờ thanh toán");
        return txn;
    }

    public static string ExtractCode(string note)
    {
        var m = Regex.Match(note ?? "", CodePattern, RegexOptions.IgnoreCase);
        return m.Success ? m.Value.ToUpper() : "";
    }

    // Idempotent — cộng ví theo id giao dịch (MoMo/ZaloPay/VNPay/USDT đều echo id này về trong IPN).
    // paidAmount: số tiền cổng báo đã thu (null = đã verify nơi khác, vd USDT khớp on-chain).
    public async Task<bool> ConfirmByIdAsync(Guid id, decimal? paidAmount, CancellationToken ct)
    {
        var txn = await _db.WalletTxns.FirstOrDefaultAsync(
            t => t.Id == id && t.Type == WalletTxnType.Topup, ct);
        return txn != null && await CreditAsync(txn, paidAmount, ct);
    }

    // Idempotent — cộng ví theo nội dung chuyển khoản (SePay), trích mã NAP-XXXXXXX.
    public async Task<bool> ConfirmByTransferNoteAsync(string content, decimal? paidAmount, CancellationToken ct)
    {
        var m = Regex.Match(content ?? "", CodePattern, RegexOptions.IgnoreCase);
        if (!m.Success) return false;
        var code = m.Value.ToUpper();
        var txn = await _db.WalletTxns.FirstOrDefaultAsync(
            t => t.Type == WalletTxnType.Topup && t.Status == WalletTxnStatus.Pending && t.Note.Contains(code), ct);
        return txn != null && await CreditAsync(txn, paidAmount, ct);
    }

    private async Task<bool> CreditAsync(WalletTxn txn, decimal? paidAmount, CancellationToken ct)
    {
        if (txn.Status == WalletTxnStatus.Completed) return true;  // đã cộng trước đó → idempotent
        if (txn.Status != WalletTxnStatus.Pending) return false;
        // Chống cộng nhầm khi số tiền thực nhận khác số đã yêu cầu (so khớp theo đồng VND).
        if (paidAmount.HasValue && (long)Math.Round(paidAmount.Value) != (long)Math.Round(txn.Amount))
        {
            _db.AuditLogs.Add(new AuditLog
            {
                ActorUserId = txn.UserId,
                ActorRole = "Buyer",
                Action = "topup_amount_mismatch",
                EntityType = "WalletTxn",
                EntityId = txn.Id.ToString(),
                Amount = paidAmount.Value,
                Detail = $"Số tiền nạp thực nhận ({paidAmount.Value:N0}đ) khác số yêu cầu ({txn.Amount:N0}đ) — KHÔNG cộng ví.",
            });
            await _db.SaveChangesAsync(ct);
            return false;
        }
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == txn.UserId, ct);
        if (user == null) return false;

        user.WalletBalance += txn.Amount;
        txn.Status = WalletTxnStatus.Completed;
        await _db.SaveChangesAsync(ct);
        await _notify.CreateAsync(txn.UserId, "wallet", "Nạp ví thành công",
            $"Số dư ví của bạn đã được cộng {txn.Amount:N0}₫.", "/account/wallet", ct);
        return true;
    }
}
