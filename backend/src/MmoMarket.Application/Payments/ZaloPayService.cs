using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using MmoMarket.Application.Common;

namespace MmoMarket.Application.Payments;

public record ZaloPayResult(string OrderUrl, string ZpTransToken);

public class ZaloPayService
{
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(30) };

    private readonly int _appId;
    private readonly string _key1;    // sign requests
    private readonly string _key2;    // verify IPN callbacks
    private readonly string _apiEndpoint;
    private readonly string _returnUrl;
    private readonly string _returnUrlWallet;
    private readonly string _ipnUrl;

    public ZaloPayService(IConfiguration config)
    {
        var s = config.GetSection("ZaloPay");
        _appId = int.TryParse(s["AppId"], out var aid) ? aid : 2553;
        _key1 = s["Key1"] ?? "";
        _key2 = s["Key2"] ?? "";
        _apiEndpoint = s["ApiEndpoint"] ?? "https://sb-openapi.zalopay.vn/v2/create";
        _returnUrl = s["ReturnUrl"] ?? "http://localhost:3000/account/orders";
        _returnUrlWallet = s["ReturnUrlWallet"] ?? _returnUrl.Replace("/account/orders", "/account/wallet");
        _ipnUrl = s["IpnUrl"] ?? "https://localhost/api/payment/zalopay/ipn";
    }

    // Trang redirect sau thanh toán dành cho nạp ví (khác trang đơn hàng).
    public string WalletReturnUrl => _returnUrlWallet;

    public async Task<ZaloPayResult> CreatePaymentAsync(Guid orderId, decimal amount, string orderCode, string? returnUrl = null)
    {
        var appTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        // app_trans_id format: yyMMdd_<guidHex32> (total ≤ 40 chars)
        var datePart = DateTime.UtcNow.ToString("yyMMdd");
        var appTransId = $"{datePart}_{orderId:N}";
        var amountLong = (long)Math.Round(amount);
        var embedData = JsonSerializer.Serialize(new { orderId = orderId.ToString() });
        const string item = "[]";

        // Signature data: app_id|app_trans_id|app_user|amount|app_time|embed_data|item
        var rawMac = $"{_appId}|{appTransId}|mmomarket|{amountLong}|{appTime}|{embedData}|{item}";
        var mac = HmacSha256(_key1, rawMac);

        var payload = new
        {
            app_id = _appId,
            app_trans_id = appTransId,
            app_user = "mmomarket",
            app_time = appTime,
            amount = amountLong,
            item,
            description = $"Thanh toán đơn hàng {orderCode}",
            embed_data = embedData,
            bank_code = "",
            callback_url = _ipnUrl,
            redirect_url = returnUrl ?? _returnUrl,
            mac,
        };

        var content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json");

        var response = await _http.PostAsync(_apiEndpoint, content);
        var json = await response.Content.ReadAsStringAsync();

        var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        var res = JsonSerializer.Deserialize<ZaloPayApiResponse>(json, opts)
            ?? throw new AppException("ZaloPay trả về dữ liệu không hợp lệ");

        if (res.ReturnCode != 1)
            throw new AppException($"ZaloPay: {res.ReturnMessage} ({res.SubReturnMessage})");

        return new ZaloPayResult(res.OrderUrl ?? "", res.ZpTransToken ?? "");
    }

    // Verify server-to-server IPN from ZaloPay.
    // ZaloPay POSTs form data: data=<json_string>&mac=<hmac>&type=1
    // Verification: HMAC-SHA256(key2, data) == mac
    public bool VerifyIpnSignature(string data, string mac) =>
        HmacSha256(_key2, data) == mac;

    // Parse the orderId embedded in IPN data.
    // Returns null if not found or invalid.
    public static Guid? ParseOrderIdFromIpn(string data)
    {
        try
        {
            using var doc = JsonDocument.Parse(data);
            if (doc.RootElement.TryGetProperty("embed_data", out var ed))
            {
                var edStr = ed.GetString() ?? "";
                using var edDoc = JsonDocument.Parse(edStr);
                if (edDoc.RootElement.TryGetProperty("orderId", out var oid))
                    return Guid.TryParse(oid.GetString(), out var g) ? g : null;
            }
        }
        catch { /* malformed data */ }
        return null;
    }

    // Parse (zp_trans_id, amount) from IPN data for reconciliation/logging.
    public static (string TransId, decimal Amount) ParseTransInfoFromIpn(string data)
    {
        try
        {
            using var doc = JsonDocument.Parse(data);
            var root = doc.RootElement;
            var transId = root.TryGetProperty("zp_trans_id", out var zt)
                ? (zt.ValueKind == JsonValueKind.Number ? zt.GetInt64().ToString() : zt.GetString() ?? "")
                : "";
            decimal amount = root.TryGetProperty("amount", out var am) && am.TryGetDecimal(out var d) ? d : 0m;
            return (transId, amount);
        }
        catch { return ("", 0m); }
    }

    // Parse ZaloPay payment status from IPN data (1 = success).
    public static int ParseStatusFromIpn(string data)
    {
        try
        {
            using var doc = JsonDocument.Parse(data);
            if (doc.RootElement.TryGetProperty("status", out var s))
                return s.GetInt32();
        }
        catch { /* ignore */ }
        return -1;
    }

    private static string HmacSha256(string key, string data)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLower();
    }
}

file record ZaloPayApiResponse(
    [property: JsonPropertyName("return_code")] int ReturnCode,
    [property: JsonPropertyName("return_message")] string ReturnMessage,
    [property: JsonPropertyName("sub_return_code")] int SubReturnCode,
    [property: JsonPropertyName("sub_return_message")] string SubReturnMessage,
    [property: JsonPropertyName("order_url")] string? OrderUrl,
    [property: JsonPropertyName("zp_trans_token")] string? ZpTransToken,
    [property: JsonPropertyName("order_token")] string? OrderToken);
