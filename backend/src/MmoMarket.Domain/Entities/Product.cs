using MmoMarket.Domain.Common;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Domain.Entities;

public class Product : Entity
{
    public string Slug { get; set; } = "";
    public string Title { get; set; } = "";
    public string CategorySlug { get; set; } = "";
    public Category? Category { get; set; }
    public Guid SellerId { get; set; }
    public Seller? Seller { get; set; }
    public decimal Price { get; set; }
    public decimal? ComparePrice { get; set; }
    public DeliveryMethod Delivery { get; set; } = DeliveryMethod.Auto;
    public int WarrantyDays { get; set; } = 7;
    public int Stock { get; set; }
    public int Sold { get; set; }
    public double Rating { get; set; }
    public int ReviewCount { get; set; }
    public string ThumbnailColor { get; set; } = "#7c3aed";
    public string? ThumbnailIcon { get; set; }
    /// <summary>Ảnh đại diện duy nhất của sản phẩm (data URL base64 hoặc URL ngoài). Null = dùng icon/màu fallback.</summary>
    public string? ImageUrl { get; set; }
    public string Description { get; set; } = "";
    public string FeaturesJson { get; set; } = "[]";
    public string PoliciesJson { get; set; } = "[]";
    public string FaqJson { get; set; } = "[]";
    public string BadgesJson { get; set; } = "[]";
    public ProductStatus Status { get; set; } = ProductStatus.Active;

    // Cọc đăng tin (P1.4)
    public decimal DepositAmount { get; set; }
    public ListingDepositStatus DepositStatus { get; set; } = ListingDepositStatus.None;

    // Boost / đẩy tin (đang boost nếu BoostedUntil > now)
    public DateTime? BoostedUntil { get; set; }

    public List<Review> Reviews { get; set; } = new();
    public List<InventoryItem> InventoryItems { get; set; } = new();
}

public class InventoryItem : Entity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public string EncryptedPayload { get; set; } = ""; // mock; would be AES-256 in prod
    public string ContentHash { get; set; } = ""; // SHA-256 dedupe
    public bool Reserved { get; set; }
    public bool Sold { get; set; }
    public Guid? OrderId { get; set; }
}
