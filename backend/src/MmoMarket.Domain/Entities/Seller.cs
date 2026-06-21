using MmoMarket.Domain.Common;

namespace MmoMarket.Domain.Entities;

public class Seller : Entity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Username { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string AvatarColor { get; set; } = "#7c3aed";
    public double Rating { get; set; }
    public int ReviewCount { get; set; }
    public int TotalSold { get; set; }
    public string? Badge { get; set; } // verified | top | new
    public string? Bio { get; set; }
    public string? ResponseTime { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    // Cài đặt gian hàng (seller settings)
    public string? LogoUrl { get; set; }            // data URL (base64) — như Product.ImageUrl
    public string? BannerUrl { get; set; }          // ảnh bìa gian hàng
    public string? ContactEmail { get; set; }
    public string? ContactZalo { get; set; }
    public string? ContactTelegram { get; set; }
    public string? WarrantyPolicy { get; set; }     // chính sách bảo hành
    public string? ReturnPolicy { get; set; }       // chính sách đổi trả
    public bool IsOnVacation { get; set; }          // chế độ tạm nghỉ — ẩn shop & chặn đơn mới
    public string? VacationMessage { get; set; }    // thông báo hiển thị khi tạm nghỉ

    // Gói thành viên (P1.2)
    public string PlanCode { get; set; } = "free";     // free | basic | pro | vip
    public DateTime? PlanExpiresAt { get; set; }        // null hoặc đã quá hạn → coi như Free

    // Trust Score (P2.1) — điểm uy tín 0–100, ảnh hưởng xếp hạng hiển thị
    public int TrustScore { get; set; } = 80;
    public DateTime? LastViolationAt { get; set; }      // mốc vi phạm/penalty gần nhất (cho bonus 30 ngày)
    public DateTime? LastTrustBonusAt { get; set; }     // mốc cộng bonus gần nhất
    public DateTime? TrustBadgeUntil { get; set; }      // badge "Uy tín" trả phí (§3.4) — còn hiệu lực nếu > now

    public List<Product> Products { get; set; } = new();
}
