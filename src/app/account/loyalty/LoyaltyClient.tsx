"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, ChevronRight, Crown, Gift,
  Loader2, ShoppingBag, Star, Trophy, UserPlus,
  Wallet, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";

// ── Tier config ──────────────────────────────────────────────────────────────
type TierKey = "bronze" | "silver" | "gold" | "diamond";

const TIERS: Record<TierKey, {
  label: string; min: number; max: number | null;
  color: string; bg: string; ring: string; icon: React.ReactNode;
}> = {
  bronze:  { label: "Đồng",     min: 0,     max: 999,   color: "text-[#cd7f32]", bg: "bg-[#cd7f32]/10", ring: "ring-[#cd7f32]/40", icon: <Star className="size-5"  /> },
  silver:  { label: "Bạc",      min: 1000,  max: 4999,  color: "text-[#aab0bc]", bg: "bg-[#aab0bc]/10", ring: "ring-[#aab0bc]/40", icon: <Star className="size-5"  /> },
  gold:    { label: "Vàng",     min: 5000,  max: 14999, color: "text-warning",   bg: "bg-warning/10",   ring: "ring-warning/40",   icon: <Trophy className="size-5"/> },
  diamond: { label: "Kim cương",min: 15000, max: null,  color: "text-accent",    bg: "bg-accent/10",    ring: "ring-accent/40",    icon: <Crown className="size-5" /> },
};

function getTier(pts: number): TierKey {
  if (pts >= 15000) return "diamond";
  if (pts >= 5000)  return "gold";
  if (pts >= 1000)  return "silver";
  return "bronze";
}

function getNextTier(key: TierKey): TierKey | null {
  const order: TierKey[] = ["bronze", "silver", "gold", "diamond"];
  const idx = order.indexOf(key);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

// ── Earn rules ───────────────────────────────────────────────────────────────
const EARN_RULES = [
  { icon: <UserPlus  className="size-4" />, label: "Đăng ký tài khoản",     pts: "+100 điểm",  desc: "Một lần duy nhất khi tạo tài khoản mới" },
  { icon: <ShoppingBag className="size-4"/>, label: "Mua hàng",              pts: "+1 điểm / 1.000₫", desc: "Tự động cộng sau khi đơn hoàn thành" },
  { icon: <Star       className="size-4" />, label: "Viết đánh giá",         pts: "+50 điểm",   desc: "Sau khi đánh giá đơn hàng đã giao" },
  { icon: <UserPlus   className="size-4" />, label: "Giới thiệu bạn bè",     pts: "+200 điểm",  desc: "Mỗi người dùng đăng ký qua link của bạn" },
  { icon: <Zap        className="size-4" />, label: "Flash Sale",            pts: "x2 điểm",    desc: "Nhân đôi điểm cho đơn trong thời gian Flash Sale" },
];

// ── Reward catalog (tải từ API /api/loyalty/rewards) ──────────────────────────
type Reward = {
  id: string; title: string; desc: string;
  cost: number; icon: React.ReactNode; available: boolean;
};

function rewardIcon(type: string): React.ReactNode {
  if (type === "Shipping") return <Zap className="size-5" />;
  if (type === "Product") return <Crown className="size-5" />;
  return <Gift className="size-5" />;
}

// ── Component ────────────────────────────────────────────────────────────────
export function LoyaltyClient() {
  const { user, token, loading: authLoading, refresh } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redeeming, setRedeeming] = useState<Reward | null>(null);
  const [redeemed, setRedeemed] = useState<Set<string>>(new Set());
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [coupon, setCoupon] = useState<{ code: string; amount: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<{ id: string; title: string; description: string; pointsCost: number; type: string; voucherAmount: number; isComingSoon: boolean }[]>(
      "/api/loyalty/rewards",
      { token },
    )
      .then((rs) => setRewards(rs.map((r) => ({
        id: r.id, title: r.title, desc: r.description, cost: r.pointsCost,
        icon: rewardIcon(r.type), available: !r.isComingSoon,
      }))))
      .catch(() => { /* không chặn trang nếu lỗi tải rewards */ });
  }, [token]);

  if (authLoading) {
    return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-text-muted" /></div>;
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
        <p className="text-sm text-text-muted">
          Vui lòng <Link href="/login" className="text-accent hover:underline">đăng nhập</Link> để xem điểm thưởng.
        </p>
      </div>
    );
  }

  const pts = user.loyaltyPoints;
  const tierKey = getTier(pts);
  const tier = TIERS[tierKey];
  const nextKey = getNextTier(tierKey);
  const nextTier = nextKey ? TIERS[nextKey] : null;
  const progress = nextTier
    ? Math.min(100, Math.round(((pts - tier.min) / (nextTier.min - tier.min)) * 100))
    : 100;

  const handleRedeem = (r: Reward) => {
    if (pts < r.cost || redeemed.has(r.id) || !r.available) return;
    setRedeeming(r);
  };

  const confirmRedeem = async () => {
    if (!redeeming || !token) return;
    setRedeemBusy(true);
    try {
      const res = await apiFetch<{ couponCode: string; voucherAmount: number; pointsLeft: number }>(
        `/api/loyalty/redeem/${redeeming.id}`,
        { method: "POST", token },
      );
      setRedeemed((prev) => new Set(prev).add(redeeming.id));
      setCoupon({ code: res.couponCode, amount: res.voucherAmount });
      setRedeeming(null);
      await refresh(); // cập nhật điểm còn lại
    } catch (e) {
      alert(e instanceof Error ? e.message : "Đổi điểm thất bại");
    } finally {
      setRedeemBusy(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Hero — points + tier */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-warning/20 via-bg-card to-accent/10 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Points */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Điểm tích lũy của bạn</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="num text-5xl font-extrabold text-text">{pts.toLocaleString("vi")}</span>
              <span className="mb-1 text-lg font-semibold text-text-muted">điểm</span>
            </div>
            {nextTier && (
              <p className="mt-1 text-xs text-text-muted">
                Cần thêm <span className="font-semibold text-warning">{(nextTier.min - pts).toLocaleString("vi")} điểm</span> để lên hạng <span className="font-semibold">{nextTier.label}</span>
              </p>
            )}
          </div>

          {/* Tier badge */}
          <div className={`flex flex-col items-center gap-2 rounded-2xl border px-8 py-4 ${tier.bg} ring-2 ${tier.ring}`}>
            <div className={tier.color}>{tier.icon}</div>
            <span className={`text-base font-bold ${tier.color}`}>Hạng {tier.label}</span>
          </div>
        </div>

        {/* Progress bar to next tier */}
        {nextTier && (
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between text-[10px] text-text-dim">
              <span>{tier.label} ({tier.min.toLocaleString("vi")})</span>
              <span>{nextTier.label} ({nextTier.min.toLocaleString("vi")})</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-elev">
              <div
                className="h-full rounded-full bg-gradient-to-r from-warning to-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] text-text-dim">{progress}%</p>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Hạng thành viên"  value={`Hạng ${tier.label}`}  delta="Dựa trên điểm tích lũy"     icon={tier.icon}                            tone="warning" />
        <Stat label="Điểm có thể dùng" value={pts.toLocaleString("vi")} delta="Dùng để đổi ưu đãi bên dưới" icon={<Gift className="size-4" />}         tone="success" />
        <Stat label="Điểm tiếp theo"   value={nextTier ? (nextTier.min - pts).toLocaleString("vi") : "Tối đa"} delta={nextTier ? `Để lên hạng ${nextTier.label}` : "Đã đạt hạng cao nhất"} icon={<Trophy className="size-4" />} tone="brand" />
      </div>

      {/* Earn rules + Rewards — 2 col */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* How to earn */}
        <section className="rounded-2xl border border-border bg-bg-card p-5">
          <h2 className="text-sm font-bold text-text">Cách tích điểm</h2>
          <ul className="mt-3 space-y-2">
            {EARN_RULES.map((r) => (
              <li key={r.label} className="flex items-start gap-3 rounded-xl bg-bg-elev px-3 py-2.5">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
                  {r.icon}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text">{r.label}</span>
                    <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">{r.pts}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted">{r.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Tier benefits */}
        <section className="rounded-2xl border border-border bg-bg-card p-5">
          <h2 className="text-sm font-bold text-text">Quyền lợi theo hạng</h2>
          <div className="mt-3 space-y-2">
            {(Object.entries(TIERS) as [TierKey, typeof TIERS[TierKey]][]).map(([key, t]) => {
              const isActive = key === tierKey;
              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    isActive ? `${t.bg} border-transparent ring-1 ${t.ring}` : "border-border bg-bg-elev"
                  }`}
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${isActive ? t.bg : "bg-bg-card"} ${t.color}`}>
                    {t.icon}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${isActive ? t.color : "text-text-muted"}`}>
                        Hạng {t.label}
                      </span>
                      {isActive && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">Hiện tại</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {t.max ? `${t.min.toLocaleString("vi")} – ${t.max.toLocaleString("vi")} điểm` : `Từ ${t.min.toLocaleString("vi")} điểm`}
                    </p>
                  </div>
                  <ChevronRight className={`size-4 ${isActive ? t.color : "text-text-dim"}`} />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Rewards catalog */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-text">Đổi điểm lấy ưu đãi</h2>
          <span className="text-xs text-text-muted">Số dư: <span className="font-semibold text-warning">{pts.toLocaleString("vi")} điểm</span></span>
        </div>
        {rewards.length === 0 && (
          <p className="rounded-2xl border border-border bg-bg-card p-8 text-center text-sm text-text-muted">Chưa có ưu đãi nào để đổi.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => {
            const canAfford = pts >= r.cost;
            const done = redeemed.has(r.id);
            return (
              <div
                key={r.id}
                className={`relative flex flex-col rounded-2xl border bg-bg-card p-4 transition ${
                  done ? "border-success/40 bg-success/5" : canAfford && r.available ? "border-border hover:border-brand/50 hover:shadow-md hover:shadow-brand/10" : "border-border opacity-60"
                }`}
              >
                {/* Icon */}
                <div className={`grid size-10 place-items-center rounded-xl ${done ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                  {done ? <CheckCircle2 className="size-5" /> : r.icon}
                </div>

                <p className="mt-3 text-sm font-semibold text-text">{r.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">{r.desc}</p>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${canAfford ? "bg-warning/10 text-warning" : "bg-bg-elev text-text-dim"}`}>
                    {r.cost.toLocaleString("vi")} điểm
                  </span>
                  {done ? (
                    <span className="text-xs font-semibold text-success">Đã đổi ✓</span>
                  ) : !r.available ? (
                    <span className="text-xs text-text-dim">Sắp có</span>
                  ) : (
                    <Button
                      size="sm"
                      variant={canAfford ? "primary" : "outline"}
                      disabled={!canAfford}
                      onClick={() => handleRedeem(r)}
                    >
                      Đổi ngay
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {/* ── Confirm redeem modal ── */}
      {redeeming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h2 className="text-base font-bold text-text">Xác nhận đổi điểm</h2>
              <button onClick={() => setRedeeming(null)} className="rounded-lg p-1 text-text-muted hover:bg-bg-elev">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-bg-elev p-4 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-xl bg-warning/10 text-warning">
                {redeeming.icon}
              </div>
              <p className="mt-2 font-semibold text-text">{redeeming.title}</p>
              <p className="mt-1 text-xs text-text-muted">{redeeming.desc}</p>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-text-muted">
                <span>Điểm hiện có</span>
                <span className="font-semibold text-text">{pts.toLocaleString("vi")} điểm</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Điểm sử dụng</span>
                <span className="font-semibold text-danger">−{redeeming.cost.toLocaleString("vi")} điểm</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span className="text-text-muted">Điểm còn lại</span>
                <span className="text-warning">{(pts - redeeming.cost).toLocaleString("vi")} điểm</span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" disabled={redeemBusy} onClick={() => setRedeeming(null)}>Hủy</Button>
              <Button className="flex-1" disabled={redeemBusy} onClick={confirmRedeem}>{redeemBusy ? "Đang đổi..." : "Xác nhận"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Redeem success: show voucher code ── */}
      {coupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto grid size-12 place-items-center rounded-xl bg-success/10 text-success">
              <CheckCircle2 className="size-6" />
            </div>
            <h2 className="mt-3 text-base font-bold text-text">Đổi điểm thành công!</h2>
            <p className="mt-1 text-xs text-text-muted">Mã giảm {coupon.amount.toLocaleString("vi")}₫ đã được tạo. Dùng tại bước thanh toán (hết hạn sau 30 ngày).</p>
            <div className="mt-4 rounded-xl border border-dashed border-brand/50 bg-brand/5 px-4 py-3">
              <span className="num text-lg font-extrabold tracking-wider text-brand">{coupon.code}</span>
            </div>
            <Button className="mt-5 w-full" onClick={() => setCoupon(null)}>Đã hiểu</Button>
          </div>
        </div>
      )}
    </div>
  );
}
