using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Common;
using MmoMarket.Application.Payments;
using MmoMarket.Application.Wallet;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/wallet")]
public class WalletController : ControllerBase
{
    private readonly WalletService _svc;
    private readonly WalletTopupService _topup;
    private readonly MoMoService _momo;
    private readonly ZaloPayService _zalo;
    private readonly VNPayService _vnpay;
    private readonly SePayPgService _sepay;
    private readonly UsdtService _usdt;
    private readonly ICurrentUser _user;

    public WalletController(
        WalletService svc, WalletTopupService topup,
        MoMoService momo, ZaloPayService zalo, VNPayService vnpay, SePayPgService sepay, UsdtService usdt,
        ICurrentUser user)
    { _svc = svc; _topup = topup; _momo = momo; _zalo = zalo; _vnpay = vnpay; _sepay = sepay; _usdt = usdt; _user = user; }

    private Guid Uid => _user.UserId ?? throw new AppException("Unauthorized", 401);

    [HttpGet]
    public Task<WalletStateDto> Get(CancellationToken ct) => _svc.GetAsync(Uid, ct);

    // Tạo giao dịch nạp ở trạng thái chờ — ví chỉ được cộng sau khi cổng thanh toán xác nhận.
    [HttpPost("topup")]
    public Task<TopupIntentDto> Topup([FromBody] CreateTopupDto dto, CancellationToken ct)
        => _topup.CreateIntentAsync(Uid, dto, ct);

    // Polling trạng thái cho modal thanh toán.
    [HttpGet("topup/{id:guid}")]
    public Task<TopupStatusDto> TopupStatus(Guid id, CancellationToken ct)
        => _topup.GetStatusAsync(Uid, id, ct);

    /// <summary>
    /// Đối soát các giao dịch nạp đang chờ với cổng SePay rồi cộng ví cho những đơn đã CAPTURED.
    /// Trang ví gọi định kỳ — đảm bảo nạp được xác nhận kể cả khi modal đã đóng / hết giờ.
    /// </summary>
    [HttpPost("topup/reconcile")]
    public async Task<WalletStateDto> ReconcileTopups(CancellationToken ct)
    {
        await _topup.ReconcileForUserAsync(Uid, ct);
        return await _svc.GetAsync(Uid, ct);
    }

    /// <summary>Người mua bấm "Huỷ giao dịch" ở trang SePay → đánh dấu lần nạp về Đã huỷ.</summary>
    [HttpPost("topup/cancel")]
    public async Task<WalletStateDto> CancelTopup([FromBody] CancelTopupDto dto, CancellationToken ct)
    {
        await _topup.CancelByCodeAsync(Uid, dto.Code ?? "", ct);
        return await _svc.GetAsync(Uid, ct);
    }

    // "VietQR / Chuyển khoản" nạp ví giờ dùng cổng SePay thật.
    [HttpPost("topup/{id:guid}/vietqr-pay")]
    public async Task<SePayCheckoutResult> TopupVietQr(Guid id, CancellationToken ct)
    {
        var t = await _topup.GetPendingForUserAsync(Uid, id, ct);
        if (!_sepay.Enabled) throw new AppException("Cổng thanh toán SePay chưa được cấu hình");
        var code = WalletTopupService.ExtractCode(t.Note);
        return _sepay.BuildCheckout(code, t.Amount, $"Nap vi MMO {code}", "BANK_TRANSFER", "/account/wallet");
    }

    /// <summary>Modal poll endpoint: tra trạng thái nạp ở SePay, tự cộng ví nếu CAPTURED.</summary>
    [HttpPost("topup/{id:guid}/sepay-check")]
    public async Task<IActionResult> TopupSePayCheck(Guid id, CancellationToken ct)
    {
        var t = await _topup.GetTxnForUserAsync(Uid, id, ct);
        if (t.Status != WalletTxnStatus.Pending)
            return Ok(new { done = true, status = t.Status == WalletTxnStatus.Completed ? "Completed" : "FAILED" });

        var code = WalletTopupService.ExtractCode(t.Note);
        var st = await _sepay.GetOrderStatusAsync(code, ct);
        if (st.Found && SePayPgService.IsPaid(st.Status))
        {
            if (await _topup.ConfirmByIdAsync(t.Id, st.Amount, ct))
                return Ok(new { done = true, status = "CAPTURED" });
            return Ok(new { done = false, status = "AMOUNT_MISMATCH" });
        }
        return Ok(new { done = false, status = st.Status });
    }

    [HttpPost("topup/{id:guid}/momo-pay")]
    public async Task<MoMoPayResult> TopupMomo(Guid id, CancellationToken ct)
    {
        var t = await _topup.GetPendingForUserAsync(Uid, id, ct);
        return await _momo.CreatePaymentAsync(t.Id, t.Amount, WalletTopupService.ExtractCode(t.Note), _momo.WalletReturnUrl);
    }

    [HttpPost("topup/{id:guid}/zalopay-pay")]
    public async Task<ZaloPayResult> TopupZalo(Guid id, CancellationToken ct)
    {
        var t = await _topup.GetPendingForUserAsync(Uid, id, ct);
        return await _zalo.CreatePaymentAsync(t.Id, t.Amount, WalletTopupService.ExtractCode(t.Note), _zalo.WalletReturnUrl);
    }

    [HttpPost("topup/{id:guid}/vnpay-pay")]
    public async Task<VNPayResult> TopupVnpay(Guid id, CancellationToken ct)
    {
        var t = await _topup.GetPendingForUserAsync(Uid, id, ct);
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        return _vnpay.CreatePaymentUrl(t.Id, t.Amount, WalletTopupService.ExtractCode(t.Note), ip, _vnpay.WalletReturnUrl);
    }

    [HttpPost("topup/{id:guid}/usdt-pay")]
    public async Task<UsdtPayResult> TopupUsdt(Guid id, CancellationToken ct)
    {
        var t = await _topup.GetPendingForUserAsync(Uid, id, ct);
        return _usdt.GeneratePaymentInfo(t.Id, t.Amount, WalletTopupService.ExtractCode(t.Note));
    }

    /// <summary>
    /// Quét TronGrid và tự cộng ví nếu tìm thấy giao dịch USDT khớp. Modal USDT poll endpoint này (~30s).
    /// </summary>
    [HttpPost("topup/{id:guid}/usdt-check")]
    public async Task<IActionResult> TopupUsdtCheck(Guid id, CancellationToken ct)
    {
        var t = await _topup.GetTxnForUserAsync(Uid, id, ct);
        if (t.Status != WalletTxnStatus.Pending)
            return Ok(new { found = false, alreadyPaid = true });

        var found = await _usdt.CheckTransactionAsync(t.Id, t.Amount, t.CreatedAt, ct);
        if (found)
            await _topup.ConfirmByIdAsync(t.Id, null, ct); // số tiền USDT đã khớp on-chain ở CheckTransactionAsync

        return Ok(new { found });
    }
}
