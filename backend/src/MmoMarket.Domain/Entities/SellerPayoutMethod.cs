using MmoMarket.Domain.Common;

namespace MmoMarket.Domain.Entities;

/// <summary>
/// Tài khoản nhận tiền đã lưu sẵn của seller (sổ tài khoản rút).
/// Lúc rút seller chỉ chọn lại thay vì nhập tay từng lần.
/// </summary>
public class SellerPayoutMethod : Entity
{
    public Guid SellerUserId { get; set; }
    public User? SellerUser { get; set; }
    public string Type { get; set; } = "";        // Bank / Momo / Usdt
    public string Label { get; set; } = "";        // tên gợi nhớ, vd "VCB chính"

    // Ngân hàng
    public string? BankBin { get; set; }           // mã NAPAS, vd 970436
    public string? BankName { get; set; }          // tên hiển thị ngân hàng

    // Dùng chung Bank (số TK) / Momo (số điện thoại)
    public string? AccountNumber { get; set; }
    public string? AccountHolder { get; set; }     // tên chủ tài khoản — nên khớp tên KYC

    // USDT
    public string? CryptoNetwork { get; set; }     // TRC20 / BEP20 / ERC20
    public string? WalletAddress { get; set; }

    public bool IsDefault { get; set; }
    /// <summary>Tên chủ TK có khớp tên trên KYC đã duyệt không (tính lúc lưu).</summary>
    public bool HolderMatchesKyc { get; set; }
}
