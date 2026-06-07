using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace MmoMarket.Api.Hubs;

/// <summary>
/// Hub realtime cho thông báo. Client kết nối kèm JWT (access_token query),
/// server đẩy event "notification" tới đúng user (Clients.User theo NameIdentifier).
/// </summary>
[Authorize]
public class NotificationHub : Hub
{
}
