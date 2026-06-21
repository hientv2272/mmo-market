namespace MmoMarket.Domain.Enums;

public enum UserRole
{
    Buyer = 0,
    Seller = 1,
    Ctv = 2,
    Admin = 8,
    SuperAdmin = 9
}

public enum DeliveryMethod
{
    Auto = 0,
    Manual = 1,
    Hybrid = 2
}

public enum OrderStatus
{
    PendingPayment = 0,
    EscrowLocked   = 1, // tiền đã vào escrow, chờ seller bàn giao (trước đây: Paid)
    Delivering     = 2, // seller đang bàn giao (trước đây: Processing)
    Checking       = 3, // đã giao, buyer kiểm tra trong cửa sổ bảo hành (trước đây: Delivered)
    Completed      = 4,
    Disputed       = 5, // (trước đây: Dispute)
    Refunded       = 6,
    Cancelled      = 7
}

public enum PaymentMethod
{
    Wallet = 0,
    VietQr = 1,
    Momo = 2,
    ZaloPay = 3,
    VnPay = 4,
    Usdt = 5,
    Btc = 6
}

public enum KycStatus
{
    None = 0,
    Pending = 1,
    Approved = 2,
    Rejected = 3
}

public enum WalletTxnType
{
    Topup = 0,
    Purchase = 1,
    Refund = 2,
    Withdraw = 3,
    Commission = 4,
    Bonus = 5,
    Deposit = 6,        // cọc đăng tin bị khóa (P1.4)
    DepositRefund = 7,  // hoàn cọc đăng tin
    RevenueToWallet = 8 // seller rút doanh thu vào ví nội bộ
}

public enum ListingDepositStatus
{
    None = 0,
    Held = 1,       // đang khóa cọc
    Refunded = 2,   // đã hoàn cọc (gỡ tin sạch)
    Forfeited = 3   // tịch thu cọc (seller bùng hàng)
}

public enum WalletTxnStatus
{
    Pending = 0,
    Completed = 1,
    Failed = 2,
    Cancelled = 3
}

public enum DisputeStatus
{
    Open = 0,
    Investigating = 1,
    Resolved = 2,
    Closed = 3
}

public enum ProductStatus
{
    Draft = 0,
    Pending = 1,
    Active = 2,
    Rejected = 3,
    Hidden = 4,
    OutOfStock = 5,
    Banned = 6 // vi phạm, khóa vĩnh viễn
}

public enum CouponType
{
    Percent = 0,   // Value = percentage, e.g. 10 = 10%
    Fixed   = 1,   // Value = fixed amount in VND
}
