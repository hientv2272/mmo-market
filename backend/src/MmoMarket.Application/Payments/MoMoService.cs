using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using MmoMarket.Application.Common;

namespace MmoMarket.Application.Payments;

public record MoMoPayResult(string PayUrl, string? DeepLink, string? QrCodeUrl, string RequestId);

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
    [property: JsonPropertyName("qrCodeUrl")] string? QrCodeUrl);
