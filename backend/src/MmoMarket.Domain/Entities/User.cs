using MmoMarket.Domain.Common;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Domain.Entities;

public class User : Entity
{
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Username { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? PhoneNumber { get; set; }
    public string AvatarColor { get; set; } = "#7c3aed";
    public UserRole Role { get; set; } = UserRole.Buyer;
    public bool TwoFactorEnabled { get; set; }
    public KycStatus KycStatus { get; set; } = KycStatus.None;
    public decimal WalletBalance { get; set; }
    public int LoyaltyPoints { get; set; }
    public string? GoogleId { get; set; }
    public string? TotpSecret { get; set; }
    public string? ReferralCode { get; set; }
    public Guid? ReferredByUserId { get; set; }
    public bool AffiliateRewarded { get; set; } // đã trả hoa hồng giới thiệu (lần giao dịch đầu) chưa

    public Seller? Seller { get; set; }
    public List<Order> Orders { get; set; } = new();
    public List<WalletTxn> WalletTxns { get; set; } = new();
    public List<CartItem> CartItems { get; set; } = new();
    public List<Review> Reviews { get; set; } = new();
}
