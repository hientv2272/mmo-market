"use client";
import { useEffect, useState } from "react";
import { Check, Crown, Loader2, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { sellerNav } from "@/lib/sellerNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiSellerPlan, ApiCurrentPlan } from "@/lib/apiTypes";
import { formatVND } from "@/lib/format";

export function SellerPlanClient() {
  const { token, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<ApiSellerPlan[]>([]);
  const [current, setCurrent] = useState<ApiCurrentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function reload() {
    if (!token) return;
    try {
      setLoading(true);
      const [p, c] = await Promise.all([
        apiFetch<ApiSellerPlan[]>("/api/seller/plans", { token }),
        apiFetch<ApiCurrentPlan>("/api/seller/plan", { token }),
      ]);
      setPlans(p);
      setCurrent(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (!authLoading) reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [authLoading, token]);

  async function subscribe(code: string) {
    if (!token) return;
    setBusy(code);
    setError(null);
    try {
      await apiFetch<ApiCurrentPlan>("/api/seller/plan/subscribe", {
        token, method: "POST", body: JSON.stringify({ planCode: code }),
      });
      setToast("Đăng ký gói thành công");
      setTimeout(() => setToast(null), 2500);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng ký gói thất bại");
    } finally {
      setBusy(null);
    }
  }

  const [buyingBadge, setBuyingBadge] = useState(false);
  async function buyBadge() {
    if (!token) return;
    setBuyingBadge(true);
    setError(null);
    try {
      await apiFetch<ApiCurrentPlan>("/api/seller/trust-badge", { token, method: "POST" });
      setToast("Đã mua badge Uy tín");
      setTimeout(() => setToast(null), 2500);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mua badge thất bại");
    } finally {
      setBuyingBadge(false);
    }
  }

  const badgeActive = !!current?.trustBadgeUntil && new Date(current.trustBadgeUntil).getTime() > Date.now();

  return (
    <DashboardLayout variant="seller" groups={sellerNav} title="Gói thành viên Seller" subtitle="Giảm phí giao dịch, tăng hạn mức tin đăng và quyền lợi hiển thị">
      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-8 animate-spin text-text-muted" /></div>
      ) : (
        <>
          {current && (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-bg-card p-5">
              <Crown className="size-6 text-warning" />
              <div className="flex-1">
                <p className="text-sm text-text-muted">Gói hiện tại</p>
                <p className="text-lg font-bold text-text">{current.name}
                  {current.active && current.expiresAt && (
                    <span className="ml-2 text-xs font-normal text-text-muted">
                      (hết hạn {new Date(current.expiresAt).toLocaleDateString("vi-VN")})
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="text-text-muted">Giảm phí</p>
                <p className="font-bold text-success">{current.feeDiscountPercent}%</p>
              </div>
            </div>
          )}

          {/* Badge Uy tín (§3.4) */}
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-bg-card p-5">
            <Sparkles className="size-6 text-accent" />
            <div className="flex-1">
              <p className="text-sm font-bold text-text">Badge &ldquo;Uy tín&rdquo;</p>
              <p className="text-xs text-text-muted">
                {badgeActive
                  ? `Đang hiệu lực đến ${new Date(current!.trustBadgeUntil!).toLocaleDateString("vi-VN")}`
                  : "200.000đ/năm · điều kiện: ≥50 đánh giá và rating ≥4.5★"}
              </p>
            </div>
            {badgeActive ? (
              <Badge tone="success">Đã kích hoạt</Badge>
            ) : (
              <Button size="sm" variant="soft" disabled={buyingBadge} onClick={buyBadge}
                leftIcon={buyingBadge ? <Loader2 className="size-3.5 animate-spin" /> : undefined}>
                {buyingBadge ? "Đang xử lý..." : "Mua badge Uy tín"}
              </Button>
            )}
          </div>

          {error && <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => {
              const isCurrent = current?.code === p.code && (p.code === "free" || current?.active);
              return (
                <div key={p.code} className={`flex flex-col rounded-2xl border bg-bg-card p-5 ${isCurrent ? "border-brand ring-1 ring-brand" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-text">{p.name}</h3>
                    {p.badge && <Badge tone={p.badge === "top" ? "warning" : "accent"}>{p.badge}</Badge>}
                  </div>
                  <p className="mt-2 text-2xl font-extrabold text-text">
                    {p.pricePerMonth === 0 ? "Miễn phí" : formatVND(p.pricePerMonth)}
                    {p.pricePerMonth > 0 && <span className="text-sm font-normal text-text-muted">/tháng</span>}
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-text-muted">
                    <li className="flex items-center gap-2"><Check className="size-4 text-success" /> Giảm {p.feeDiscountPercent}% phí giao dịch</li>
                    <li className="flex items-center gap-2"><Check className="size-4 text-success" /> {p.maxListings < 0 ? "Không giới hạn tin đăng" : `Tối đa ${p.maxListings} tin đăng`}</li>
                    <li className="flex items-center gap-2"><Check className="size-4 text-success" /> {p.boostsPerMonth} lượt boost/tháng</li>
                    {p.badge && <li className="flex items-center gap-2"><Sparkles className="size-4 text-warning" /> Badge {p.badge}</li>}
                  </ul>
                  <div className="mt-5">
                    {isCurrent ? (
                      <Button variant="soft" size="sm" disabled className="w-full">Đang dùng</Button>
                    ) : p.code === "free" ? (
                      <Button variant="outline" size="sm" disabled className="w-full">Gói mặc định</Button>
                    ) : (
                      <Button size="sm" className="w-full" disabled={busy === p.code}
                        onClick={() => subscribe(p.code)}
                        leftIcon={busy === p.code ? <Loader2 className="size-3.5 animate-spin" /> : undefined}>
                        {busy === p.code ? "Đang xử lý..." : "Đăng ký"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs text-text-dim">* Phí gói được trừ trực tiếp từ số dư ví. Gia hạn cùng gói sẽ cộng dồn thời hạn 30 ngày.</p>
        </>
      )}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-medium text-white shadow-xl">
          <Check className="size-4" /> {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
