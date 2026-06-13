using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Orders;
using MmoMarket.Application.Payments;
using MmoMarket.Application.Wallet;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Api.Controllers;

[ApiController]
[Route("api/payment")]
public class PaymentController : ControllerBase
{
    private readonly MoMoService _momo;
    private readonly ZaloPayService _zalo;
    private readonly VNPayService _vnpay;
    private readonly SePayPgService _sepayPg;
    private readonly OrderService _order;
    private readonly WalletTopupService _topup;
    private readonly PaymentLogService _payLog;

    public PaymentController(MoMoService momo, ZaloPayService zalo, VNPayService vnpay, SePayPgService sepayPg, OrderService order, WalletTopupService topup, PaymentLogService payLog)
    { _momo = momo; _zalo = zalo; _vnpay = vnpay; _sepayPg = sepayPg; _order = order; _topup = topup; _payLog = payLog; }

    /// <summary>
    /// MoMo IPN — server-to-server callback (JSON body).
    /// </summary>
    [HttpPost("momo/ipn")]
    [AllowAnonymous]
    public async Task<IActionResult> MoMoIpn([FromBody] MoMoIpnDto dto, CancellationToken ct)
    {
        if (!_momo.VerifyIpnSignature(dto))
            return BadRequest(new { message = "Invalid signature" });

        if (dto.ResultCode == 0 && Guid.TryParse(dto.OrderId, out var orderId))
        {
            await _payLog.RecordAsync("momo", dto.TransId.ToString(), PaymentMethod.Momo,
                dto.Amount, orderId, "success", JsonSerializer.Serialize(dto), ct);
            // Cùng không gian id: nếu không phải đơn hàng thì thử nạp ví. Đối chiếu số tiền cổng báo.
            if (!await _order.ConfirmExternalPaymentAsync(orderId, dto.Amount, ct))
                await _topup.ConfirmByIdAsync(orderId, dto.Amount, ct);
        }

        return Ok(new { message = "OK" });
    }

    /// <summary>
    /// ZaloPay IPN — server-to-server callback (form-urlencoded: data=&amp;mac=&amp;type=1).
    /// </summary>
    [HttpPost("zalopay/ipn")]
    [AllowAnonymous]
    public async Task<IActionResult> ZaloPayIpn(
        [FromForm] string data, [FromForm] string mac, CancellationToken ct)
    {
        if (!_zalo.VerifyIpnSignature(data, mac))
            return Ok(new { return_code = -1, return_message = "Invalid signature" });

        if (ZaloPayService.ParseStatusFromIpn(data) == 1)
        {
            var orderId = ZaloPayService.ParseOrderIdFromIpn(data);
            if (orderId.HasValue)
            {
                var (transId, amount) = ZaloPayService.ParseTransInfoFromIpn(data);
                await _payLog.RecordAsync("zalopay", transId, PaymentMethod.ZaloPay,
                    amount, orderId.Value, "success", data, ct);
                if (!await _order.ConfirmExternalPaymentAsync(orderId.Value, amount, ct))
                    await _topup.ConfirmByIdAsync(orderId.Value, amount, ct);
            }
        }

        return Ok(new { return_code = 1, return_message = "Success" });
    }

    /// <summary>
    /// VNPay IPN — server-to-server callback (GET query string).
    /// </summary>
    [HttpGet("vnpay/ipn")]
    [AllowAnonymous]
    public async Task<IActionResult> VNPayIpn(CancellationToken ct)
    {
        var queryParams = Request.Query.ToDictionary(kv => kv.Key, kv => kv.Value.ToString());

        if (!_vnpay.VerifyIpnSignature(queryParams))
            return Ok(new { RspCode = "97", Message = "Invalid Checksum" });

        var responseCode = queryParams.GetValueOrDefault("vnp_ResponseCode", "");
        var txnStatus    = queryParams.GetValueOrDefault("vnp_TransactionStatus", "");

        if (responseCode == "00" && txnStatus == "00")
        {
            var orderId = VNPayService.ParseOrderIdFromIpn(queryParams);
            if (orderId.HasValue)
            {
                var vnpTxnNo = queryParams.GetValueOrDefault("vnp_TransactionNo", "");
                decimal vnpAmount = decimal.TryParse(queryParams.GetValueOrDefault("vnp_Amount", "0"), out var a) ? a / 100m : 0m;
                await _payLog.RecordAsync("vnpay", vnpTxnNo, PaymentMethod.VnPay,
                    vnpAmount, orderId.Value, "success", JsonSerializer.Serialize(queryParams), ct);
                // Cùng không gian id: nếu không phải đơn hàng thì thử nạp ví. Đối chiếu số tiền cổng báo.
                if (!await _order.ConfirmExternalPaymentAsync(orderId.Value, vnpAmount, ct)
                    && !await _topup.ConfirmByIdAsync(orderId.Value, vnpAmount, ct))
                    return Ok(new { RspCode = "02", Message = "Order already confirmed" });
            }
            else
            {
                return Ok(new { RspCode = "01", Message = "Order Not Found" });
            }
        }

        return Ok(new { RspCode = "00", Message = "Confirm Success" });
    }

    /// <summary>
    /// IPN cổng thanh toán SePay. Thay vì tin chữ ký IPN, ta xác minh lại qua REST API
    /// (GET order/detail) rồi mới ghi nhận — an toàn và độc lập với định dạng chữ ký.
    /// </summary>
    [HttpPost("sepay-pg/ipn")]
    [AllowAnonymous]
    public async Task<IActionResult> SePayPgIpn(CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(ct);
        var invoice = SePayPgService.ParseInvoiceFromIpn(body);
        if (!string.IsNullOrEmpty(invoice))
        {
            var st = await _sepayPg.GetOrderStatusAsync(invoice, ct);
            if (st.Found && SePayPgService.IsPaid(st.Status))
            {
                await _payLog.RecordAsync("sepay-pg", invoice, PaymentMethod.VietQr, st.Amount, null, "success", body, ct);
                // invoice = mã đơn (MMK-) hoặc mã nạp ví (NAP-); thử cả hai (idempotent). Đối chiếu số tiền SePay báo.
                if (!await _order.ConfirmExternalPaymentByTransferNoteAsync(invoice, st.Amount, ct))
                    await _topup.ConfirmByTransferNoteAsync(invoice, st.Amount, ct);
            }
        }
        return Ok(new { success = true });
    }
}
