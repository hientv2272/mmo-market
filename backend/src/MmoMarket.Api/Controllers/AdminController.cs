using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Admin;
using MmoMarket.Application.Disputes;
using MmoMarket.Application.Sellers;

namespace MmoMarket.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,SuperAdmin")]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly AdminService _svc;
    private readonly KycService _kyc;
    private readonly DisputeService _disputes;
    private readonly SellerPlanService _plans;
    public AdminController(AdminService svc, KycService kyc, DisputeService disputes, SellerPlanService plans)
    {
        _svc = svc; _kyc = kyc; _disputes = disputes; _plans = plans;
    }

    [HttpGet("metrics")]
    public Task<AdminMetricsDto> Metrics(CancellationToken ct) => _svc.GetMetricsAsync(ct);

    [HttpGet("finance/reconciliation")]
    public Task<FinanceReconciliationDto> FinanceReconciliation(CancellationToken ct) => _svc.GetFinanceReconciliationAsync(ct);

    // ── Gói thành viên Seller (CRUD) ──────────────────────────────────────────
    [HttpGet("plans")]
    public Task<AdminPlanDto[]> Plans(CancellationToken ct) => _plans.ListAllPlansAsync(ct);

    [HttpPost("plans")]
    public Task<AdminPlanDto> CreatePlan([FromBody] AdminPlanUpsertDto dto, CancellationToken ct) => _plans.CreatePlanAsync(dto, ct);

    [HttpPut("plans/{id:guid}")]
    public Task<AdminPlanDto> UpdatePlan(Guid id, [FromBody] AdminPlanUpsertDto dto, CancellationToken ct) => _plans.UpdatePlanAsync(id, dto, ct);

    [HttpDelete("plans/{id:guid}")]
    public async Task<IActionResult> DeletePlan(Guid id, CancellationToken ct)
    {
        await _plans.DeletePlanAsync(id, ct);
        return NoContent();
    }

    [HttpGet("reports")]
    public Task<AdminReportDto> Reports(CancellationToken ct) => _svc.GetReportsAsync(ct);

    [HttpGet("orders")]
    public Task<AdminOrderDto[]> Orders([FromQuery] string? status, [FromQuery] string? search, CancellationToken ct) =>
        _svc.GetAllOrdersAsync(status, search, ct);

    public record UpdateOrderStatusDto(string Status);
    [HttpPut("orders/{id:guid}/status")]
    public Task<AdminOrderDto> UpdateOrderStatus(Guid id, [FromBody] UpdateOrderStatusDto dto, CancellationToken ct) =>
        _svc.UpdateOrderStatusAsync(id, dto.Status, ct);

    [HttpGet("users")]
    public Task<AdminUserDto[]> Users([FromQuery] string? role, [FromQuery] string? search, CancellationToken ct) =>
        _svc.ListUsersAsync(role, search, ct);

    public record ChangeRoleDto(string Role);
    [HttpPut("users/{id:guid}/role")]
    public Task<AdminUserDto> ChangeUserRole(Guid id, [FromBody] ChangeRoleDto dto, CancellationToken ct) =>
        _svc.ChangeRoleAsync(id, dto.Role, ct);

    [HttpGet("products")]
    public Task<AdminProductDto[]> Products([FromQuery] string? status, CancellationToken ct) => _svc.ListProductsAsync(status, ct);

    [HttpPost("products/{id:guid}/approve")]
    public Task<AdminProductDto> ApproveProduct(Guid id, CancellationToken ct) => _svc.ApproveProductAsync(id, ct);

    public record AdminRejectDto(string? Reason);
    [HttpPost("products/{id:guid}/reject")]
    public Task<AdminProductDto> RejectProduct(Guid id, [FromBody] AdminRejectDto dto, CancellationToken ct) => _svc.RejectProductAsync(id, dto.Reason ?? "", ct);

    [HttpPost("products/{id:guid}/ban")]
    public Task<AdminProductDto> BanProduct(Guid id, [FromBody] AdminRejectDto dto, CancellationToken ct) => _svc.BanProductAsync(id, dto.Reason ?? "", ct);

    [HttpGet("kyc/pending")]
    public Task<KycDto[]> KycPending(CancellationToken ct) => _kyc.ListPendingAsync(ct);

    [HttpPost("kyc/{id:guid}/approve")]
    public Task<KycDto> ApproveKyc(Guid id, CancellationToken ct) => _kyc.ApproveAsync(id, ct);

    [HttpPost("kyc/{id:guid}/reject")]
    public Task<KycDto> RejectKyc(Guid id, [FromBody] AdminRejectDto dto, CancellationToken ct) => _kyc.RejectAsync(id, dto.Reason ?? "", ct);

    [HttpGet("disputes")]
    public Task<DisputeListItemDto[]> Disputes([FromQuery] string? status, CancellationToken ct) => _disputes.ListAllAsync(status, ct);

    public record ResolveDisputeDto(string Resolution, string Action);
    [HttpPost("disputes/{id:guid}/resolve")]
    public async Task<DisputeDetailDto> ResolveDispute(Guid id, [FromBody] ResolveDisputeDto dto, CancellationToken ct)
    {
        var adminId = Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? throw new InvalidOperationException("Missing user id"));
        return await _disputes.ResolveAsync(adminId, id, new DisputeResolveDto(dto.Resolution, dto.Action), ct);
    }

    [HttpGet("withdrawals")]
    public Task<AdminWithdrawDto[]> Withdrawals([FromQuery] string? status, CancellationToken ct) => _svc.ListWithdrawalsAsync(status, ct);

    public record ProcessWithdrawDto(bool Approve, string? AdminNote, string? PayoutReference);
    [HttpPost("withdrawals/{id:guid}/process")]
    public Task<AdminWithdrawDto> ProcessWithdraw(Guid id, [FromBody] ProcessWithdrawDto dto, CancellationToken ct) => _svc.ProcessWithdrawAsync(id, dto.Approve, dto.AdminNote, dto.PayoutReference, ct);

    [HttpGet("wallets/overview")]
    public Task<AdminWalletOverview> WalletOverview(CancellationToken ct) => _svc.GetWalletOverviewAsync(ct);

    [HttpGet("wallets")]
    public Task<AdminWalletUserDto[]> WalletUsers([FromQuery] string? search, CancellationToken ct) => _svc.ListWalletUsersAsync(search, ct);

    [HttpGet("wallets/{userId:guid}/transactions")]
    public Task<AdminWalletTxnDto[]> UserTransactions(Guid userId, CancellationToken ct) => _svc.GetUserTransactionsAsync(userId, ct);

    public record AdminTopupRequest(decimal Amount, string? Note);
    [HttpPost("wallets/{userId:guid}/topup")]
    public Task<AdminWalletUserDto> AdminTopup(Guid userId, [FromBody] AdminTopupRequest dto, CancellationToken ct) => _svc.AdminTopupAsync(userId, new AdminTopupDto(dto.Amount, dto.Note ?? ""), ct);

    // ── Banners ───────────────────────────────────────────────────────────────
    [HttpGet("banners")]
    public Task<BannerDto[]> GetBanners(CancellationToken ct) => _svc.ListBannersAsync(ct);

    [HttpPost("banners")]
    public Task<BannerDto> CreateBanner([FromBody] CreateBannerDto dto, CancellationToken ct) => _svc.CreateBannerAsync(dto, ct);

    [HttpPut("banners/{id:guid}")]
    public Task<BannerDto> UpdateBanner(Guid id, [FromBody] UpdateBannerDto dto, CancellationToken ct) => _svc.UpdateBannerAsync(id, dto, ct);

    [HttpDelete("banners/{id:guid}")]
    public Task DeleteBanner(Guid id, CancellationToken ct) => _svc.DeleteBannerAsync(id, ct);

    [HttpPost("banners/{id:guid}/toggle")]
    public Task<BannerDto> ToggleBanner(Guid id, CancellationToken ct) => _svc.ToggleBannerAsync(id, ct);

    // ── Flash Sales ───────────────────────────────────────────────────────────
    [HttpGet("flash-sales")]
    public Task<FlashSaleDto[]> GetFlashSales(CancellationToken ct) => _svc.ListFlashSalesAsync(ct);

    [HttpPost("flash-sales")]
    public Task<FlashSaleDto> CreateFlashSale([FromBody] CreateFlashSaleDto dto, CancellationToken ct) => _svc.CreateFlashSaleAsync(dto, ct);

    [HttpPut("flash-sales/{id:guid}")]
    public Task<FlashSaleDto> UpdateFlashSale(Guid id, [FromBody] UpdateFlashSaleDto dto, CancellationToken ct) => _svc.UpdateFlashSaleAsync(id, dto, ct);

    [HttpDelete("flash-sales/{id:guid}")]
    public Task DeleteFlashSale(Guid id, CancellationToken ct) => _svc.DeleteFlashSaleAsync(id, ct);

    // ── Fee & Loyalty Config ──────────────────────────────────────────────────
    [HttpGet("config/fee")]
    public Task<FeeConfigDto> GetFeeConfig(CancellationToken ct) => _svc.GetFeeConfigAsync(ct);

    public record SetFeeRequest(decimal FeePercent);
    [HttpPut("config/fee")]
    public Task<FeeConfigDto> SetFee([FromBody] SetFeeRequest dto, CancellationToken ct) =>
        _svc.SetFeeRateAsync(dto.FeePercent, ct);

    // Phí theo danh mục + ngưỡng giá (P1.1)
    [HttpGet("config/fee-tiers")]
    public Task<FeeTierDto[]> FeeTiers(CancellationToken ct) => _svc.ListFeeTiersAsync(ct);

    [HttpPost("config/fee-tiers")]
    public Task<FeeTierDto> CreateFeeTier([FromBody] FeeTierUpsertDto dto, CancellationToken ct) =>
        _svc.CreateFeeTierAsync(dto, ct);

    [HttpPut("config/fee-tiers/{id:guid}")]
    public Task<FeeTierDto> UpdateFeeTier(Guid id, [FromBody] FeeTierUpsertDto dto, CancellationToken ct) =>
        _svc.UpdateFeeTierAsync(id, dto, ct);

    [HttpDelete("config/fee-tiers/{id:guid}")]
    public async Task<IActionResult> DeleteFeeTier(Guid id, CancellationToken ct)
    {
        await _svc.DeleteFeeTierAsync(id, ct);
        return NoContent();
    }

    [HttpGet("config/loyalty")]
    public Task<LoyaltyConfigDto> GetLoyaltyConfig(CancellationToken ct) => _svc.GetLoyaltyConfigAsync(ct);

    [HttpPut("config/loyalty")]
    public Task<LoyaltyConfigDto> SetLoyaltyConfig([FromBody] LoyaltyConfigDto dto, CancellationToken ct) =>
        _svc.SetLoyaltyConfigAsync(dto, ct);

    [HttpGet("config/rewards")]
    public Task<LoyaltyRewardDto[]> GetRewards(CancellationToken ct) => _svc.ListLoyaltyRewardsAsync(ct);

    [HttpPost("config/rewards")]
    public Task<LoyaltyRewardDto> CreateReward([FromBody] CreateLoyaltyRewardDto dto, CancellationToken ct) =>
        _svc.CreateLoyaltyRewardAsync(dto, ct);

    [HttpPut("config/rewards/{id:guid}")]
    public Task<LoyaltyRewardDto> UpdateReward(Guid id, [FromBody] UpdateLoyaltyRewardDto dto, CancellationToken ct) =>
        _svc.UpdateLoyaltyRewardAsync(id, dto, ct);

    [HttpDelete("config/rewards/{id:guid}")]
    public Task DeleteReward(Guid id, CancellationToken ct) => _svc.DeleteLoyaltyRewardAsync(id, ct);

    [HttpPost("config/rewards/{id:guid}/toggle")]
    public Task<LoyaltyRewardDto> ToggleReward(Guid id, CancellationToken ct) => _svc.ToggleLoyaltyRewardAsync(id, ct);

    // ── System Settings ───────────────────────────────────────────────────────
    [HttpGet("config/settings")]
    public Task<SystemSettingsDto> GetSettings(CancellationToken ct) => _svc.GetSystemSettingsAsync(ct);

    [HttpPut("config/settings")]
    public Task<SystemSettingsDto> SetSettings([FromBody] SystemSettingsDto dto, CancellationToken ct) =>
        _svc.SetSystemSettingsAsync(dto, ct);
}
