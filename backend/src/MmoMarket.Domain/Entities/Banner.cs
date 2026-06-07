namespace MmoMarket.Domain.Entities;

public class Banner
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = "";
    public string Subtitle { get; set; } = "";
    public string? LinkUrl { get; set; }
    public string BgColor { get; set; } = "#7c3aed";
    public string TextColor { get; set; } = "#ffffff";
    public int Position { get; set; }
    public bool IsActive { get; set; } = true;
    public int ClickCount { get; set; }
    public int ViewCount { get; set; }                 // impressions (cho CPM)
    public string CostModel { get; set; } = "none";    // none | cpm | cpc (§3.4)
    public decimal Rate { get; set; }                  // CPM: giá/1000 view; CPC: giá/click
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
