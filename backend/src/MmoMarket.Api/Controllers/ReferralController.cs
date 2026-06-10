using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Common;
using MmoMarket.Application.Referrals;

namespace MmoMarket.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/referral")]
public class ReferralController : ControllerBase
{
    private readonly ReferralService _svc;
    private readonly ICurrentUser _user;
    public ReferralController(ReferralService svc, ICurrentUser user) { _svc = svc; _user = user; }

    private Guid Uid => _user.UserId ?? throw new AppException("Unauthorized", 401);

    [HttpGet("stats")]
    public Task<ReferralStatsDto> Stats(CancellationToken ct) => _svc.GetMyStatsAsync(Uid, ct);
}
