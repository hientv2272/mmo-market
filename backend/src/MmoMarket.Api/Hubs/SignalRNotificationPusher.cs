using Microsoft.AspNetCore.SignalR;
using MmoMarket.Application.Common;

namespace MmoMarket.Api.Hubs;

/// <summary>Đẩy thông báo realtime qua SignalR tới user. No-op nếu user không có kết nối.</summary>
public class SignalRNotificationPusher : INotificationPusher
{
    private readonly IHubContext<NotificationHub> _hub;
    public SignalRNotificationPusher(IHubContext<NotificationHub> hub) => _hub = hub;

    public Task PushAsync(Guid userId, object payload, CancellationToken ct = default)
        => _hub.Clients.User(userId.ToString()).SendAsync("notification", payload, ct);
}
