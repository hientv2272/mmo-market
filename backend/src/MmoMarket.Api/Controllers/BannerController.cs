using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Admin;

namespace MmoMarket.Api.Controllers;

/// <summary>Endpoint công khai để ghi nhận impression/click banner (cho CPM/CPC, §3.4).</summary>
[ApiController]
[Route("api/banners")]
[AllowAnonymous]
public class BannerController : ControllerBase
{
    private readonly AdminService _svc;
    public BannerController(AdminService svc) => _svc = svc;

    [HttpPost("{id:guid}/view")]
    public async Task<IActionResult> View(Guid id, CancellationToken ct)
    {
        await _svc.IncrementBannerViewAsync(id, ct);
        return Ok();
    }

    [HttpPost("{id:guid}/click")]
    public async Task<IActionResult> Click(Guid id, CancellationToken ct)
    {
        await _svc.IncrementBannerClickAsync(id, ct);
        return Ok();
    }
}
