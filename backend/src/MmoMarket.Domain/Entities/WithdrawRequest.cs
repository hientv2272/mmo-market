using MmoMarket.Domain.Common;

namespace MmoMarket.Domain.Entities;

public enum WithdrawStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Paid = 3,
}

public class WithdrawRequest : Entity
{
    public Guid SellerUserId { get; set; }
    public User? SellerUser { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; } = ""; // Bank / Momo / Usdt / Wallet
    public string Account { get; set; } = ""; // chuỗi tóm tắt hiển thị (snapshot)

    // Thông tin nhận tiền có cấu trúc (snapshot tại thời điểm tạo yêu cầu)
    public string? BankBin { get; set; }
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }   // số TK ngân hàng / SĐT MoMo
    public string? AccountHolder { get; set; }
    public string? CryptoNetwork { get; set; }   // TRC20 / BEP20 / ERC20
    public string? WalletAddress { get; set; }
    /// <summary>Tên chủ TK có khớp tên KYC không (null nếu N/A, vd rút về ví).</summary>
    public bool? HolderMatchesKyc { get; set; }
    /// <summary>Mã giao dịch admin nhập khi đã chuyển tiền thật (đối soát).</summary>
    public string? PayoutReference { get; set; }

    public WithdrawStatus Status { get; set; } = WithdrawStatus.Pending;
    public string? Note { get; set; }
    public string? AdminNote { get; set; }
    public DateTime? ProcessedAt { get; set; }
}
