using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Auth;
using MmoMarket.Application.Common;
using MmoMarket.Application.Config;
using MmoMarket.Application.Coupons;
using MmoMarket.Application.Payments;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Orders;

public record CheckoutDto(string PaymentMethod, string? Note, string? CouponCode, string? TotpCode);
public record OrderLineDto(Guid Id, Guid ProductId, string Title, decimal UnitPrice, int Quantity, string Delivery, string[]? DeliveredItems);
public record OrderDto(
    Guid Id,
    string Code,
    string Status,
    string PaymentMethod,
    decimal Subtotal,
    decimal Discount,
    decimal Fee,
    decimal Total,
    DateTime CreatedAt,
    DateTime? PaidAt,
    DateTime? DeliverDueAt,
    DateTime? DeliveredAt,
    DateTime? EscrowReleaseAt,
    DateTime? CompletedAt,
    OrderLineDto[] Lines);

public class OrderService
{
    private readonly IAppDbContext _db;
    private readonly CouponService _coupon;
    private readonly ConfigService _config;
    private readonly TotpService _totp;
    private readonly Fees.FeeService _fee;
    private readonly Sellers.TrustScoreService _trust;
    private readonly IEncryptionService _enc;
    public OrderService(IAppDbContext db, CouponService coupon, ConfigService config, TotpService totp, Fees.FeeService fee, Sellers.TrustScoreService trust, IEncryptionService enc)
    { _db = db; _coupon = coupon; _config = config; _totp = totp; _fee = fee; _trust = trust; _enc = enc; }

    public async Task<OrderDto> CheckoutAsync(Guid userId, CheckoutDto dto, CancellationToken ct)
    {
        if (!Enum.TryParse<PaymentMethod>(dto.PaymentMethod, true, out var method))
            throw new AppException("Phương thức thanh toán không hợp lệ");

        var cartItems = await _db.CartItems
            .Include(c => c.Product)!.ThenInclude(p => p!.Seller)
            .Where(c => c.UserId == userId)
            .ToListAsync(ct);
        if (cartItems.Count == 0) throw new AppException("Giỏ hàng trống");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);

        var subtotal = cartItems.Sum(c => c.Product!.Price * c.Quantity);
        var fee = 0m;
        var discount = 0m;
        if (!string.IsNullOrWhiteSpace(dto.CouponCode))
        {
            var v = await _coupon.ValidateAsync(userId, dto.CouponCode, subtotal, ct);
            if (!v.Valid) throw new AppException(v.Error ?? "Mã giảm giá không hợp lệ");
            discount = v.Discount;
        }
        var total = subtotal - discount + fee;

        if (method == PaymentMethod.Wallet)
        {
            if (user.WalletBalance < total) throw new AppException("Số dư ví không đủ");
            if (user.TwoFactorEnabled)
            {
                if (string.IsNullOrWhiteSpace(dto.TotpCode))
                    throw new AppException("Tài khoản đã bật bảo mật 2 lớp. Vui lòng nhập mã xác thực.", 403);
                if (!_totp.Verify(user.TotpSecret!, dto.TotpCode))
                    throw new AppException("Mã xác thực 2FA không đúng hoặc đã hết hạn.", 400);
            }
        }

        var order = new Order
        {
            Code = "MMK-" + DateTime.UtcNow.Ticks.ToString()[^7..],
            BuyerId = userId,
            Status = method == PaymentMethod.Wallet ? OrderStatus.EscrowLocked : OrderStatus.PendingPayment,
            PaymentMethod = method,
            Subtotal = subtotal,
            Discount = discount,
            Fee = fee,
            Total = total,
            Note = dto.Note,
            PaidAt = method == PaymentMethod.Wallet ? DateTime.UtcNow : null,
        };

        foreach (var c in cartItems)
        {
            var p = c.Product!;
            order.Lines.Add(new OrderLine
            {
                ProductId = p.Id,
                SellerId = p.SellerId,
                Title = p.Title,
                UnitPrice = p.Price,
                Quantity = c.Quantity,
                Delivery = p.Delivery,
            });
        }

        _db.Orders.Add(order);

        if (method == PaymentMethod.Wallet)
        {
            user.WalletBalance -= total;
            _db.WalletTxns.Add(new WalletTxn
            {
                UserId = userId,
                Type = WalletTxnType.Purchase,
                Amount = -total,
                Status = WalletTxnStatus.Completed,
                Note = $"Thanh toán đơn {order.Code}",
                OrderId = order.Id,
            });
            AddAudit(userId, "Buyer", "wallet_purchase", "Order", order.Code, total,
                $"Thanh toán đơn {order.Code} bằng ví, lock vào escrow");
            await ProcessPaidOrderAsync(order, ct);
        }

        _db.CartItems.RemoveRange(cartItems);
        await _db.SaveChangesAsync(ct);

        if (!string.IsNullOrWhiteSpace(dto.CouponCode))
            await _coupon.RecordUsageAsync(userId, dto.CouponCode, order.Id, ct);

        return await GetByIdInternalAsync(order.Id, ct) ?? throw new AppException("Lỗi tạo đơn");
    }

    public async Task<OrderDto> SimulatePayAsync(Guid userId, Guid orderId, CancellationToken ct)
    {
        var order = await _db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == orderId && o.BuyerId == userId, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != OrderStatus.PendingPayment) throw new AppException("Đơn không cần thanh toán");
        order.Status = OrderStatus.EscrowLocked;
        order.PaidAt = DateTime.UtcNow;
        await ProcessPaidOrderAsync(order, ct);
        await _db.SaveChangesAsync(ct);
        return await GetByIdInternalAsync(order.Id, ct)!;
    }

    private async Task ProcessPaidOrderAsync(Order order, CancellationToken ct)
    {
        // Bàn giao tự động từ kho theo từng dòng:
        //  • Auto   → phải đủ hàng trong kho, thiếu thì chặn thanh toán.
        //  • Hybrid → lấy được bao nhiêu trong kho thì giao ngay bấy nhiêu, phần thiếu chuyển sang chờ giao tay.
        //  • Manual → luôn chờ seller giao tay.
        var consumedFromStock = new Dictionary<Guid, int>();
        foreach (var line in order.Lines)
        {
            consumedFromStock[line.Id] = 0;
            if (line.Delivery == DeliveryMethod.Manual) continue;

            // Lấy tối đa `Quantity` item còn trong kho (chưa bán, chưa giữ chỗ) theo FIFO.
            var stock = await _db.InventoryItems
                .Where(i => i.ProductId == line.ProductId && !i.Sold && !i.Reserved)
                .OrderBy(i => i.CreatedAt)
                .Take(line.Quantity)
                .ToListAsync(ct);
            if (line.Delivery == DeliveryMethod.Auto && stock.Count < line.Quantity)
                throw new AppException($"Sản phẩm \"{line.Title}\" không đủ hàng trong kho auto-deliver (còn {stock.Count}/{line.Quantity}).");

            foreach (var item in stock)
            {
                item.Sold = true;
                item.OrderId = order.Id;
            }
            // Bàn giao chính nội dung kho (đã giải mã), KHÔNG sinh dữ liệu giả.
            if (stock.Count > 0)
                line.DeliveredItemsJson = JsonSerializer.Serialize(stock.Select(i => _enc.Decrypt(i.EncryptedPayload)).ToArray());
            consumedFromStock[line.Id] = stock.Count;
        }

        if (order.Lines.All(IsLineFullyDelivered))
        {
            // Mọi dòng đã giao đủ ngay khi thanh toán → vào cửa sổ kiểm tra của buyer (Checking).
            order.Status = OrderStatus.Checking;
            order.DeliveredAt = DateTime.UtcNow;
            order.EscrowReleaseAt = await GetEscrowReleaseAtAsync(ct);
        }
        else
        {
            // Còn dòng chờ giao tay (Manual, hoặc Hybrid hụt kho) → chờ seller trong cửa sổ T+N giờ.
            order.Status = OrderStatus.Delivering;
            order.DeliverDueAt = await GetDeliverDueAtAsync(ct);
        }
        // Update sold counters, loyalty & tính phí sàn (khóa tại thời điểm thanh toán)
        foreach (var line in order.Lines)
        {
            var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == line.ProductId, ct);
            if (product != null)
            {
                product.Sold += line.Quantity;
                // Manual: trừ tồn theo số đã bán; Auto/Hybrid: chỉ trừ đúng số item thực sự lấy khỏi kho.
                var decrement = line.Delivery == DeliveryMethod.Manual ? line.Quantity : consumedFromStock[line.Id];
                product.Stock = Math.Max(0, product.Stock - decrement);
            }
            var seller = await _db.Sellers.FirstOrDefaultAsync(s => s.Id == line.SellerId, ct);
            if (seller != null) seller.TotalSold += line.Quantity;

            var categorySlug = product?.CategorySlug ?? "";
            var rate = await _fee.GetEffectiveRateAsync(categorySlug, line.UnitPrice, line.SellerId, ct);
            line.FeeAmount = Math.Round(line.UnitPrice * line.Quantity * rate, 0, MidpointRounding.AwayFromZero);
        }
        order.Fee = order.Lines.Sum(l => l.FeeAmount);
        var buyer = await _db.Users.FirstOrDefaultAsync(u => u.Id == order.BuyerId, ct);
        if (buyer != null)
        {
            var ptsRate = await _config.GetIntAsync(ConfigKeys.LoyaltyPtsPer1000, 1, ct);
            buyer.LoyaltyPoints += (int)(order.Total / 1000) * ptsRate;
        }
    }

    public async Task<OrderDto[]> GetMyOrdersAsync(Guid userId, string? status, CancellationToken ct)
    {
        var query = _db.Orders.Include(o => o.Lines).Where(o => o.BuyerId == userId);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OrderStatus>(status, true, out var s))
            query = query.Where(o => o.Status == s);
        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
        return orders.Select(Map).ToArray();
    }

    public async Task<OrderDto?> GetByIdAsync(Guid userId, Guid id, CancellationToken ct)
    {
        var order = await _db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id && o.BuyerId == userId, ct);
        return order == null ? null : Map(order);
    }

    private async Task<OrderDto?> GetByIdInternalAsync(Guid id, CancellationToken ct)
    {
        var order = await _db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id, ct);
        return order == null ? null : Map(order);
    }

    // So khớp số tiền VND (làm tròn về đồng) — chống xác nhận đơn khi số tiền thực trả không đúng.
    private static bool AmountsMatch(decimal a, decimal b) => (long)Math.Round(a) == (long)Math.Round(b);

    // Idempotent: called by MoMo / ZaloPay / VNPay / SePay IPN to mark an external payment as paid.
    // paidAmount: số tiền cổng báo đã thu (null = bỏ qua kiểm tra, chỉ dùng khi đã verify nơi khác).
    public async Task<bool> ConfirmExternalPaymentAsync(Guid orderId, decimal? paidAmount, CancellationToken ct)
    {
        var order = await _db.Orders.Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order == null) return false;
        if (order.Status != OrderStatus.PendingPayment) return true; // already confirmed
        if (paidAmount.HasValue && !AmountsMatch(paidAmount.Value, order.Total))
        {
            AddAudit(order.BuyerId, "Buyer", "external_payment_amount_mismatch", "Order", order.Code, paidAmount.Value,
                $"Số tiền thanh toán ngoài ({paidAmount.Value:N0}đ) khác tổng đơn {order.Code} ({order.Total:N0}đ) — KHÔNG xác nhận.");
            await _db.SaveChangesAsync(ct);
            return false;
        }

        order.Status = OrderStatus.EscrowLocked;
        order.PaidAt = DateTime.UtcNow;
        AddAudit(order.BuyerId, "Buyer", "external_payment_confirmed", "Order", order.Code, order.Total,
            $"Xác nhận thanh toán ngoài ({order.PaymentMethod}) cho đơn {order.Code}");
        await ProcessPaidOrderAsync(order, ct);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // Called by SePay IPN: extract MMK-XXXXXXX from transfer note, then confirm matching VietQR order.
    public async Task<bool> ConfirmExternalPaymentByTransferNoteAsync(string content, decimal? paidAmount, CancellationToken ct)
    {
        var match = Regex.Match(content ?? "", @"MMK-\d{7}", RegexOptions.IgnoreCase);
        if (!match.Success) return false;

        var orderCode = match.Value.ToUpper();
        var order = await _db.Orders.Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Code == orderCode
                && o.Status == OrderStatus.PendingPayment
                && o.PaymentMethod == PaymentMethod.VietQr, ct);
        if (order == null) return false;
        if (paidAmount.HasValue && !AmountsMatch(paidAmount.Value, order.Total))
        {
            AddAudit(order.BuyerId, "Buyer", "external_payment_amount_mismatch", "Order", order.Code, paidAmount.Value,
                $"Số tiền chuyển khoản ({paidAmount.Value:N0}đ) khác tổng đơn {order.Code} ({order.Total:N0}đ) — KHÔNG xác nhận.");
            await _db.SaveChangesAsync(ct);
            return false;
        }

        order.Status = OrderStatus.EscrowLocked;
        order.PaidAt = DateTime.UtcNow;
        AddAudit(order.BuyerId, "Buyer", "external_payment_confirmed", "Order", order.Code, order.Total,
            $"Xác nhận chuyển khoản (VietQR) cho đơn {order.Code}");
        await ProcessPaidOrderAsync(order, ct);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    // Sinh invoice SePay DUY NHẤT cho mỗi lần thanh toán (SePay yêu cầu order_invoice_number không trùng).
    // Lần đầu = mã đơn; lần thanh toán lại = "{Code}-{n}". Lưu vào PaymentTransaction để reconcile/check tra lại.
    public async Task<string> NewSePayInvoiceAsync(Guid userId, Guid orderId, CancellationToken ct)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.BuyerId == userId, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != OrderStatus.PendingPayment)
            throw new AppException("Đơn không ở trạng thái chờ thanh toán");

        var attempts = await _db.PaymentTransactions.CountAsync(
            p => p.OrderId == orderId && p.Provider == "sepay-init", ct);
        var invoice = attempts == 0 ? order.Code : $"{order.Code}-{attempts + 1}";
        _db.PaymentTransactions.Add(new PaymentTransaction
        {
            OrderId = orderId, Method = PaymentMethod.VietQr, Provider = "sepay-init",
            ProviderTxnId = invoice, Amount = order.Total, Status = "initiated",
        });
        await _db.SaveChangesAsync(ct);
        return invoice;
    }

    // Mọi invoice SePay đã phát cho đơn (mới nhất trước); fallback mã đơn nếu chưa từng init.
    public async Task<List<string>> SePayInvoicesAsync(Guid orderId, string orderCode, CancellationToken ct)
    {
        var list = await _db.PaymentTransactions
            .Where(p => p.OrderId == orderId && p.Provider == "sepay-init")
            .OrderByDescending(p => p.CreatedAt)
            .Take(5)
            .Select(p => p.ProviderTxnId)
            .ToListAsync(ct);
        if (list.Count == 0) list.Add(orderCode);
        return list;
    }

    // Đối soát các đơn VietQR(SePay) đang chờ thanh toán với cổng SePay rồi xác nhận đơn đã CAPTURED.
    // Dùng cho worker nền (userId = null) và trang đơn hàng (userId cụ thể) — không phụ thuộc modal client.
    public async Task<int> ReconcilePendingSePayAsync(SePayPgService sepay, Guid? userId, CancellationToken ct)
    {
        if (!sepay.Enabled) return 0;
        var since = DateTime.UtcNow.AddHours(-2);
        var query = _db.Orders
            .Where(o => o.Status == OrderStatus.PendingPayment
                && o.PaymentMethod == PaymentMethod.VietQr && o.CreatedAt >= since);
        if (userId.HasValue) query = query.Where(o => o.BuyerId == userId.Value);
        var pending = await query.OrderByDescending(o => o.CreatedAt).Take(100)
            .Select(o => new { o.Id, o.Code }).ToListAsync(ct);

        var confirmed = 0;
        foreach (var o in pending)
        {
            // Một đơn có thể có nhiều invoice (thanh toán nhiều lần) — kiểm tra tất cả, xác nhận nếu có cái nào CAPTURED.
            foreach (var invoice in await SePayInvoicesAsync(o.Id, o.Code, ct))
            {
                var st = await sepay.GetOrderStatusAsync(invoice, ct);
                if (st.Found && SePayPgService.IsPaid(st.Status))
                {
                    if (await ConfirmExternalPaymentAsync(o.Id, st.Amount, ct)) confirmed++;
                    break;
                }
            }
        }
        return confirmed;
    }

    // Tự huỷ đơn còn "Chờ thanh toán" quá hạn (gọi SAU reconcile để không huỷ nhầm đơn đã trả).
    private static readonly TimeSpan PendingPaymentTtl = TimeSpan.FromMinutes(30);
    public async Task<int> CancelStalePendingPaymentAsync(CancellationToken ct)
    {
        var cutoff = DateTime.UtcNow - PendingPaymentTtl;
        var stale = await _db.Orders
            .Where(o => o.Status == OrderStatus.PendingPayment && o.CreatedAt < cutoff)
            .Take(200)
            .ToListAsync(ct);
        if (stale.Count == 0) return 0;
        foreach (var o in stale)
        {
            o.Status = OrderStatus.Cancelled;
            await _coupon.ReleaseUsageByOrderAsync(o.Id, ct); // hoàn lượt coupon (nếu có) — chưa SaveChanges
            AddAudit(o.BuyerId, "Buyer", "order_payment_timeout", "Order", o.Code, o.Total,
                $"Tự huỷ đơn {o.Code} do quá hạn chưa thanh toán");
        }
        await _db.SaveChangesAsync(ct);
        return stale.Count;
    }

    public async Task<OrderDto> ConfirmReceivedAsync(Guid userId, Guid id, CancellationToken ct)
    {
        var order = await _db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id && o.BuyerId == userId, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != OrderStatus.Checking) throw new AppException("Chỉ xác nhận đơn đã giao đang chờ kiểm tra");
        order.Status = OrderStatus.Completed;
        order.CompletedAt = DateTime.UtcNow;
        AddAudit(userId, "Buyer", "buyer_confirm_received", "Order", order.Code, order.Total,
            $"Buyer xác nhận nhận hàng, giải ngân đơn {order.Code}");
        await _trust.OnOrderCompletedSellersAsync(order.Lines.Select(l => l.SellerId), ct);
        await RewardAffiliateAsync(order, ct);
        await _db.SaveChangesAsync(ct);
        return Map(order);
    }

    // ── Background jobs (gọi bởi OrderEscrowWorker) ──────────────────────────────

    /// <summary>Tự động giải ngân các đơn ở Checking đã hết hạn kiểm tra (EscrowReleaseAt &lt;= now).</summary>
    public async Task<int> AutoReleaseEscrowAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var due = await _db.Orders
            .Include(o => o.Lines)
            .Where(o => o.Status == OrderStatus.Checking && o.EscrowReleaseAt != null && o.EscrowReleaseAt <= now)
            .ToListAsync(ct);
        if (due.Count == 0) return 0;
        foreach (var order in due)
        {
            order.Status = OrderStatus.Completed;
            order.CompletedAt = now;
            AddAudit(null, "System", "escrow_auto_release", "Order", order.Code, order.Total,
                $"Tự động giải ngân đơn {order.Code} sau khi hết hạn kiểm tra");
            await _trust.OnOrderCompletedSellersAsync(order.Lines.Select(l => l.SellerId), ct);
            await RewardAffiliateAsync(order, ct);
        }
        await _db.SaveChangesAsync(ct);
        return due.Count;
    }

    /// <summary>Tự động hủy + hoàn 100% các đơn seller không bàn giao đúng hạn (DeliverDueAt &lt;= now).</summary>
    public async Task<int> AutoCancelStaleAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var stale = await _db.Orders.Include(o => o.Lines)
            .Where(o => (o.Status == OrderStatus.EscrowLocked || o.Status == OrderStatus.Delivering)
                && o.DeliverDueAt != null && o.DeliverDueAt <= now)
            .ToListAsync(ct);
        if (stale.Count == 0) return 0;
        var buyerIds = stale.Select(o => o.BuyerId).Distinct().ToList();
        var buyers = await _db.Users.Where(u => buyerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);
        foreach (var order in stale)
        {
            order.Status = OrderStatus.Cancelled;
            if (buyers.TryGetValue(order.BuyerId, out var buyer))
            {
                buyer.WalletBalance += order.Total;
                _db.WalletTxns.Add(new WalletTxn
                {
                    UserId = buyer.Id,
                    Type = WalletTxnType.Refund,
                    Amount = order.Total,
                    Status = WalletTxnStatus.Completed,
                    Note = $"Hoàn tiền 100% đơn {order.Code} (seller không bàn giao đúng hạn)",
                    OrderId = order.Id,
                });
            }
            AddAudit(null, "System", "auto_cancel_refund", "Order", order.Code, order.Total,
                $"Tự động hủy + hoàn 100% đơn {order.Code} do seller trễ bàn giao");

            // Tịch thu cọc đăng tin của sản phẩm liên quan (P1.4)
            foreach (var line in order.Lines)
            {
                var product = await _db.Products.FirstOrDefaultAsync(p => p.Id == line.ProductId, ct);
                if (product != null && product.DepositStatus == ListingDepositStatus.Held && product.DepositAmount > 0)
                {
                    product.DepositStatus = ListingDepositStatus.Forfeited;
                    AddAudit(null, "System", "listing_deposit_forfeit", "Product", product.Slug, product.DepositAmount,
                        $"Tịch thu cọc đăng tin {product.Title} do trễ bàn giao đơn {order.Code}");
                }
            }
            // Trừ trust score seller do trễ bàn giao (P2.1)
            foreach (var sid in order.Lines.Select(l => l.SellerId).Distinct())
                await _trust.OnLateDeliveryAsync(sid, ct);
        }
        await _db.SaveChangesAsync(ct);
        return stale.Count;
    }

    private async Task<DateTime> GetEscrowReleaseAtAsync(CancellationToken ct)
    {
        var days = await _config.GetIntAsync(ConfigKeys.EscrowReleaseDays, 2, ct); // mặc định 48h
        return DateTime.UtcNow.AddDays(days);
    }

    private async Task<DateTime> GetDeliverDueAtAsync(CancellationToken ct)
    {
        var hours = await _config.GetIntAsync(ConfigKeys.DeliverWindowHours, 2, ct); // mặc định T+2h
        return DateTime.UtcNow.AddHours(hours);
    }

    /// <summary>Trả hoa hồng giới thiệu (affiliate) cho người giới thiệu khi buyer hoàn tất giao dịch ĐẦU TIÊN (§3.4).</summary>
    private async Task RewardAffiliateAsync(Order order, CancellationToken ct)
    {
        var buyer = await _db.Users.FirstOrDefaultAsync(u => u.Id == order.BuyerId, ct);
        if (buyer == null || buyer.ReferredByUserId == null || buyer.AffiliateRewarded) return;
        buyer.AffiliateRewarded = true; // chỉ thưởng 1 lần (kể cả khi hoa hồng = 0)
        var pct = await _config.GetDecimalAsync(ConfigKeys.AffiliatePercent, 30m, ct);
        var commission = Math.Round(order.Fee * pct / 100m, 0, MidpointRounding.AwayFromZero);
        if (commission <= 0) return;
        var referrer = await _db.Users.FirstOrDefaultAsync(u => u.Id == buyer.ReferredByUserId, ct);
        if (referrer == null) return;
        referrer.WalletBalance += commission;
        _db.WalletTxns.Add(new WalletTxn
        {
            UserId = referrer.Id, Type = WalletTxnType.Commission, Amount = commission,
            Status = WalletTxnStatus.Completed, Note = $"Hoa hồng giới thiệu {buyer.Username} (đơn {order.Code})", OrderId = order.Id,
        });
        AddAudit(null, "System", "affiliate_commission", "User", referrer.Id.ToString(), commission,
            $"Hoa hồng giới thiệu lần đầu của {buyer.Username} (đơn {order.Code})");
    }

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

    /// <summary>Một dòng coi như đã giao đủ: Hybrid cần số item bàn giao ≥ số lượng; Auto/Manual chỉ cần có nội dung bàn giao.</summary>
    public static bool IsLineFullyDelivered(OrderLine line) =>
        line.Delivery == DeliveryMethod.Hybrid
            ? DeliveredItemCount(line.DeliveredItemsJson) >= line.Quantity
            : !string.IsNullOrWhiteSpace(line.DeliveredItemsJson);

    /// <summary>Đếm số item đã bàn giao từ JSON mảng. Chuỗi không phải mảng coi như 1 item.</summary>
    public static int DeliveredItemCount(string? deliveredItemsJson)
    {
        if (string.IsNullOrWhiteSpace(deliveredItemsJson)) return 0;
        try { return JsonSerializer.Deserialize<string[]>(deliveredItemsJson)?.Length ?? 0; }
        catch { return 1; }
    }

    public static OrderDto Map(Order o) => new(
        o.Id, o.Code, o.Status.ToString(), o.PaymentMethod.ToString(),
        o.Subtotal, o.Discount, o.Fee, o.Total,
        o.CreatedAt, o.PaidAt, o.DeliverDueAt, o.DeliveredAt, o.EscrowReleaseAt, o.CompletedAt,
        o.Lines.Select(l => new OrderLineDto(
            l.Id, l.ProductId, l.Title, l.UnitPrice, l.Quantity, l.Delivery.ToString(),
            ParseDeliveredItems(l.DeliveredItemsJson))).ToArray());

    /// <summary>Tách JSON mảng nội dung đã bàn giao thành string[] cho client. Chuỗi không phải mảng coi như 1 item.</summary>
    private static string[]? ParseDeliveredItems(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<string[]>(json); }
        catch { return new[] { json }; }
    }
}
