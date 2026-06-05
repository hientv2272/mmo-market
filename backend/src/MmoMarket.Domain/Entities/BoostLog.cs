using MmoMarket.Domain.Common;

namespace MmoMarket.Domain.Entities;

/// <summary>
/// Nhật ký mỗi lần seller boost (đẩy tin). Dùng để đếm số lượt đã dùng trong tháng,
/// đối chiếu với quota BoostsPerMonth của gói thành viên.
/// </summary>
public class BoostLog : Entity
{
    public Guid SellerId { get; set; }
    public Guid ProductId { get; set; }
}
