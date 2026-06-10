using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Stats;

namespace MmoMarket.Api.Controllers;

[ApiController]
[Route("api/stats")]
public class StatsController : ControllerBase
{
    private readonly StatsService _svc;
    public StatsController(StatsService svc) => _svc = svc;

    [HttpGet("overview")]
    public Task<StatsOverviewDto> Overview(CancellationToken ct) => _svc.GetOverviewAsync(ct);
}
