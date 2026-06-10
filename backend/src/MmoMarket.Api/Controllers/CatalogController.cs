using Microsoft.AspNetCore.Mvc;
using MmoMarket.Application.Catalog;

namespace MmoMarket.Api.Controllers;

[ApiController]
[Route("api")]
public class CatalogController : ControllerBase
{
    private readonly CatalogService _svc;
    public CatalogController(CatalogService svc) => _svc = svc;

    [HttpGet("categories")]
    public async Task<CategoryDto[]> Categories(CancellationToken ct) => await _svc.GetCategoriesAsync(ct);

    [HttpGet("products")]
    public async Task<ProductListResponse> List([FromQuery] string? category, [FromQuery] string? sort, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? q = null, CancellationToken ct = default)
        => await _svc.ListAsync(category, sort, Math.Max(page, 1), Math.Clamp(pageSize, 1, 100), ct, q);

    [HttpGet("products/{slug}")]
    public async Task<IActionResult> Detail(string slug, CancellationToken ct)
    {
        var p = await _svc.GetBySlugAsync(slug, ct);
        return p == null ? NotFound() : Ok(p);
    }

    [HttpGet("flash-sale/active")]
    public async Task<IActionResult> ActiveFlashSale(CancellationToken ct)
    {
        var f = await _svc.GetActiveFlashSaleAsync(ct);
        return f == null ? NoContent() : Ok(f);
    }

    [HttpGet("sellers")]
    public async Task<SellerSummaryDto[]> Sellers(CancellationToken ct) => await _svc.GetSellersAsync(ct);

    [HttpGet("sellers/{username}")]
    public async Task<IActionResult> Seller(string username, CancellationToken ct)
    {
        var data = await _svc.GetSellerByUsernameAsync(username, ct);
        return data == null ? NotFound() : Ok(new { seller = data.Value.Seller, products = data.Value.Products });
    }
}
