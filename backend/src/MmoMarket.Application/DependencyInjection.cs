using Microsoft.Extensions.DependencyInjection;
using MmoMarket.Application.Admin;
using MmoMarket.Application.Auth;
using MmoMarket.Application.Cart;
using MmoMarket.Application.Catalog;
using MmoMarket.Application.Disputes;
using MmoMarket.Application.Orders;
using MmoMarket.Application.Reviews;
using MmoMarket.Application.Sellers;
using MmoMarket.Application.Wallet;
using MmoMarket.Application.Config;
using MmoMarket.Application.Messages;
using MmoMarket.Application.Coupons;
using MmoMarket.Application.Notifications;
using MmoMarket.Application.Payments;
using MmoMarket.Application.Wishlist;

namespace MmoMarket.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<AuthService>();
        services.AddScoped<CatalogService>();
        services.AddScoped<CartService>();
        services.AddScoped<OrderService>();
        services.AddScoped<WalletService>();
        services.AddScoped<KycService>();
        services.AddScoped<SellerService>();
        services.AddScoped<ReviewService>();
        services.AddScoped<DisputeService>();
        services.AddScoped<AdminService>();
        services.AddScoped<WishlistService>();
        services.AddScoped<NotificationService>();
        services.AddScoped<CouponService>();
        services.AddScoped<ConfigService>();
        services.AddScoped<MessageService>();
        services.AddScoped<TotpService>();
        services.AddScoped<MoMoService>();
        services.AddScoped<ZaloPayService>();
        services.AddScoped<VNPayService>();
        services.AddScoped<VietQrService>();
        services.AddScoped<UsdtService>();
        services.AddScoped<PaymentLogService>();
        services.AddScoped<SellerPlanService>();
        services.AddScoped<Fees.FeeService>();
        services.AddScoped<TransactionLimitService>();
        services.AddScoped<TrustScoreService>();
        services.AddScoped<Loyalty.LoyaltyService>();
        services.AddScoped<Stats.StatsService>();
        services.AddScoped<Referrals.ReferralService>();
        return services;
    }
}
