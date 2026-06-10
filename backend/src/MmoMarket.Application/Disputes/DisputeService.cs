using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Application.Config;
using MmoMarket.Application.Sellers;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Disputes;

public record DisputeOpenDto(Guid OrderId, string Title, string Body);
public record DisputeMessageCreateDto(string Body);
public record DisputeResolveDto(string Resolution, string Action, decimal? RefundPercent = null); // Action: refund_buyer | release_seller | partial_refund

public record DisputeMessageDto(Guid Id, Guid AuthorUserId, string AuthorName, string AuthorRole, string Body, DateTime CreatedAt);
public record DisputeListItemDto(Guid Id, string Code, Guid OrderId, string OrderCode, string Title, string Status, DateTime CreatedAt, DateTime SlaUntil, string? Resolution);
public record DisputeDetailDto(Guid Id, string Code, Guid OrderId, string OrderCode, Guid BuyerId, Guid SellerId, string Title, string Body, string Status, string? Resolution, DateTime SlaUntil, DateTime CreatedAt, DisputeMessageDto[] Messages);

public class DisputeService
{
    private readonly IAppDbContext _db;
    private readonly ConfigService _config;
    private readonly TrustScoreService _trust;
    public DisputeService(IAppDbContext db, ConfigService config, TrustScoreService trust)
    { _db = db; _config = config; _trust = trust; }

    public async Task<DisputeDetailDto> OpenAsync(Guid userId, DisputeOpenDto dto, CancellationToken ct)
    {
        var order = await _db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == dto.OrderId && o.BuyerId == userId, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != OrderStatus.Checking && order.Status != OrderStatus.Delivering && order.Status != OrderStatus.EscrowLocked)
            throw new AppException("Chỉ mở tranh chấp với đơn đã giao/đang xử lý");
        if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Body))
            throw new AppException("Vui lòng nhập tiêu đề và nội dung");
        var existing = await _db.Disputes.FirstOrDefaultAsync(d => d.OrderId == dto.OrderId && (d.Status == DisputeStatus.Open || d.Status == DisputeStatus.Investigating), ct);
        if (existing != null) throw new AppException("Đơn đã có tranh chấp đang mở");

        // Chống lạm dụng tranh chấp (P2.3)
        var maxPerMonth = await _config.GetIntAsync(ConfigKeys.DisputeMaxPerMonth, 3, ct);
        if (maxPerMonth > 0)
        {
            var since = DateTime.UtcNow.AddDays(-30);
            var recent = await _db.Disputes.CountAsync(d => d.BuyerId == userId && d.CreatedAt >= since, ct);
            if (recent >= maxPerMonth)
                throw new AppException($"Bạn đã mở {recent} tranh chấp trong 30 ngày (tối đa {maxPerMonth}). Vui lòng liên hệ hỗ trợ nếu cần.");
        }

        var sellerId = order.Lines.FirstOrDefault()?.SellerId ?? Guid.Empty;
        var slaHours = await _config.GetIntAsync(ConfigKeys.DisputeSlaHours, 72, ct);
        var dispute = new Dispute
        {
            Code = "DSP-" + DateTime.UtcNow.Ticks.ToString()[^7..],
            OrderId = order.Id,
            BuyerId = userId,
            SellerId = sellerId,
            Title = dto.Title,
            Body = dto.Body,
            Status = DisputeStatus.Open,
            SlaUntil = DateTime.UtcNow.AddHours(slaHours),
        };
        _db.Disputes.Add(dispute);
        order.Status = OrderStatus.Disputed;
        // hold escrow release
        order.EscrowReleaseAt = null;
        // initial message
        _db.DisputeMessages.Add(new DisputeMessage
        {
            DisputeId = dispute.Id,
            AuthorUserId = userId,
            AuthorRole = "Buyer",
            Body = dto.Body,
        });
        await _db.SaveChangesAsync(ct);
        return await GetDetailAsync(dispute.Id, userId, isAdmin: false, ct) ?? throw new AppException("Lỗi tạo tranh chấp");
    }

    public async Task<DisputeMessageDto> AddMessageAsync(Guid userId, Guid disputeId, DisputeMessageCreateDto dto, bool isAdmin, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(dto.Body)) throw new AppException("Nội dung trống");
        var dispute = await _db.Disputes.FirstOrDefaultAsync(d => d.Id == disputeId, ct)
            ?? throw new AppException("Không tìm thấy tranh chấp", 404);
        var role = "Buyer";
        if (isAdmin) role = "Admin";
        else if (dispute.SellerId != Guid.Empty)
        {
            var seller = await _db.Sellers.FirstOrDefaultAsync(s => s.Id == dispute.SellerId, ct);
            if (seller?.UserId == userId) role = "Seller";
        }
        if (!isAdmin && dispute.BuyerId != userId)
        {
            var sellerOk = await _db.Sellers.AnyAsync(s => s.Id == dispute.SellerId && s.UserId == userId, ct);
            if (!sellerOk) throw new AppException("Không có quyền", 403);
        }
        var msg = new DisputeMessage
        {
            DisputeId = disputeId,
            AuthorUserId = userId,
            AuthorRole = role,
            Body = dto.Body,
        };
        _db.DisputeMessages.Add(msg);
        if (dispute.Status == DisputeStatus.Open && role == "Admin") dispute.Status = DisputeStatus.Investigating;
        await _db.SaveChangesAsync(ct);
        var author = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        return new DisputeMessageDto(msg.Id, userId, author?.DisplayName ?? "User", role, msg.Body, msg.CreatedAt);
    }

    public async Task<DisputeListItemDto[]> ListMineAsync(Guid userId, CancellationToken ct)
    {
        var disputes = await _db.Disputes
            .Include(d => d.Order)
            .Where(d => d.BuyerId == userId).OrderByDescending(d => d.CreatedAt).ToListAsync(ct);
        return disputes.Select(MapList).ToArray();
    }

    public async Task<DisputeListItemDto[]> ListAllAsync(string? status, CancellationToken ct)
    {
        var query = _db.Disputes.Include(d => d.Order).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<DisputeStatus>(status, true, out var s))
            query = query.Where(d => d.Status == s);
        var disputes = await query.OrderByDescending(d => d.CreatedAt).ToListAsync(ct);
        return disputes.Select(MapList).ToArray();
    }

    public async Task<DisputeDetailDto?> GetDetailAsync(Guid disputeId, Guid userId, bool isAdmin, CancellationToken ct)
    {
        var dispute = await _db.Disputes.Include(d => d.Order).FirstOrDefaultAsync(d => d.Id == disputeId, ct);
        if (dispute == null) return null;
        if (!isAdmin)
        {
            var sellerOk = await _db.Sellers.AnyAsync(s => s.Id == dispute.SellerId && s.UserId == userId, ct);
            if (dispute.BuyerId != userId && !sellerOk) throw new AppException("Không có quyền", 403);
        }
        var messages = await _db.DisputeMessages.Include(m => m.Author).Where(m => m.DisputeId == disputeId).OrderBy(m => m.CreatedAt).ToListAsync(ct);
        return new DisputeDetailDto(
            dispute.Id, dispute.Code, dispute.OrderId, dispute.Order?.Code ?? "",
            dispute.BuyerId, dispute.SellerId, dispute.Title, dispute.Body,
            dispute.Status.ToString(), dispute.Resolution, dispute.SlaUntil, dispute.CreatedAt,
            messages.Select(m => new DisputeMessageDto(m.Id, m.AuthorUserId, m.Author?.DisplayName ?? "", m.AuthorRole, m.Body, m.CreatedAt)).ToArray());
    }

    public async Task<DisputeDetailDto> ResolveAsync(Guid adminUserId, Guid disputeId, DisputeResolveDto dto, CancellationToken ct)
    {
        var dispute = await _db.Disputes.Include(d => d.Order).ThenInclude(o => o!.Lines).FirstOrDefaultAsync(d => d.Id == disputeId, ct)
            ?? throw new AppException("Không tìm thấy tranh chấp", 404);
        if (dispute.Status == DisputeStatus.Resolved || dispute.Status == DisputeStatus.Closed)
            throw new AppException("Tranh chấp đã đóng");

        dispute.Status = DisputeStatus.Resolved;
        dispute.Resolution = dto.Resolution;

        var order = dispute.Order;
        var buyer = await _db.Users.FirstOrDefaultAsync(u => u.Id == dispute.BuyerId, ct);
        if (order != null && buyer != null)
        {
            switch (dto.Action)
            {
                case "refund_buyer":
                    buyer.WalletBalance += order.Total;
                    _db.WalletTxns.Add(new WalletTxn
                    {
                        UserId = buyer.Id,
                        Type = WalletTxnType.Refund,
                        Amount = order.Total,
                        Status = WalletTxnStatus.Completed,
                        Note = $"Hoàn tiền tranh chấp {dispute.Code} (đơn {order.Code})",
                        OrderId = order.Id,
                    });
                    order.Status = OrderStatus.Refunded;
                    AddAudit(adminUserId, "Admin", "dispute_refund_buyer", "Dispute", dispute.Code, order.Total,
                        $"Hoàn 100% cho buyer (đơn {order.Code})");
                    await _trust.OnDisputeLostAsync(dispute.SellerId, ct); // seller thua tranh chấp (P2.1)
                    break;
                case "release_seller":
                    order.Status = OrderStatus.Completed;
                    order.CompletedAt = DateTime.UtcNow;
                    AddAudit(adminUserId, "Admin", "dispute_release_seller", "Dispute", dispute.Code, order.Total,
                        $"Giải ngân cho seller (đơn {order.Code})");
                    break;
                case "partial_refund":
                    var pct = Math.Clamp(dto.RefundPercent ?? await _config.GetDecimalAsync(ConfigKeys.PartialRefundDefaultPercent, 50m, ct), 0m, 100m);
                    var refund = Math.Round(order.Total * pct / 100m, 0, MidpointRounding.AwayFromZero);
                    buyer.WalletBalance += refund;
                    _db.WalletTxns.Add(new WalletTxn
                    {
                        UserId = buyer.Id,
                        Type = WalletTxnType.Refund,
                        Amount = refund,
                        Status = WalletTxnStatus.Completed,
                        Note = $"Hoàn {pct:0.#}% tranh chấp {dispute.Code} (đơn {order.Code})",
                        OrderId = order.Id,
                    });
                    order.Status = OrderStatus.Completed;
                    order.CompletedAt = DateTime.UtcNow;
                    AddAudit(adminUserId, "Admin", "dispute_partial_refund", "Dispute", dispute.Code, refund,
                        $"Hoàn {pct:0.#}% cho buyer + giải ngân phần còn lại (đơn {order.Code})");
                    break;
                default:
                    throw new AppException("Action không hợp lệ");
            }
        }

        _db.DisputeMessages.Add(new DisputeMessage
        {
            DisputeId = dispute.Id,
            AuthorUserId = adminUserId,
            AuthorRole = "Admin",
            Body = $"Tranh chấp đã được giải quyết: {dto.Resolution} (Action: {dto.Action})",
        });

        await _db.SaveChangesAsync(ct);
        return await GetDetailAsync(disputeId, adminUserId, isAdmin: true, ct) ?? throw new AppException("Lỗi");
    }

    private static DisputeListItemDto MapList(Dispute d) => new(
        d.Id, d.Code, d.OrderId, d.Order?.Code ?? "", d.Title, d.Status.ToString(),
        d.CreatedAt, d.SlaUntil, d.Resolution);

    private void AddAudit(Guid? actorId, string actorRole, string action, string entityType, string? entityId, decimal? amount, string? detail)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorId,
            ActorRole = actorRole,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Amount = amount,
            Detail = detail,
        });
    }
}
