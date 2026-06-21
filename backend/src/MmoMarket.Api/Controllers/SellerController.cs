using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Common;
using MmoMarket.Application.Messages;
using MmoMarket.Application.Sellers;

namespace MmoMarket.Api.Controllers;

[ApiController]
[Authorize(Roles = "Seller,Admin,SuperAdmin")]
[Route("api/seller")]
public class SellerController : ControllerBase
{
    private readonly SellerService _svc;
    private readonly MessageService _msg;
    private readonly SellerPlanService _plans;
    private readonly ICurrentUser _user;
    public SellerController(SellerService svc, MessageService msg, SellerPlanService plans, ICurrentUser user)
    { _svc = svc; _msg = msg; _plans = plans; _user = user; }

    private Guid Uid => _user.UserId ?? throw new AppException("Unauthorized", 401);

    [HttpGet("dashboard")]
    public Task<SellerDashboardDto> Dashboard(CancellationToken ct) => _svc.GetDashboardAsync(Uid, ct);

    [HttpGet("shop-settings")]
    public Task<ShopSettingsDto> ShopSettings(CancellationToken ct) => _svc.GetShopSettingsAsync(Uid, ct);

    [HttpPut("shop-settings")]
    public Task<ShopSettingsDto> UpdateShopSettings([FromBody] ShopSettingsUpdateDto dto, CancellationToken ct)
        => _svc.UpdateShopSettingsAsync(Uid, dto, ct);

    [HttpGet("products")]
    public Task<SellerProductDto[]> Products(CancellationToken ct) => _svc.ListMyProductsAsync(Uid, ct);

    [HttpPost("products")]
    public Task<SellerProductDto> Create([FromBody] SellerProductCreateDto dto, CancellationToken ct) => _svc.CreateProductAsync(Uid, dto, ct);

    [HttpPut("products/{id:guid}")]
    public Task<SellerProductDto> Update(Guid id, [FromBody] SellerProductUpdateDto dto, CancellationToken ct) => _svc.UpdateProductAsync(Uid, id, dto, ct);

    [HttpDelete("products/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _svc.DeleteProductAsync(Uid, id, ct);
        return NoContent();
    }

    [HttpGet("boost-info")]
    public Task<BoostInfoDto> BoostInfo(CancellationToken ct) => _svc.GetBoostInfoAsync(Uid, ct);

    [HttpPost("products/{id:guid}/boost")]
    public Task<SellerProductDto> Boost(Guid id, [FromQuery] bool pay, CancellationToken ct) => _svc.BoostProductAsync(Uid, id, pay, ct);

    [HttpGet("badge-info")]
    public Task<BadgeInfoDto> BadgeInfo(CancellationToken ct) => _svc.GetTrustBadgeInfoAsync(Uid, ct);

    [HttpPost("trust-badge")]
    public Task<CurrentPlanDto> BuyTrustBadge(CancellationToken ct) => _svc.BuyTrustBadgeAsync(Uid, ct);

    [HttpGet("orders")]
    public Task<SellerOrderLineDto[]> Orders([FromQuery] string? status, CancellationToken ct) => _svc.ListMyOrdersAsync(Uid, status, ct);

    public record DeliverDto(string[] Items);
    [HttpPost("orders/{lineId:guid}/deliver")]
    public Task<SellerOrderLineDto> Deliver(Guid lineId, [FromBody] DeliverDto dto, CancellationToken ct) => _svc.DeliverManualAsync(Uid, lineId, dto.Items, ct);

    [HttpGet("inventory/{productId:guid}")]
    public Task<SellerInventoryDto> Inventory(Guid productId, CancellationToken ct) => _svc.GetInventoryAsync(Uid, productId, ct);

    [HttpPost("inventory/{productId:guid}/upload")]
    public async Task<IActionResult> Upload(Guid productId, [FromBody] InventoryUploadDto dto, CancellationToken ct)
    {
        var added = await _svc.UploadInventoryAsync(Uid, productId, dto.Items, ct);
        return Ok(new { added });
    }

    [HttpPut("inventory/item/{itemId:guid}")]
    public Task<SellerInventoryDto> UpdateInventoryItem(Guid itemId, [FromBody] InventoryItemUpdateDto dto, CancellationToken ct) =>
        _svc.UpdateInventoryItemAsync(Uid, itemId, dto.Content, dto.Reserved, ct);

    [HttpDelete("inventory/item/{itemId:guid}")]
    public Task<SellerInventoryDto> DeleteInventoryItem(Guid itemId, CancellationToken ct) =>
        _svc.DeleteInventoryItemAsync(Uid, itemId, ct);

    [HttpGet("coupons")]
    public Task<SellerCouponDto[]> Coupons(CancellationToken ct) => _svc.ListMyCouponsAsync(Uid, ct);

    [HttpPost("coupons")]
    public Task<SellerCouponDto> CreateCoupon([FromBody] CreateSellerCouponDto dto, CancellationToken ct) =>
        _svc.CreateSellerCouponAsync(Uid, dto, ct);

    [HttpPut("coupons/{id:guid}")]
    public Task<SellerCouponDto> UpdateCoupon(Guid id, [FromBody] UpdateSellerCouponDto dto, CancellationToken ct) =>
        _svc.UpdateSellerCouponAsync(Uid, id, dto, ct);

    [HttpDelete("coupons/{id:guid}")]
    public async Task<IActionResult> DeleteCoupon(Guid id, CancellationToken ct)
    {
        await _svc.DeleteSellerCouponAsync(Uid, id, ct);
        return NoContent();
    }

    [HttpPost("coupons/{id:guid}/toggle")]
    public Task<SellerCouponDto> ToggleCoupon(Guid id, CancellationToken ct) =>
        _svc.ToggleSellerCouponAsync(Uid, id, ct);

    // ── Messages ──────────────────────────────────────────────────────────────
    [HttpGet("messages")]
    public Task<ConversationDto[]> ListMessages(CancellationToken ct) =>
        _msg.ListSellerConversationsAsync(Uid, ct);

    [HttpGet("messages/{id:guid}")]
    public Task<ChatMessageDto[]> GetSellerMessages(Guid id, CancellationToken ct) =>
        _msg.GetMessagesAsync(id, Uid, "Seller", ct);

    [HttpPost("messages/{id:guid}")]
    public Task<ChatMessageDto> SendSellerMessage(Guid id, [FromBody] SendMessageDto dto, CancellationToken ct) =>
        _msg.SendMessageAsync(id, Uid, "Seller", dto.Body, ct);

    [HttpGet("reviews")]
    public Task<SellerReviewDto[]> Reviews(CancellationToken ct) => _svc.ListMyReviewsAsync(Uid, ct);

    [HttpGet("withdraws")]
    public Task<WithdrawDto[]> Withdraws(CancellationToken ct) => _svc.ListMyWithdrawsAsync(Uid, ct);

    [HttpPost("withdraws")]
    public Task<WithdrawDto> CreateWithdraw([FromBody] WithdrawCreateDto dto, CancellationToken ct) => _svc.CreateWithdrawAsync(Uid, dto, ct);

    // ── Sổ tài khoản nhận tiền ───────────────────────────────────────────────
    [HttpGet("payout-methods")]
    public Task<PayoutMethodDto[]> PayoutMethods(CancellationToken ct) => _svc.ListPayoutMethodsAsync(Uid, ct);

    [HttpPost("payout-methods")]
    public Task<PayoutMethodDto> CreatePayoutMethod([FromBody] PayoutMethodSaveDto dto, CancellationToken ct) => _svc.CreatePayoutMethodAsync(Uid, dto, ct);

    [HttpPut("payout-methods/{id:guid}")]
    public Task<PayoutMethodDto> UpdatePayoutMethod(Guid id, [FromBody] PayoutMethodSaveDto dto, CancellationToken ct) => _svc.UpdatePayoutMethodAsync(Uid, id, dto, ct);

    [HttpDelete("payout-methods/{id:guid}")]
    public async Task<IActionResult> DeletePayoutMethod(Guid id, CancellationToken ct)
    {
        await _svc.DeletePayoutMethodAsync(Uid, id, ct);
        return NoContent();
    }

    [HttpPost("payout-methods/{id:guid}/default")]
    public Task<PayoutMethodDto> SetDefaultPayoutMethod(Guid id, CancellationToken ct) => _svc.SetDefaultPayoutMethodAsync(Uid, id, ct);

    // ── Gói thành viên (P1.2) ───────────────────────────────────────────────
    [HttpGet("plans")]
    [AllowAnonymous]
    public Task<SellerPlanDto[]> Plans(CancellationToken ct) => _plans.ListPlansAsync(ct);

    [HttpGet("plan")]
    public Task<CurrentPlanDto> MyPlan(CancellationToken ct) => _plans.GetMyPlanAsync(Uid, ct);

    public record SubscribePlanDto(string PlanCode);
    [HttpPost("plan/subscribe")]
    public Task<CurrentPlanDto> Subscribe([FromBody] SubscribePlanDto dto, CancellationToken ct) =>
        _plans.SubscribeAsync(Uid, dto.PlanCode, ct);
}
