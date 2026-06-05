using Microsoft.EntityFrameworkCore;
using MmoMarket.Application.Common;
using MmoMarket.Domain.Entities;

namespace MmoMarket.Application.Config;

public static class ConfigKeys
{
    // Fee & Loyalty
    public const string FeeRate              = "fee_rate";
    public const string LoyaltyPtsPer1000    = "loyalty_pts_per_1000";
    public const string LoyaltySignupBonus   = "loyalty_signup_bonus";
    public const string LoyaltyReviewBonus   = "loyalty_review_bonus";
    public const string LoyaltyReferralBonus = "loyalty_referral_bonus";
    public const string LoyaltyTierSilver    = "loyalty_tier_silver";
    public const string LoyaltyTierGold      = "loyalty_tier_gold";
    public const string LoyaltyTierDiamond   = "loyalty_tier_diamond";

    // Site info
    public const string SiteName        = "site_name";
    public const string SiteDescription = "site_description";
    public const string ContactEmail    = "contact_email";
    public const string ContactPhone    = "contact_phone";

    // Operations
    public const string MaintenanceMode    = "maintenance_mode";
    public const string MaintenanceMessage = "maintenance_message";
    public const string RegistrationEnabled = "registration_enabled";
    public const string WelcomeBonus       = "welcome_bonus";

    // Transaction rules
    public const string MinWithdraw        = "min_withdraw";
    public const string MaxWithdraw        = "max_withdraw";
    // Giới hạn nạp/rút theo ngày theo cấp tài khoản (P1.3, §7.2). 0 hoặc âm = không giới hạn.
    public const string LimitDepositUnverified  = "limit_deposit_unverified";
    public const string LimitWithdrawUnverified = "limit_withdraw_unverified";
    public const string LimitDepositKyc         = "limit_deposit_kyc";
    public const string LimitWithdrawKyc        = "limit_withdraw_kyc";
    public const string LimitDepositSeller      = "limit_deposit_seller";
    public const string LimitWithdrawSeller     = "limit_withdraw_seller";
    public const string LimitDepositVip         = "limit_deposit_vip";
    public const string LimitWithdrawVip        = "limit_withdraw_vip";
    public const string EscrowReleaseDays  = "escrow_release_days";
    public const string DeliverWindowHours = "deliver_window_hours";
    public const string DisputeSlaHours    = "dispute_sla_hours";
    // Cọc đăng tin của seller (P1.4, §7). 0 = không giới hạn trên.
    public const string ListingDepositEnabled = "listing_deposit_enabled";
    public const string ListingDepositPercent = "listing_deposit_percent";
    public const string ListingDepositMin     = "listing_deposit_min";
    public const string ListingDepositMax     = "listing_deposit_max";
    public const string BoostDurationHours    = "boost_duration_hours";
    // Trust Score (P2.1, §8) — delta điểm uy tín
    public const string TrustStart           = "trust_start";
    public const string TrustComplete5Star   = "trust_complete_5star";
    public const string TrustCompleteNoReview = "trust_complete_noreview";
    public const string TrustReviewLow       = "trust_review_low";
    public const string TrustDisputeLost     = "trust_dispute_lost";
    public const string TrustLateDelivery    = "trust_late_delivery";
    public const string TrustViolation       = "trust_violation";
    public const string TrustClean30dBonus   = "trust_clean_30d_bonus";
    // Chống lạm dụng tranh chấp (P2.3) & partial refund mặc định (P2.4)
    public const string DisputeMaxPerMonth   = "dispute_max_per_month";
    public const string PartialRefundDefaultPercent = "partial_refund_default_percent";
    public const string KycRequiredToSell  = "kyc_required_to_sell";

    // Payment
    public const string EnabledPayments = "enabled_payments";
}

public class ConfigService
{
    private readonly IAppDbContext _db;
    public ConfigService(IAppDbContext db) => _db = db;

    public async Task<string?> GetAsync(string key, CancellationToken ct = default)
    {
        var c = await _db.SiteConfigs.FirstOrDefaultAsync(x => x.Key == key, ct);
        return c?.Value;
    }

    public async Task<decimal> GetDecimalAsync(string key, decimal defaultVal, CancellationToken ct = default)
    {
        var v = await GetAsync(key, ct);
        return v != null && decimal.TryParse(v, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : defaultVal;
    }

    public async Task<int> GetIntAsync(string key, int defaultVal, CancellationToken ct = default)
    {
        var v = await GetAsync(key, ct);
        return v != null && int.TryParse(v, out var i) ? i : defaultVal;
    }

    public async Task SetAsync(string key, string value, CancellationToken ct = default)
    {
        var c = await _db.SiteConfigs.FirstOrDefaultAsync(x => x.Key == key, ct);
        if (c == null)
        {
            c = new SiteConfig { Key = key, Value = value, UpdatedAt = DateTime.UtcNow };
            _db.SiteConfigs.Add(c);
        }
        else
        {
            c.Value = value;
            c.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task<bool> GetBoolAsync(string key, bool defaultVal, CancellationToken ct = default)
    {
        var v = await GetAsync(key, ct);
        return v == null ? defaultVal : v == "true";
    }

    public async Task SetBatchAsync(Dictionary<string, string> pairs, CancellationToken ct = default)
    {
        var keys = pairs.Keys.ToList();
        var existing = await _db.SiteConfigs.Where(c => keys.Contains(c.Key)).ToListAsync(ct);
        var map = existing.ToDictionary(c => c.Key);
        foreach (var (k, v) in pairs)
        {
            if (map.TryGetValue(k, out var cfg))
            {
                cfg.Value = v;
                cfg.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                _db.SiteConfigs.Add(new SiteConfig { Key = k, Value = v, UpdatedAt = DateTime.UtcNow });
            }
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task<Dictionary<string, string>> GetAllAsync(CancellationToken ct = default)
    {
        var all = await _db.SiteConfigs.ToListAsync(ct);
        return all.ToDictionary(c => c.Key, c => c.Value);
    }
}
