using MmoMarket.Application.Orders;
using MmoMarket.Application.Payments;
using MmoMarket.Application.Sellers;
using MmoMarket.Application.Wallet;

namespace MmoMarket.Api.BackgroundJobs;

/// <summary>
/// Worker định kỳ xử lý timeout đơn hàng:
///  - Tự động giải ngân (escrow auto-release) khi buyer hết hạn kiểm tra.
///  - Tự động hủy + hoàn 100% khi seller không bàn giao đúng hạn.
/// </summary>
public class OrderEscrowWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OrderEscrowWorker> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);

    public OrderEscrowWorker(IServiceScopeFactory scopeFactory, ILogger<OrderEscrowWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Chờ app khởi động + DB seed xong rồi mới bắt đầu quét.
        try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var orders = scope.ServiceProvider.GetRequiredService<OrderService>();
                var trust = scope.ServiceProvider.GetRequiredService<TrustScoreService>();
                var topup = scope.ServiceProvider.GetRequiredService<WalletTopupService>();
                var sepay = scope.ServiceProvider.GetRequiredService<SePayPgService>();
                var released = await orders.AutoReleaseEscrowAsync(stoppingToken);
                var cancelled = await orders.AutoCancelStaleAsync(stoppingToken);
                var bonused = await trust.Award30dCleanBonusAsync(stoppingToken);
                var topupsExpired = await topup.ExpireStalePendingAsync(stoppingToken);
                var ordersPaid = await orders.ReconcilePendingSePayAsync(sepay, null, stoppingToken);
                var ordersExpired = await orders.CancelStalePendingPaymentAsync(stoppingToken);
                if (released > 0 || cancelled > 0 || bonused > 0 || topupsExpired > 0 || ordersPaid > 0 || ordersExpired > 0)
                    _logger.LogInformation("OrderEscrowWorker: giải ngân {Released}, hủy {Cancelled}, +trust {Bonused}, nạp quá hạn {Topups}, đơn SePay xác nhận {OrdersPaid}, đơn quá hạn TT huỷ {OrdersExpired}", released, cancelled, bonused, topupsExpired, ordersPaid, ordersExpired);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OrderEscrowWorker lỗi khi xử lý timeout đơn hàng");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}
