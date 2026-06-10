using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Common;
using MmoMarket.Application.Loyalty;

namespace MmoMarket.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/loyalty")]
public class LoyaltyController : ControllerBase
{
    private readonly LoyaltyService _svc;
    private readonly ICurrentUser _user;
    public LoyaltyController(LoyaltyService svc, ICurrentUser user) { _svc = svc; _user = user; }

    private Guid Uid => _user.UserId ?? throw new AppException("Unauthorized", 401);

    [HttpGet("rewards")]
    public Task<LoyaltyRewardDto[]> Rewards(CancellationToken ct) => _svc.ListRewardsAsync(ct);

    [HttpPost("redeem/{rewardId:guid}")]
    public Task<RedeemResultDto> Redeem(Guid rewardId, CancellationToken ct) => _svc.RedeemAsync(Uid, rewardId, ct);
}
