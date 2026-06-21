using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Common;
using MmoMarket.Application.Orders;
using MmoMarket.Application.Payments;

namespace MmoMarket.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/orders")]
public class OrderController : ControllerBase
{
    private readonly OrderService  _svc;
    private readonly MoMoService   _momo;
    private readonly ZaloPayService _zalo;
    private readonly VNPayService  _vnpay;
    private readonly SePayPgService _sepay;
    private readonly UsdtService   _usdt;
    private readonly ICurrentUser  _user;

    public OrderController(
        OrderService svc, MoMoService momo, ZaloPayService zalo,
        VNPayService vnpay, SePayPgService sepay, UsdtService usdt, ICurrentUser user)
    { _svc = svc; _momo = momo; _zalo = zalo; _vnpay = vnpay; _sepay = sepay; _usdt = usdt; _user = user; }

    private Guid Uid => _user.UserId ?? throw new AppException("Unauthorized", 401);

    [HttpPost("checkout")]
    public Task<OrderDto> Checkout([FromBody] CheckoutDto dto, CancellationToken ct) => _svc.CheckoutAsync(Uid, dto, ct);

    [HttpPost("{id:guid}/pay")]
    public Task<OrderDto> Pay(Guid id, CancellationToken ct) => _svc.SimulatePayAsync(Uid, id, ct);

    [HttpPost("{id:guid}/momo-pay")]
    public async Task<MoMoPayResult> MomoPay(Guid id, CancellationToken ct)
    {
        var order = await _svc.GetByIdAsync(Uid, id, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != "PendingPayment") throw new AppException("Đơn không ở trạng thái chờ thanh toán");
        return await _momo.CreatePaymentAsync(id, order.Total, order.Code);
    }

    /// <summary>Modal poll endpoint: tra trạng thái đơn ở MoMo (query API), tự xác nhận nếu đã thu tiền.</summary>
    [HttpPost("{id:guid}/momo-check")]
    public async Task<IActionResult> MomoCheck(Guid id, CancellationToken ct)
    {
        var order = await _svc.GetByIdAsync(Uid, id, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != "PendingPayment") return Ok(new { done = true, status = order.Status });

        var q = await _momo.QueryTransactionAsync(id, ct);
        if (q.Found && q.Paid)
        {
            if (await _svc.ConfirmExternalPaymentAsync(id, q.Amount, ct))
                return Ok(new { done = true, status = "CAPTURED" });
            return Ok(new { done = false, status = "AMOUNT_MISMATCH" });
        }
        return Ok(new { done = false, status = "PENDING" });
    }

    [HttpPost("{id:guid}/zalopay-pay")]
    public async Task<ZaloPayResult> ZaloPayPay(Guid id, CancellationToken ct)
    {
        var order = await _svc.GetByIdAsync(Uid, id, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != "PendingPayment") throw new AppException("Đơn không ở trạng thái chờ thanh toán");
        return await _zalo.CreatePaymentAsync(id, order.Total, order.Code);
    }

    // "VietQR / Chuyển khoản" giờ dùng cổng SePay thật: trả về form để client submit sang trang SePay.
    [HttpPost("{id:guid}/vietqr-pay")]
    public async Task<SePayCheckoutResult> VietQrPay(Guid id, CancellationToken ct)
    {
        var order = await _svc.GetByIdAsync(Uid, id, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != "PendingPayment") throw new AppException("Đơn không ở trạng thái chờ thanh toán");
        if (!_sepay.Enabled) throw new AppException("Cổng thanh toán SePay chưa được cấu hình");
        var invoice = await _svc.NewSePayInvoiceAsync(Uid, id, ct); // invoice duy nhất mỗi lần (tránh trùng)
        return _sepay.BuildCheckout(invoice, order.Total, $"Thanh toan don hang {order.Code}", "BANK_TRANSFER", "/account/orders");
    }

    /// <summary>Modal poll endpoint: tra trạng thái đơn ở SePay (mọi invoice đã phát), tự xác nhận nếu CAPTURED.</summary>
    [HttpPost("{id:guid}/sepay-check")]
    public async Task<IActionResult> SePayCheck(Guid id, CancellationToken ct)
    {
        var order = await _svc.GetByIdAsync(Uid, id, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != "PendingPayment") return Ok(new { done = true, status = order.Status });

        foreach (var invoice in await _svc.SePayInvoicesAsync(order.Id, order.Code, ct))
        {
            var st = await _sepay.GetOrderStatusAsync(invoice, ct);
            if (st.Found && SePayPgService.IsPaid(st.Status))
            {
                if (await _svc.ConfirmExternalPaymentAsync(id, st.Amount, ct))
                    return Ok(new { done = true, status = "CAPTURED" });
                return Ok(new { done = false, status = "AMOUNT_MISMATCH" });
            }
        }
        return Ok(new { done = false, status = "PENDING" });
    }

    [HttpPost("{id:guid}/vnpay-pay")]
    public async Task<VNPayResult> VNPayPay(Guid id, CancellationToken ct)
    {
        var order = await _svc.GetByIdAsync(Uid, id, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != "PendingPayment") throw new AppException("Đơn không ở trạng thái chờ thanh toán");
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        return _vnpay.CreatePaymentUrl(id, order.Total, order.Code, ip);
    }

    [HttpPost("{id:guid}/usdt-pay")]
    public async Task<UsdtPayResult> UsdtPay(Guid id, CancellationToken ct)
    {
        var order = await _svc.GetByIdAsync(Uid, id, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.Status != "PendingPayment") throw new AppException("Đơn không ở trạng thái chờ thanh toán");
        return _usdt.GeneratePaymentInfo(id, order.Total, order.Code);
    }

    /// <summary>
    /// Client calls this to trigger a TronGrid scan and auto-confirm if matching USDT tx is found.
    /// Designed for polling from the USDT payment modal (every ~30 s).
    /// </summary>
    [HttpPost("{id:guid}/usdt-check")]
    public async Task<IActionResult> UsdtCheck(Guid id, CancellationToken ct)
    {
        var order = await _svc.GetByIdAsync(Uid, id, ct)
            ?? throw new AppException("Không tìm thấy đơn", 404);
        if (order.PaymentMethod != "Usdt")
            return BadRequest(new { found = false, error = "Not a USDT order" });
        if (order.Status != "PendingPayment")
            return Ok(new { found = false, alreadyPaid = true });

        var found = await _usdt.CheckTransactionAsync(id, order.Total, order.CreatedAt, ct);
        if (found)
            await _svc.ConfirmExternalPaymentAsync(id, null, ct); // số tiền USDT đã khớp on-chain ở CheckTransactionAsync

        return Ok(new { found });
    }

    [HttpPost("{id:guid}/confirm")]
    public Task<OrderDto> Confirm(Guid id, CancellationToken ct) => _svc.ConfirmReceivedAsync(Uid, id, ct);

    /// <summary>Đối soát các đơn VietQR/SePay đang chờ thanh toán của user rồi trả danh sách mới.</summary>
    [HttpPost("reconcile")]
    public async Task<OrderDto[]> Reconcile([FromQuery] string? status, CancellationToken ct)
    {
        await _svc.ReconcilePendingSePayAsync(_sepay, Uid, ct);
        return await _svc.GetMyOrdersAsync(Uid, status, ct);
    }

    [HttpGet]
    public Task<OrderDto[]> List([FromQuery] string? status, CancellationToken ct) => _svc.GetMyOrdersAsync(Uid, status, ct);

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var order = await _svc.GetByIdAsync(Uid, id, ct);
        return order == null ? NotFound() : Ok(order);
    }
}
