using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace MmoMarket.Application.Payments;

/// <summary>Dữ liệu để client tự submit form sang trang thanh toán SePay (redirect).</summary>
public record SePayCheckoutResult(string ActionUrl, Dictionary<string, string> Fields);

/// <summary>Kết quả tra cứu trạng thái đơn ở SePay.</summary>
public record SePayOrderStatus(bool Found, string Status, decimal Amount);

/// <summary>
/// Cổng thanh toán SePay (https://developer.sepay.vn/en/cong-thanh-toan).
/// Checkout = form POST sang trang SePay; xác nhận = gọi REST API tra trạng thái (Basic auth)
/// nên không phụ thuộc webhook/IPN — chạy được ở dev mà không cần public URL.
/// </summary>
public class SePayPgService
{
    private static readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(20) };

    private readonly string _merchantId;
    private readonly string _secretKey;
    private readonly string _apiBaseUrl;       // pgapi(-sandbox).sepay.vn
    private readonly string _checkoutBaseUrl;  // pay(-sandbox).sepay.vn
    private readonly string _frontendBaseUrl;

    // Thứ tự khi ký = THỨ TỰ FIELD TRONG FORM (SDK ký bằng array_keys($fields) đã lọc theo allowed-list,
    // tức theo thứ tự prepareFormFields chèn), KHÔNG phải thứ tự allowed-list. Phải build dict đúng thứ tự này.
    private static readonly string[] SignOrder =
    {
        "merchant", "currency", "order_amount", "operation", "order_description",
        "payment_method", "order_invoice_number", "customer_id",
        "success_url", "error_url", "cancel_url",
        "agreement_id", "agreement_name", "agreement_type",
        "agreement_payment_frequency", "agreement_amount_per_payment",
    };

    public SePayPgService(IConfiguration config)
    {
        var s = config.GetSection("SePayPg");
        _merchantId = s["MerchantId"] ?? "";
        _secretKey  = s["SecretKey"]  ?? "";
        var env = (s["Environment"] ?? "sandbox").ToLowerInvariant();
        var sandbox = env != "production";
        _apiBaseUrl      = sandbox ? "https://pgapi-sandbox.sepay.vn" : "https://pgapi.sepay.vn";
        _checkoutBaseUrl = sandbox ? "https://pay-sandbox.sepay.vn"   : "https://pay.sepay.vn";
        _frontendBaseUrl = (s["FrontendBaseUrl"] ?? "http://localhost:3000").TrimEnd('/');
    }

    public bool Enabled => !string.IsNullOrEmpty(_merchantId) && !string.IsNullOrEmpty(_secretKey);

    /// <param name="returnPath">Đường dẫn FE để SePay redirect về (vd /account/wallet).</param>
    public SePayCheckoutResult BuildCheckout(string invoiceNumber, decimal amount, string description,
        string paymentMethod, string returnPath)
    {
        var baseUrl = $"{_frontendBaseUrl}{returnPath}";
        var codeQ = Uri.EscapeDataString(invoiceNumber);
        var fields = new Dictionary<string, string>
        {
            ["merchant"]             = _merchantId,
            ["currency"]             = "VND",
            ["order_amount"]         = ((long)Math.Round(amount)).ToString(),
            ["operation"]            = "PURCHASE",
            ["order_description"]    = description,
            ["payment_method"]       = paymentMethod, // CARD | BANK_TRANSFER | NAPAS_BANK_TRANSFER
            ["order_invoice_number"] = invoiceNumber,
            ["success_url"]          = baseUrl,
            // Mang theo mã + cờ để FE biết người dùng đã huỷ/lỗi mà cập nhật trạng thái.
            ["error_url"]            = $"{baseUrl}?sepay=error&code={codeQ}",
            ["cancel_url"]           = $"{baseUrl}?sepay=cancel&code={codeQ}",
        };
        fields["signature"] = Sign(fields);
        return new SePayCheckoutResult($"{_checkoutBaseUrl}/v1/checkout/init", fields);
    }

    // Tra trạng thái đơn theo order_invoice_number. Status: PENDING | CAPTURED | FAILED | VOIDED.
    public async Task<SePayOrderStatus> GetOrderStatusAsync(string invoiceNumber, CancellationToken ct)
    {
        if (!Enabled) return new SePayOrderStatus(false, "", 0);
        var url = $"{_apiBaseUrl}/v1/order/detail/{Uri.EscapeDataString(invoiceNumber)}";
        var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_merchantId}:{_secretKey}")));
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        try
        {
            var resp = await _http.SendAsync(req, ct);
            if (!resp.IsSuccessStatusCode) return new SePayOrderStatus(false, "", 0);
            var json = await resp.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data)) return new SePayOrderStatus(false, "", 0);

            var status = data.TryGetProperty("order_status", out var st) ? st.GetString() ?? "" : "";
            decimal amount = 0;
            if (data.TryGetProperty("order_amount", out var am))
            {
                if (am.ValueKind == JsonValueKind.Number) amount = am.GetDecimal();
                else if (am.ValueKind == JsonValueKind.String && decimal.TryParse(am.GetString(), out var a)) amount = a;
            }
            return new SePayOrderStatus(true, status, amount);
        }
        catch
        {
            return new SePayOrderStatus(false, "", 0);
        }
    }

    public static bool IsPaid(string status) => string.Equals(status, "CAPTURED", StringComparison.OrdinalIgnoreCase);

    // Trích order_invoice_number từ payload IPN (notification_type=ORDER_PAID, object "order").
    public static string? ParseInvoiceFromIpn(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            if (root.TryGetProperty("order", out var order)
                && order.TryGetProperty("order_invoice_number", out var inv))
                return inv.GetString();
            if (root.TryGetProperty("order_invoice_number", out var inv2))
                return inv2.GetString();
        }
        catch { /* malformed */ }
        return null;
    }

    private string Sign(IReadOnlyDictionary<string, string> fields)
    {
        var parts = SignOrder
            .Where(fields.ContainsKey)
            .Select(k => $"{k}={fields[k]}");
        var raw = string.Join(",", parts);
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(raw)));
    }
}
