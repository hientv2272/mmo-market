using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using MmoMarket.Application.Common;

namespace MmoMarket.Application.Payments;

public record MoMoPayResult(string PayUrl, string? DeepLink, string? QrCodeUrl, string RequestId);

/// <summary>Kết quả tra cứu trạng thái giao dịch ở MoMo (query API).</summary>
public record MoMoQueryStatus(bool Found, bool Paid, decimal Amount);

public record MoMoIpnDto(
    string PartnerCode,
    string OrderId,
    string RequestId,
    long Amount,
    string OrderInfo,
    string OrderType,
    long TransId,
    int ResultCode,
    string Message,
    string PayType,
    long ResponseTime,
    string ExtraData,
    string Signature);

public class MoMoService
{
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(30) };

    private readonly string _partnerCode;
    private readonly string _accessKey;
    private readonly string _secretKey;
    private readonly string _apiEndpoint;
    private readonly string _queryEndpoint;
    private readonly string _returnUrl;
    private readonly string _returnUrlWallet;
    private readonly string _ipnUrl;

    public MoMoService(IConfiguration config)
    {
        var s = config.GetSection("MoMo");
        _partnerCode = s["PartnerCode"] ?? "MOMO";
        _accessKey = s["AccessKey"] ?? "";
        _secretKey = s["SecretKey"] ?? "";
        _apiEndpoint = s["ApiEndpoint"] ?? "https://test-payment.momo.vn/v2/gateway/api/create";
        // Endpoint tra trạng thái giao dịch — cùng host với create (.../create → .../query).
        _queryEndpoint = s["QueryEndpoint"] ?? _apiEndpoint.Replace("/create", "/query");
        _returnUrl = s["ReturnUrl"] ?? "http://localhost:3000/account/orders";
        _returnUrlWallet = s["ReturnUrlWallet"] ?? _returnUrl.Replace("/account/orders", "/account/wallet");
        _ipnUrl = s["IpnUrl"] ?? "https://localhost/api/payment/momo/ipn";
    }

    // Trang redirect sau thanh toán dành cho nạp ví (khác trang đơn hàng).
    public string WalletReturnUrl => _returnUrlWallet;

    public async Task<MoMoPayResult> CreatePaymentAsync(Guid orderId, decimal amount, string orderCode, string? returnUrl = null)
    {
        var redirectUrl = returnUrl ?? _returnUrl;
        var requestId = Guid.NewGuid().ToString();
        var amountLong = (long)Math.Round(amount);
        var orderInfo = $"Thanh toán đơn hàng {orderCode}";
        const string extraData = "";
        const string requestType = "captureWallet";

        // Signature fields must be in alphabetical order
        var rawSig = $"accessKey={_accessKey}&amount={amountLong}&extraData={extraData}" +
                     $"&ipnUrl={_ipnUrl}&orderId={orderId}&orderInfo={orderInfo}" +
                     $"&partnerCode={_partnerCode}&redirectUrl={redirectUrl}" +
                     $"&requestId={requestId}&requestType={requestType}";
        var signature = HmacSha256(rawSig);

        var payload = new
        {
            partnerCode = _partnerCode,
            requestType,
            ipnUrl = _ipnUrl,
            redirectUrl,
            orderId = orderId.ToString(),
            amount = amountLong,
            orderInfo,
            requestId,
            extraData,
            lang = "vi",
            signature,
        };

        var content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json");

        var response = await _http.PostAsync(_apiEndpoint, content);
        var json = await response.Content.ReadAsStringAsync();

        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var res = JsonSerializer.Deserialize<MoMoApiResponse>(json, opts)
            ?? throw new AppException("MoMo trả về dữ liệu không hợp lệ");

        if (res.ResultCode != 0)
            throw new AppException($"MoMo: {res.Message}");

        return new MoMoPayResult(
            res.PayUrl ?? "",
            res.Deeplink,
            res.QrCodeUrl,
            requestId);
    }

    /// <summary>
    /// Tra trạng thái giao dịch chủ động qua MoMo query API (.../query) — KHÔNG phụ thuộc IPN.
    /// <paramref name="orderId"/> phải là orderId đã dùng khi tạo thanh toán (chính là id giao dịch nội bộ).
    /// Trả Paid=true khi MoMo báo resultCode=0 (đã thu tiền). Lỗi/không tồn tại → Found=false.
    /// </summary>
    public async Task<MoMoQueryStatus> QueryTransactionAsync(Guid orderId, CancellationToken ct = default)
    {
        var requestId = Guid.NewGuid().ToString();
        // Signature fields phải theo thứ tự alphabet.
        var rawSig = $"accessKey={_accessKey}&orderId={orderId}" +
                     $"&partnerCode={_partnerCode}&requestId={requestId}";
        var payload = new
        {
            partnerCode = _partnerCode,
            requestId,
            orderId = orderId.ToString(),
            lang = "vi",
            signature = HmacSha256(rawSig),
        };

        try
        {
            var content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _http.PostAsync(_queryEndpoint, content, ct);
            if (!response.IsSuccessStatusCode) return new MoMoQueryStatus(false, false, 0);

            var json = await response.Content.ReadAsStringAsync(ct);
            var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var res = JsonSerializer.Deserialize<MoMoApiResponse>(json, opts);
            if (res == null) return new MoMoQueryStatus(false, false, 0);

            // resultCode=0 → đã thanh toán thành công; khác → chờ/huỷ/lỗi (vẫn coi là Found để biết đã có giao dịch).
            return new MoMoQueryStatus(true, res.ResultCode == 0, res.Amount);
        }
        catch
        {
            return new MoMoQueryStatus(false, false, 0);
        }
    }

    // Verify server-to-server IPN signature from MoMo
    public bool VerifyIpnSignature(MoMoIpnDto dto)
    {
        // Signature fields in alphabetical order (IPN differs from create)
        var rawSig = $"accessKey={_accessKey}&amount={dto.Amount}&extraData={dto.ExtraData}" +
                     $"&message={dto.Message}&orderId={dto.OrderId}&orderInfo={dto.OrderInfo}" +
                     $"&orderType={dto.OrderType}&partnerCode={dto.PartnerCode}&payType={dto.PayType}" +
                     $"&requestId={dto.RequestId}&responseTime={dto.ResponseTime}" +
                     $"&resultCode={dto.ResultCode}&transId={dto.TransId}";
        return HmacSha256(rawSig) == dto.Signature;
    }

    private string HmacSha256(string data)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLower();
    }
}

file record MoMoApiResponse(
    [property: JsonPropertyName("resultCode")] int ResultCode,
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("payUrl")] string? PayUrl,
    [property: JsonPropertyName("deeplink")] string? Deeplink,
    [property: JsonPropertyName("qrCodeUrl")] string? QrCodeUrl,
    [property: JsonPropertyName("amount")] long Amount = 0);
