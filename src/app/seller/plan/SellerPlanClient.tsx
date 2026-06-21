"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Crown, Loader2, Sparkles, Wallet, X } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { sellerNav } from "@/lib/sellerNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiSellerPlan, ApiCurrentPlan, ApiWalletState, ApiBadgeInfo } from "@/lib/apiTypes";
import { formatVND } from "@/lib/format";

export function SellerPlanClient() {
  const { token, loading: authLoading, refresh } = useAuth();
  const [plans, setPlans] = useState<ApiSellerPlan[]>([]);
  const [current, setCurrent] = useState<ApiCurrentPlan | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [badgeInfo, setBadgeInfo] = useState<ApiBadgeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<ApiSellerPlan | null>(null);
  const [confirmBadge, setConfirmBadge] = useState(false);

  async function reload() {
    if (!token) return;
    try {
      setLoading(true);
      const [p, c, w, b] = await Promise.all([
        apiFetch<ApiSellerPlan[]>("/api/seller/plans", { token }),
        apiFetch<ApiCurrentPlan>("/api/seller/plan", { token }),
        apiFetch<ApiWalletState>("/api/wallet", { token }),
        apiFetch<ApiBadgeInfo>("/api/seller/badge-info", { token }),
      ]);
      setPlans(p);
      setCurrent(c);
      setBalance(w.balance);
      setBadgeInfo(b);
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
      setConfirmPlan(null);
      await reload();
      refresh();
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
      setConfirmBadge(false);
      await reload();
      refresh();
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
                <p className="text-text-muted">Số dư ví</p>
                <p className="font-bold text-text">{balance != null ? formatVND(balance) : "—"}</p>
                <Link href="/seller/wallet" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                  <Wallet className="size-3" /> Nạp ví
                </Link>
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
                  : badgeInfo
                    ? `${formatVND(badgeInfo.price)}/năm · điều kiện: ≥${badgeInfo.minReviews} đánh giá và rating ≥${badgeInfo.minRating.toFixed(1)}★`
                    : "Đang tải..."}
              </p>
            </div>
            {badgeActive ? (
              <Badge tone="success">Đã kích hoạt</Badge>
            ) : (
              <Button size="sm" variant="soft" disabled={buyingBadge} onClick={() => { setError(null); setConfirmBadge(true); }}
                leftIcon={buyingBadge ? <Loader2 className="size-3.5 animate-spin" /> : undefined}>
                {buyingBadge ? "Đang xử lý..." : "Mua badge Uy tín"}
              </Button>
            )}
          </div>

          {error && !confirmPlan && !confirmBadge && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              <span>{error}</span>
              {error.includes("Số dư ví") && (
                <Link href="/seller/wallet" className="inline-flex items-center gap-1 font-semibold text-accent underline">
                  <Wallet className="size-3.5" /> Nạp ví ngay →
                </Link>
              )}
            </div>
          )}

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
                        onClick={() => { setError(null); setConfirmPlan(p); }}
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

      {confirmPlan && (() => {
        const p = confirmPlan;
        const isRenew = current?.code === p.code && !!current?.active;
        const insufficient = balance != null && balance < p.pricePerMonth;
        const after = balance != null ? balance - p.pricePerMonth : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-full bg-brand/10"><Crown className="size-4 text-brand" /></div>
                  <span className="font-bold text-text">{isRenew ? "Gia hạn gói" : "Xác nhận đăng ký gói"}</span>
                </div>
                <button onClick={() => setConfirmPlan(null)} className="opacity-60 transition hover:opacity-100" disabled={busy === p.code}><X className="size-5" /></button>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-bg-elev px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-text">{p.name}</span>
                    {p.badge && <Badge tone={p.badge === "top" ? "warning" : "accent"}>{p.badge}</Badge>}
                  </div>
                  <span className="text-lg font-extrabold text-text">{formatVND(p.pricePerMonth)}<span className="text-xs font-normal text-text-muted">/tháng</span></span>
                </div>

                <ul className="space-y-2 text-sm text-text-muted">
                  <li className="flex items-center gap-2"><Check className="size-4 text-success" /> Giảm {p.feeDiscountPercent}% phí giao dịch</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-success" /> {p.maxListings < 0 ? "Không giới hạn tin đăng" : `Tối đa ${p.maxListings} tin đăng`}</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-success" /> {p.boostsPerMonth} lượt boost/tháng</li>
                  {p.badge && <li className="flex items-center gap-2"><Sparkles className="size-4 text-warning" /> Badge {p.badge}</li>}
                  <li className="flex items-center gap-2"><Check className="size-4 text-success" /> Hiệu lực 30 ngày{isRenew ? " (cộng dồn vào hạn hiện tại)" : ""}</li>
                </ul>

                <div className="space-y-1.5 rounded-2xl border border-border bg-bg-elev px-4 py-3 text-sm">
                  <div className="flex justify-between"><span className="text-text-muted">Số dư ví hiện tại</span><span className="font-semibold text-text">{balance != null ? formatVND(balance) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Phí gói</span><span className="font-semibold text-danger">-{formatVND(p.pricePerMonth)}</span></div>
                  <div className="flex justify-between border-t border-border pt-1.5"><span className="text-text-muted">Số dư sau khi trừ</span><span className={`font-bold ${insufficient ? "text-danger" : "text-text"}`}>{after != null ? formatVND(after) : "—"}</span></div>
                </div>

                {insufficient && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                    <span>Số dư ví không đủ để thanh toán.</span>
                    <Link href="/seller/wallet" className="inline-flex items-center gap-1 font-semibold text-accent underline"><Wallet className="size-3.5" /> Nạp ví ngay →</Link>
                  </div>
                )}

                {error && <p className="text-sm text-danger">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmPlan(null)} disabled={busy === p.code}>Huỷ</Button>
                  <Button className="flex-1" disabled={busy === p.code || insufficient} onClick={() => subscribe(p.code)}
                    leftIcon={busy === p.code ? <Loader2 className="size-4 animate-spin" /> : undefined}>
                    {busy === p.code ? "Đang xử lý..." : `Thanh toán ${formatVND(p.pricePerMonth)}`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmBadge && badgeInfo && (() => {
        const price = badgeInfo.price;
        const insufficient = balance != null && balance < price;
        const after = balance != null ? balance - price : null;
        const notEligible = !badgeInfo.eligible;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-8 place-items-center rounded-full bg-accent/10"><Sparkles className="size-4 text-accent" /></div>
                  <span className="font-bold text-text">Xác nhận mua badge Uy tín</span>
                </div>
                <button onClick={() => setConfirmBadge(false)} className="opacity-60 transition hover:opacity-100" disabled={buyingBadge}><X className="size-5" /></button>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div className="flex items-center justify-between rounded-2xl border border-border bg-bg-elev px-4 py-3">
                  <span className="text-base font-bold text-text">Badge &ldquo;Uy tín&rdquo;</span>
                  <span className="text-lg font-extrabold text-text">{formatVND(price)}<span className="text-xs font-normal text-text-muted">/năm</span></span>
                </div>

                <ul className="space-y-2 text-sm text-text-muted">
                  <li className="flex items-center gap-2"><Sparkles className="size-4 text-accent" /> Hiển thị badge Uy tín trên gian hàng & sản phẩm</li>
                  <li className="flex items-center gap-2"><Check className="size-4 text-success" /> Hiệu lực {badgeInfo.durationMonths} tháng{badgeActive ? " (cộng dồn vào hạn hiện tại)" : ""}</li>
                  <li className="flex items-center gap-2">
                    {notEligible ? <X className="size-4 text-danger" /> : <Check className="size-4 text-success" />}
                    Điều kiện: ≥{badgeInfo.minReviews} đánh giá và rating ≥{badgeInfo.minRating.toFixed(1)}★
                    <span className="text-text-dim">(hiện {badgeInfo.reviewCount} đánh giá, {badgeInfo.rating.toFixed(1)}★)</span>
                  </li>
                </ul>

                <div className="space-y-1.5 rounded-2xl border border-border bg-bg-elev px-4 py-3 text-sm">
                  <div className="flex justify-between"><span className="text-text-muted">Số dư ví hiện tại</span><span className="font-semibold text-text">{balance != null ? formatVND(balance) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Phí badge</span><span className="font-semibold text-danger">-{formatVND(price)}</span></div>
                  <div className="flex justify-between border-t border-border pt-1.5"><span className="text-text-muted">Số dư sau khi trừ</span><span className={`font-bold ${insufficient ? "text-danger" : "text-text"}`}>{after != null ? formatVND(after) : "—"}</span></div>
                </div>

                {notEligible && (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                    Chưa đủ điều kiện mua badge — cần ≥{badgeInfo.minReviews} đánh giá và rating ≥{badgeInfo.minRating.toFixed(1)}★.
                  </div>
                )}

                {insufficient && !notEligible && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                    <span>Số dư ví không đủ để thanh toán.</span>
                    <Link href="/seller/wallet" className="inline-flex items-center gap-1 font-semibold text-accent underline"><Wallet className="size-3.5" /> Nạp ví ngay →</Link>
                  </div>
                )}

                {error && <p className="text-sm text-danger">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmBadge(false)} disabled={buyingBadge}>Huỷ</Button>
                  <Button className="flex-1" disabled={buyingBadge || insufficient || notEligible} onClick={buyBadge}
                    leftIcon={buyingBadge ? <Loader2 className="size-4 animate-spin" /> : undefined}>
                    {buyingBadge ? "Đang xử lý..." : `Thanh toán ${formatVND(price)}`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-medium text-white shadow-xl">
          <Check className="size-4" /> {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
