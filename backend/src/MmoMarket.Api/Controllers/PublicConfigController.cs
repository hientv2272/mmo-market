using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Config;

namespace MmoMarket.Api.Controllers;

/// <summary>Cấu hình công khai (không cần đăng nhập) để frontend biết trạng thái bảo trì / đăng ký.</summary>
[ApiController]
[AllowAnonymous]
[Route("api/config")]
public class PublicConfigController : ControllerBase
{
    private readonly ConfigService _config;
    public PublicConfigController(ConfigService config) => _config = config;

    public record PublicConfigDto(bool MaintenanceMode, string MaintenanceMessage, string SiteName, bool RegistrationEnabled);

    [HttpGet("public")]
    public async Task<PublicConfigDto> Public(CancellationToken ct)
    {
        var maintenanceMode = await _config.GetBoolAsync(ConfigKeys.MaintenanceMode, false, ct);
        var message = await _config.GetAsync(ConfigKeys.MaintenanceMessage, ct) ?? "Hệ thống đang bảo trì, vui lòng quay lại sau.";
        var siteName = await _config.GetAsync(ConfigKeys.SiteName, ct) ?? "MMO Market";
        var registrationEnabled = await _config.GetBoolAsync(ConfigKeys.RegistrationEnabled, true, ct);
        return new PublicConfigDto(maintenanceMode, message, siteName, registrationEnabled);
    }
}
