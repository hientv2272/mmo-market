namespace MmoMarket.Application.Catalog;

public record CategoryDto(string Slug, string Name, string Short, string IconKey, string Description, string Color, int ProductCount);

public record ActiveFlashSaleDto(Guid Id, string Title, int DiscountPercent, DateTime StartsAt, DateTime EndsAt);

public record SellerSummaryDto(Guid Id, string Username, string DisplayName, string AvatarColor, double Rating, int ReviewCount, int TotalSold, string? Badge, string KycStatus, int TrustScore, bool TrustBadge, DateTime JoinedAt, string? ResponseTime, string? Bio = null, string? LogoUrl = null, string? BannerUrl = null, string? ContactEmail = null, string? ContactZalo = null, string? ContactTelegram = null, string? WarrantyPolicy = null, string? ReturnPolicy = null, bool IsOnVacation = false, string? VacationMessage = null);

public record ProductListItemDto(
    Guid Id,
    string Slug,
    string Title,
    string CategorySlug,
    decimal Price,
    decimal? ComparePrice,
    string Delivery,
    int WarrantyDays,
    int Stock,
    int Sold,
    double Rating,
    int ReviewCount,
    string ThumbnailColor,
    string? ThumbnailIcon,
    string? ImageUrl,
    string[] Badges,
    SellerSummaryDto Seller);

public record ProductDetailDto(
    Guid Id,
    string Slug,
    string Title,
    string CategorySlug,
    decimal Price,
    decimal? ComparePrice,
    string Delivery,
    int WarrantyDays,
    int Stock,
    int Sold,
    double Rating,
    int ReviewCount,
    string ThumbnailColor,
    string? ThumbnailIcon,
    string? ImageUrl,
    string[] Badges,
    string Description,
    string[] Features,
    string[] Policies,
    FaqItem[] Faq,
    SellerSummaryDto Seller,
    ReviewDto[] Reviews);

public record FaqItem(string Q, string A);
public record ReviewDto(Guid Id, string BuyerName, int Rating, string Comment, DateTime CreatedAt, string? Reply);

public record ProductListResponse(ProductListItemDto[] Items, int Total, int Page, int PageSize);
