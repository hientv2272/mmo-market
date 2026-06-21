using MmoMarket.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MmoMarket.Application.Common;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Seller> Sellers { get; }
    DbSet<Category> Categories { get; }
    DbSet<Product> Products { get; }
    DbSet<InventoryItem> InventoryItems { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderLine> OrderLines { get; }
    DbSet<CartItem> CartItems { get; }
    DbSet<Review> Reviews { get; }
    DbSet<WalletTxn> WalletTxns { get; }
    DbSet<Dispute> Disputes { get; }
    DbSet<DisputeMessage> DisputeMessages { get; }
    DbSet<KycSubmission> KycSubmissions { get; }
    DbSet<WithdrawRequest> WithdrawRequests { get; }
    DbSet<WishlistItem> WishlistItems { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<Coupon> Coupons { get; }
    DbSet<CouponUsage> CouponUsages { get; }
    DbSet<Conversation> Conversations { get; }
    DbSet<ChatMessage> ChatMessages { get; }
    DbSet<SellerCoupon> SellerCoupons { get; }
    DbSet<Banner> Banners { get; }
    DbSet<FlashSale> FlashSales { get; }
    DbSet<SiteConfig> SiteConfigs { get; }
    DbSet<LoyaltyReward> LoyaltyRewards { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<PaymentTransaction> PaymentTransactions { get; }
    DbSet<FeeConfig> FeeConfigs { get; }
    DbSet<SellerPlan> SellerPlans { get; }
    DbSet<BoostLog> BoostLogs { get; }
    DbSet<SellerPayoutMethod> SellerPayoutMethods { get; }
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface IJwtTokenService
{
    string GenerateAccessToken(User user);
}

public interface ICurrentUser
{
    Guid? UserId { get; }
    string? Username { get; }
    string? Role { get; }
    bool IsAuthenticated { get; }
}

/// <summary>Mã hóa/giải mã AES-256 cho dữ liệu nhạy cảm (vd: payload bàn giao).</summary>
public interface IEncryptionService
{
    string Encrypt(string plaintext);
    string Decrypt(string ciphertext);
}

/// <summary>Gửi email (SMTP). Triển khai no-op/log khi chưa cấu hình SMTP.</summary>
public interface IEmailSender
{
    Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default);
}

/// <summary>Đẩy thông báo realtime tới user (SignalR). No-op nếu user không online.</summary>
public interface INotificationPusher
{
    Task PushAsync(Guid userId, object payload, CancellationToken ct = default);
}
