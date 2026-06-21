"use client";
import { useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, CreditCard, Globe,
  Loader2, Lock, Rocket, Settings, Sparkles, Wrench,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { adminNav } from "@/lib/adminNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiSystemSettings } from "@/lib/apiTypes";
import { formatVND } from "@/lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────
const ALL_PAYMENTS = [
  { key: "Wallet",   label: "Ví nội bộ",   desc: "Thanh toán bằng số dư ví trên sàn" },
  { key: "VietQr",   label: "VietQR",      desc: "Chuyển khoản qua mã QR ngân hàng"  },
  { key: "Momo",     label: "MoMo",        desc: "Ví điện tử MoMo"                   },
  { key: "ZaloPay",  label: "ZaloPay",     desc: "Ví điện tử ZaloPay"                },
  { key: "VnPay",    label: "VNPay",       desc: "Cổng thanh toán VNPay"             },
  { key: "Usdt",     label: "USDT",        desc: "Stablecoin TRC20/ERC20"            },
  { key: "Btc",      label: "Bitcoin",     desc: "Thanh toán tiền điện tử BTC"       },
];

const DEFAULT_SETTINGS: ApiSystemSettings = {
  siteName: "MMO Market", siteDescription: "", contactEmail: "", contactPhone: "",
  maintenanceMode: false, maintenanceMessage: "Hệ thống đang bảo trì, vui lòng quay lại sau.",
  registrationEnabled: true, welcomeBonus: 100000,
  minWithdraw: 50000, maxWithdraw: 50000000, escrowReleaseDays: 3, disputeSlaHours: 72,
  kycRequiredToSell: true, enabledPayments: ["Wallet", "VietQr", "Momo"],
  trustBadgePrice: 200000, trustBadgeMinReviews: 50, trustBadgeMinRating: 4.5,
  boostDurationHours: 24, boostPaidPrice: 20000,
};

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({
  icon, title, desc, saving, onSave, children,
}: {
  icon: React.ReactNode; title: string; desc: string;
  saving: boolean; onSave: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">{icon}</div>
          <div>
            <h3 className="text-sm font-bold text-text">{title}</h3>
            <p className="text-xs text-text-muted mt-0.5">{desc}</p>
          </div>
        </div>
        <button onClick={onSave} disabled={saving}
          className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
      <div className="border-t border-border pt-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-text-muted">{label}</label>
      {hint && <p className="text-[11px] text-text-dim mb-1">{hint}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
  );
}

function Toggle({ checked, onChange, label, danger }: { checked: boolean; onChange: (v: boolean) => void; label: string; danger?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${checked && danger ? "border-danger/40 bg-danger/5" : "border-border hover:bg-bg-elev"}`}>
      <div className={`relative h-6 w-11 rounded-full transition-colors ${checked ? (danger ? "bg-danger" : "bg-brand") : "bg-text-muted/30"}`}
        onClick={() => onChange(!checked)}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "left-5" : "left-0.5"}`} />
      </div>
      <span className={`text-sm font-medium ${checked && danger ? "text-danger" : "text-text"}`}>{label}</span>
    </label>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, isErr }: { msg: string; isErr?: boolean }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl ${isErr ? "bg-danger" : "bg-success"}`}>
      {isErr ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />} {msg}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function AdminSettingsClient() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<ApiSystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; isErr?: boolean } | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  function showToast(msg: string, isErr?: boolean) {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 2500);
  }

  function set<K extends keyof ApiSystemSettings>(key: K, value: ApiSystemSettings[K]) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  useEffect(() => {
    if (!token) return;
    apiFetch<ApiSystemSettings>("/api/admin/config/settings", { token })
      .then(setSettings)
      .catch(() => showToast("Không thể tải cấu hình", true))
      .finally(() => setLoading(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(section: string, partial: Partial<ApiSystemSettings>) {
    setSaving(s => ({ ...s, [section]: true }));
    try {
      const merged = { ...settings, ...partial };
      const updated = await apiFetch<ApiSystemSettings>("/api/admin/config/settings", {
        token, method: "PUT", body: JSON.stringify(merged),
      });
      setSettings(updated);
      showToast("Đã lưu cấu hình");
    } catch (e: unknown) {
      showToast((e as Error).message || "Lỗi lưu cấu hình", true);
    } finally {
      setSaving(s => ({ ...s, [section]: false }));
    }
  }

  if (loading) {
    return (
      <DashboardLayout variant="admin" groups={adminNav} title="Cấu hình hệ thống" subtitle="">
        <div className="grid place-items-center py-20">
          <Loader2 className="size-8 animate-spin text-text-muted" />
        </div>
      </DashboardLayout>
    );
  }

  const s = settings;
  const paymentSet = new Set(s.enabledPayments);

  return (
    <DashboardLayout variant="admin" groups={adminNav} title="Cấu hình hệ thống" subtitle="Quản lý các thông số vận hành của sàn giao dịch">

      {/* Maintenance banner */}
      {s.maintenanceMode && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 px-5 py-4">
          <AlertTriangle className="size-5 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-bold text-danger">Chế độ bảo trì đang BẬT</p>
            <p className="text-xs text-danger/80 mt-0.5">Người dùng thông thường không thể truy cập sàn lúc này.</p>
          </div>
        </div>
      )}

      <div className="space-y-6">

        {/* ── 1. Thông tin sàn ── */}
        <Section
          icon={<Globe className="size-4" />}
          title="Thông tin sàn"
          desc="Tên, mô tả và thông tin liên hệ hiển thị công khai"
          saving={!!saving.site}
          onSave={() => save("site", { siteName: s.siteName, siteDescription: s.siteDescription, contactEmail: s.contactEmail, contactPhone: s.contactPhone })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên sàn *">
              <Input value={s.siteName} onChange={v => set("siteName", v)} placeholder="MMO Market" />
            </Field>
            <Field label="Email liên hệ">
              <Input type="email" value={s.contactEmail} onChange={v => set("contactEmail", v)} placeholder="support@mmomarket.vn" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Mô tả ngắn">
                <textarea value={s.siteDescription} onChange={e => set("siteDescription", e.target.value)} rows={2}
                  placeholder="Sàn giao dịch tài khoản MMO uy tín..."
                  className="w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand resize-none" />
              </Field>
            </div>
            <Field label="Số điện thoại liên hệ">
              <Input type="tel" value={s.contactPhone} onChange={v => set("contactPhone", v)} placeholder="0xxx xxx xxx" />
            </Field>
          </div>
        </Section>

        {/* ── 2. Vận hành ── */}
        <Section
          icon={<Wrench className="size-4" />}
          title="Vận hành"
          desc="Chế độ bảo trì, đăng ký tài khoản và thưởng chào mừng"
          saving={!!saving.ops}
          onSave={() => save("ops", { maintenanceMode: s.maintenanceMode, maintenanceMessage: s.maintenanceMessage, registrationEnabled: s.registrationEnabled, welcomeBonus: s.welcomeBonus })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-3">
              <Toggle
                checked={s.maintenanceMode}
                onChange={v => set("maintenanceMode", v)}
                label="Bật chế độ bảo trì (ngăn người dùng truy cập)"
                danger
              />
              <Toggle
                checked={s.registrationEnabled}
                onChange={v => set("registrationEnabled", v)}
                label="Cho phép đăng ký tài khoản mới"
              />
            </div>

            <div className="sm:col-span-2">
              <Field label="Thông báo bảo trì" hint="Hiển thị khi chế độ bảo trì được bật">
                <textarea value={s.maintenanceMessage} onChange={e => set("maintenanceMessage", e.target.value)} rows={2}
                  className="w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand resize-none" />
              </Field>
            </div>

            <Field label="Thưởng chào mừng (₫)" hint="Số dư ví tặng cho người dùng mới khi đăng ký">
              <div className="flex items-center gap-2">
                <Input type="number" value={s.welcomeBonus}
                  onChange={v => set("welcomeBonus", parseFloat(v) || 0)} />
                <span className="shrink-0 text-xs font-semibold text-brand">{formatVND(s.welcomeBonus)}</span>
              </div>
            </Field>
          </div>
        </Section>

        {/* ── 3. Giao dịch ── */}
        <Section
          icon={<Settings className="size-4" />}
          title="Quy định giao dịch"
          desc="Ngưỡng rút tiền, escrow, SLA tranh chấp và xác minh danh tính"
          saving={!!saving.tx}
          onSave={() => save("tx", { minWithdraw: s.minWithdraw, maxWithdraw: s.maxWithdraw, escrowReleaseDays: s.escrowReleaseDays, disputeSlaHours: s.disputeSlaHours, kycRequiredToSell: s.kycRequiredToSell })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rút tiền tối thiểu (₫)">
              <div className="flex items-center gap-2">
                <Input type="number" value={s.minWithdraw}
                  onChange={v => set("minWithdraw", parseFloat(v) || 0)} />
                <span className="shrink-0 text-xs font-semibold text-success">{formatVND(s.minWithdraw)}</span>
              </div>
            </Field>
            <Field label="Rút tiền tối đa (₫)">
              <div className="flex items-center gap-2">
                <Input type="number" value={s.maxWithdraw}
                  onChange={v => set("maxWithdraw", parseFloat(v) || 0)} />
                <span className="shrink-0 text-xs font-semibold text-danger">{formatVND(s.maxWithdraw)}</span>
              </div>
            </Field>
            <Field label="Tự động giải phóng escrow sau (ngày)" hint="Số ngày sau khi giao hàng, tiền sẽ về ví seller nếu không có tranh chấp">
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={30} value={s.escrowReleaseDays}
                  onChange={e => set("escrowReleaseDays", parseInt(e.target.value))}
                  className="flex-1 accent-brand" />
                <span className="w-16 rounded-lg border border-border bg-bg-elev px-2 py-1.5 text-center text-sm font-bold text-text">
                  {s.escrowReleaseDays} ngày
                </span>
              </div>
            </Field>
            <Field label="SLA xử lý tranh chấp (giờ)" hint="Thời hạn admin phải xử lý tranh chấp tính từ khi mở">
              <div className="flex items-center gap-3">
                <input type="range" min={12} max={168} step={12} value={s.disputeSlaHours}
                  onChange={e => set("disputeSlaHours", parseInt(e.target.value))}
                  className="flex-1 accent-brand" />
                <span className="w-20 rounded-lg border border-border bg-bg-elev px-2 py-1.5 text-center text-sm font-bold text-text">
                  {s.disputeSlaHours}h
                </span>
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Toggle
                checked={s.kycRequiredToSell}
                onChange={v => set("kycRequiredToSell", v)}
                label="Yêu cầu xác minh KYC trước khi đăng sản phẩm bán"
              />
            </div>
          </div>

          {/* Quick stats preview */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              { label: "Escrow tự giải phóng", value: `${s.escrowReleaseDays} ngày`, color: "text-success" },
              { label: "SLA tranh chấp", value: `${s.disputeSlaHours / 24} ngày (${s.disputeSlaHours}h)`, color: "text-warning" },
              { label: "Rút tối thiểu", value: formatVND(s.minWithdraw), color: "text-brand" },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-border bg-bg-elev p-3 text-center">
                <p className="text-xs text-text-muted">{item.label}</p>
                <p className={`mt-1 text-sm font-bold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 4. Phương thức thanh toán ── */}
        <Section
          icon={<CreditCard className="size-4" />}
          title="Phương thức thanh toán"
          desc="Bật/tắt các cổng thanh toán hỗ trợ trên sàn"
          saving={!!saving.pay}
          onSave={() => save("pay", { enabledPayments: s.enabledPayments })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {ALL_PAYMENTS.map(pm => {
              const on = paymentSet.has(pm.key);
              return (
                <label key={pm.key} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${on ? "border-brand/40 bg-brand/5" : "border-border hover:bg-bg-elev"}`}
                  onClick={() => {
                    const next = new Set(paymentSet);
                    on ? next.delete(pm.key) : next.add(pm.key);
                    set("enabledPayments", Array.from(next));
                  }}>
                  <div className={`grid size-5 shrink-0 place-items-center rounded-md border-2 transition-colors ${on ? "border-brand bg-brand" : "border-border"}`}>
                    {on && <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${on ? "text-brand" : "text-text"}`}>{pm.label}</p>
                    <p className="text-xs text-text-muted truncate">{pm.desc}</p>
                  </div>
                  {pm.key === "Wallet" && (
                    <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">Bắt buộc</span>
                  )}
                </label>
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-bg-elev p-3 flex items-center gap-3">
            <Lock className="size-4 shrink-0 text-text-muted" />
            <p className="text-xs text-text-muted">
              Hiện có <strong className="text-text">{s.enabledPayments.length}</strong> phương thức được bật.
              Ví nội bộ luôn cần bật để hệ thống refund và tặng thưởng hoạt động.
            </p>
          </div>
        </Section>

        {/* ── 5. Badge Uy tín ── */}
        <Section
          icon={<Sparkles className="size-4" />}
          title="Badge Uy tín"
          desc="Giá và điều kiện để seller mua badge Uy tín"
          saving={!!saving.badge}
          onSave={() => save("badge", { trustBadgePrice: s.trustBadgePrice, trustBadgeMinReviews: s.trustBadgeMinReviews, trustBadgeMinRating: s.trustBadgeMinRating })}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Giá badge / năm (₫)">
              <div className="flex items-center gap-2">
                <Input type="number" value={s.trustBadgePrice}
                  onChange={v => set("trustBadgePrice", parseFloat(v) || 0)} />
                <span className="shrink-0 text-xs font-semibold text-accent">{formatVND(s.trustBadgePrice)}</span>
              </div>
            </Field>
            <Field label="Tối thiểu số đánh giá" hint="Số đánh giá cần có để đủ điều kiện">
              <Input type="number" value={s.trustBadgeMinReviews}
                onChange={v => set("trustBadgeMinReviews", parseInt(v) || 0)} />
            </Field>
            <Field label="Rating tối thiểu (★)" hint="Từ 0 đến 5">
              <Input type="number" value={s.trustBadgeMinRating}
                onChange={v => set("trustBadgeMinRating", parseFloat(v) || 0)} />
            </Field>
          </div>
        </Section>

        {/* ── 6. Boost / Đẩy tin ── */}
        <Section
          icon={<Rocket className="size-4" />}
          title="Boost / Đẩy tin"
          desc="Thời lượng boost và phí boost khi seller hết lượt miễn phí trong gói"
          saving={!!saving.boost}
          onSave={() => save("boost", { boostDurationHours: s.boostDurationHours, boostPaidPrice: s.boostPaidPrice })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Thời lượng mỗi lượt boost (giờ)" hint="Sản phẩm được đẩy lên đầu danh mục trong bao lâu">
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={168} value={s.boostDurationHours}
                  onChange={e => set("boostDurationHours", parseInt(e.target.value))}
                  className="flex-1 accent-brand" />
                <span className="w-16 rounded-lg border border-border bg-bg-elev px-2 py-1.5 text-center text-sm font-bold text-text">
                  {s.boostDurationHours}h
                </span>
              </div>
            </Field>
            <Field label="Phí boost trả phí (₫)" hint="Chi phí mỗi lượt boost sau khi hết quota miễn phí của gói">
              <div className="flex items-center gap-2">
                <Input type="number" value={s.boostPaidPrice}
                  onChange={v => set("boostPaidPrice", parseFloat(v) || 0)} />
                <span className="shrink-0 text-xs font-semibold text-brand">{formatVND(s.boostPaidPrice)}</span>
              </div>
            </Field>
          </div>
        </Section>

      </div>

      {toast && <Toast msg={toast.msg} isErr={toast.isErr} />}
    </DashboardLayout>
  );
}
