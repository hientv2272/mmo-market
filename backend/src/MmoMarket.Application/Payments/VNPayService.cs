using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using MmoMarket.Application.Common;

namespace MmoMarket.Application.Payments;

public record VNPayResult(string PaymentUrl);

public class VNPayService
{
    private readonly string _tmnCode;
    private readonly string _hashSecret;
    private readonly string _paymentBaseUrl;
    private readonly string _returnUrl;
    private readonly string _returnUrlWallet;
    private readonly string _ipnUrl;

    public VNPayService(IConfiguration config)
    {
        var s = config.GetSection("VNPay");
        _tmnCode     = s["TmnCode"]     ?? "";
        _hashSecret  = s["HashSecret"]  ?? "";
        _paymentBaseUrl = s["PaymentUrl"] ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
        _returnUrl   = s["ReturnUrl"]   ?? "http://localhost:3000/account/orders";
        _returnUrlWallet = s["ReturnUrlWallet"] ?? _returnUrl.Replace("/account/orders", "/account/wallet");
        _ipnUrl      = s["IpnUrl"]      ?? "https://localhost/api/payment/vnpay/ipn";
    }

    // Trang redirect sau thanh toán dành cho nạp ví (khác trang đơn hàng).
    public string WalletReturnUrl => _returnUrlWallet;

    public VNPayResult CreatePaymentUrl(Guid orderId, decimal amount, string orderCode, string ipAddress, string? returnUrl = null)
    {
        // VNPay requires Vietnam time (UTC+7)
        var vnNow = DateTime.UtcNow.AddHours(7);
        var createDate  = vnNow.ToString("yyyyMMddHHmmss");
        var expireDate  = vnNow.AddMinutes(15).ToString("yyyyMMddHHmmss");
        var txnRef      = orderId.ToString("N");           // 32-char hex, no dashes
        var amountVnpay = (long)(amount * 100);            // VNPay multiplies by 100
        var orderInfo   = $"Thanh toan don hang {orderCode}";  // ASCII only for safe hashing

        // SortedDictionary ensures alphabetical order by key (vnp_Amount < vnp_Command …)
        var data = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["vnp_Version"]    = "2.1.0",
            ["vnp_Command"]    = "pay",
            ["vnp_TmnCode"]    = _tmnCode,
            ["vnp_Amount"]     = amountVnpay.ToString(),
            ["vnp_CurrCode"]   = "VND",
            ["vnp_TxnRef"]     = txnRef,
            ["vnp_OrderInfo"]  = orderInfo,
            ["vnp_OrderType"]  = "other",
            ["vnp_Locale"]     = "vn",
            ["vnp_ReturnUrl"]  = returnUrl ?? _returnUrl,
            ["vnp_IpAddr"]     = ipAddress,
            ["vnp_CreateDate"] = createDate,
            ["vnp_ExpireDate"] = expireDate,
        };

        // VNPay hash: raw values (NOT URL-encoded) joined with &
        var hashData   = string.Join("&", data.Select(kv => $"{kv.Key}={kv.Value}"));
        var secureHash = HmacSha512(_hashSecret, hashData);

        // Final URL: URL-encode each value, append signature
        var query      = string.Join("&", data.Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value)}"));
        var paymentUrl = $"{_paymentBaseUrl}?{query}&vnp_SecureHash={secureHash}";

        return new VNPayResult(paymentUrl);
    }

    // Verify IPN / ReturnUrl signature.
    // ASP.NET Core gives URL-decoded values in Request.Query — use them as-is for hashing.
    public bool VerifyIpnSignature(IReadOnlyDictionary<string, string> queryParams)
    {
        if (!queryParams.TryGetValue("vnp_SecureHash", out var receivedHash))
            return false;

        var sorted = queryParams
            .Where(kv => kv.Key != "vnp_SecureHash" && kv.Key != "vnp_SecureHashType")
            .OrderBy(kv => kv.Key, StringComparer.Ordinal);

        var hashData      = string.Join("&", sorted.Select(kv => $"{kv.Key}={kv.Value}"));
        var computedHash  = HmacSha512(_hashSecret, hashData);
        return computedHash.Equals(receivedHash, StringComparison.OrdinalIgnoreCase);
    }

    // Extract orderId stored in vnp_TxnRef (GUID N format, 32 hex chars).
    public static Guid? ParseOrderIdFromIpn(IReadOnlyDictionary<string, string> queryParams)
    {
        if (!queryParams.TryGetValue("vnp_TxnRef", out var txnRef)) return null;
        return Guid.TryParseExact(txnRef, "N", out var g) ? g : null;
    }

    private static string HmacSha512(string key, string data)
    {
        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(key));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLower();
    }
}
