"use client";
import { useEffect, useState } from "react";
import {
  Loader2, ImagePlus, X, Store, Image as ImageIcon, Phone, Plane, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { sellerNav } from "@/lib/sellerNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import { fileToCompressedDataUrl } from "@/lib/imageUpload";
import type { ApiShopSettings } from "@/lib/apiTypes";

type FormState = {
  displayName: string;
  avatarColor: string;
  bio: string;
  responseTime: string;
  logoUrl: string;
  bannerUrl: string;
  contactEmail: string;
  contactZalo: string;
  contactTelegram: string;
  warrantyPolicy: string;
  returnPolicy: string;
  isOnVacation: boolean;
  vacationMessage: string;
};

const EMPTY: FormState = {
  displayName: "", avatarColor: "#7c3aed", bio: "", responseTime: "",
  logoUrl: "", bannerUrl: "", contactEmail: "", contactZalo: "", contactTelegram: "",
  warrantyPolicy: "", returnPolicy: "", isOnVacation: false, vacationMessage: "",
};

const RESPONSE_TIMES = ["Trong vài phút", "Trong 1 giờ", "Trong vài giờ", "Trong 24 giờ"];

function fromApi(s: ApiShopSettings): FormState {
  return {
    displayName: s.displayName ?? "",
    avatarColor: s.avatarColor || "#7c3aed",
    bio: s.bio ?? "",
    responseTime: s.responseTime ?? "",
    logoUrl: s.logoUrl ?? "",
    bannerUrl: s.bannerUrl ?? "",
    contactEmail: s.contactEmail ?? "",
    contactZalo: s.contactZalo ?? "",
    contactTelegram: s.contactTelegram ?? "",
    warrantyPolicy: s.warrantyPolicy ?? "",
    returnPolicy: s.returnPolicy ?? "",
    isOnVacation: s.isOnVacation ?? false,
    vacationMessage: s.vacationMessage ?? "",
  };
}

const inputCls =
  "mt-1 h-10 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand";
const textareaCls =
  "mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand";

export function SellerSettingsClient() {
  const { token, loading: authLoading } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);

  useEffect(() => {
    if (authLoading || !token) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<ApiShopSettings>("/api/seller/shop-settings", { token });
        if (alive) setForm(fromApi(data));
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authLoading, token]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onPickImage = async (
    file: File | undefined,
    key: "logoUrl" | "bannerUrl",
    setBusy: (b: boolean) => void,
  ) => {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, key === "bannerUrl" ? 1280 : 600);
      set(key, dataUrl);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (form.displayName.trim().length < 2) {
      setError("Tên shop phải có ít nhất 2 ký tự.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await apiFetch<ApiShopSettings>("/api/seller/shop-settings", {
        token,
        method: "PUT",
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          avatarColor: form.avatarColor,
          bio: form.bio,
          responseTime: form.responseTime,
          logoUrl: form.logoUrl || null,
          bannerUrl: form.bannerUrl || null,
          contactEmail: form.contactEmail,
          contactZalo: form.contactZalo,
          contactTelegram: form.contactTelegram,
          warrantyPolicy: form.warrantyPolicy,
          returnPolicy: form.returnPolicy,
          isOnVacation: form.isOnVacation,
          vacationMessage: form.vacationMessage,
        }),
      });
      setForm(fromApi(saved));
      setToast("Đã lưu cài đặt gian hàng.");
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout variant="seller" groups={sellerNav} title="Cài đặt shop" subtitle="Quản lý thông tin và cài đặt gian hàng">
      {loading ? (
        <div className="grid place-items-center py-24 text-text-muted">
          <Loader2 className="size-7 animate-spin" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6 pb-24">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              <AlertTriangle className="size-4 shrink-0" /> {error}
            </div>
          )}

          {/* 1. Hồ sơ gian hàng */}
          <section className="rounded-2xl border border-border bg-bg-card p-5">
            <header className="mb-4 flex items-center gap-2">
              <Store className="size-5 text-brand" />
              <h2 className="text-base font-semibold text-text">Hồ sơ gian hàng</h2>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs text-text-muted">
                Tên shop <span className="text-danger">*</span>
                <input className={inputCls} maxLength={80} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
              </label>
              <label className="text-xs text-text-muted">
                Thời gian phản hồi
                <input className={inputCls} list="response-times" placeholder="VD: Trong 1 giờ" maxLength={50} value={form.responseTime} onChange={(e) => set("responseTime", e.target.value)} />
                <datalist id="response-times">
                  {RESPONSE_TIMES.map((t) => <option key={t} value={t} />)}
                </datalist>
              </label>
              <label className="text-xs text-text-muted">
                Màu avatar
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-bg-elev" value={form.avatarColor} onChange={(e) => set("avatarColor", e.target.value)} />
                  <input className="h-10 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand" value={form.avatarColor} onChange={(e) => set("avatarColor", e.target.value)} />
                </div>
              </label>
              <label className="text-xs text-text-muted md:col-span-2">
                Giới thiệu shop (Bio)
                <textarea rows={3} maxLength={1000} className={textareaCls} placeholder="Giới thiệu ngắn về gian hàng của bạn..." value={form.bio} onChange={(e) => set("bio", e.target.value)} />
              </label>
            </div>
          </section>

          {/* 2. Ảnh shop */}
          <section className="rounded-2xl border border-border bg-bg-card p-5">
            <header className="mb-4 flex items-center gap-2">
              <ImageIcon className="size-5 text-brand" />
              <h2 className="text-base font-semibold text-text">Ảnh gian hàng</h2>
            </header>
            <div className="grid gap-5 md:grid-cols-2">
              <ImagePicker
                label="Logo shop (vuông · tối đa 2MB)"
                value={form.logoUrl}
                busy={logoBusy}
                shape="square"
                onPick={(f) => onPickImage(f, "logoUrl", setLogoBusy)}
                onClear={() => set("logoUrl", "")}
              />
              <ImagePicker
                label="Ảnh bìa (banner · tỉ lệ ngang · tối đa 2MB)"
                value={form.bannerUrl}
                busy={bannerBusy}
                shape="wide"
                onPick={(f) => onPickImage(f, "bannerUrl", setBannerBusy)}
                onClear={() => set("bannerUrl", "")}
              />
            </div>
          </section>

          {/* 3. Liên hệ & chính sách */}
          <section className="rounded-2xl border border-border bg-bg-card p-5">
            <header className="mb-4 flex items-center gap-2">
              <Phone className="size-5 text-brand" />
              <h2 className="text-base font-semibold text-text">Liên hệ &amp; chính sách</h2>
            </header>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs text-text-muted">
                Email liên hệ
                <input type="email" className={inputCls} maxLength={120} value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
              </label>
              <label className="text-xs text-text-muted">
                Zalo
                <input className={inputCls} maxLength={60} placeholder="SĐT / link Zalo" value={form.contactZalo} onChange={(e) => set("contactZalo", e.target.value)} />
              </label>
              <label className="text-xs text-text-muted">
                Telegram
                <input className={inputCls} maxLength={60} placeholder="@username" value={form.contactTelegram} onChange={(e) => set("contactTelegram", e.target.value)} />
              </label>
              <label className="text-xs text-text-muted md:col-span-3">
                Chính sách bảo hành
                <textarea rows={3} maxLength={2000} className={textareaCls} value={form.warrantyPolicy} onChange={(e) => set("warrantyPolicy", e.target.value)} />
              </label>
              <label className="text-xs text-text-muted md:col-span-3">
                Chính sách đổi trả / hoàn tiền
                <textarea rows={3} maxLength={2000} className={textareaCls} value={form.returnPolicy} onChange={(e) => set("returnPolicy", e.target.value)} />
              </label>
            </div>
          </section>

          {/* 4. Tạm nghỉ */}
          <section className="rounded-2xl border border-border bg-bg-card p-5">
            <header className="mb-4 flex items-center gap-2">
              <Plane className="size-5 text-brand" />
              <h2 className="text-base font-semibold text-text">Chế độ tạm nghỉ</h2>
            </header>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-bg-elev p-4">
              <input type="checkbox" className="mt-0.5 size-4 accent-brand" checked={form.isOnVacation} onChange={(e) => set("isOnVacation", e.target.checked)} />
              <span className="text-sm">
                <span className="font-medium text-text">Bật chế độ tạm nghỉ</span>
                <span className="mt-1 block text-xs text-text-muted">
                  Khi bật, gian hàng sẽ bị <b>ẩn khỏi marketplace</b> và <b>không nhận đơn mới</b>. Các đơn đang xử lý vẫn cần hoàn tất bình thường.
                </span>
              </span>
            </label>
            {form.isOnVacation && (
              <label className="mt-3 block text-xs text-text-muted">
                Thông báo tạm nghỉ (tuỳ chọn)
                <textarea rows={2} maxLength={500} className={textareaCls} placeholder="VD: Shop nghỉ lễ đến 30/6, sẽ phản hồi sớm nhất khi quay lại." value={form.vacationMessage} onChange={(e) => set("vacationMessage", e.target.value)} />
              </label>
            )}
          </section>

          {/* Thanh lưu cố định dưới */}
          <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-bg-card/95 px-4 py-3 backdrop-blur md:left-[260px]">
            <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
              <Button type="submit" disabled={saving} leftIcon={saving ? <Loader2 className="size-4 animate-spin" /> : undefined}>
                {saving ? "Đang lưu..." : "Lưu cài đặt"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {toast && (
        <div className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-xl border border-success/40 bg-success/15 px-4 py-3 text-sm text-success shadow-lg">
          <CheckCircle2 className="size-4" /> {toast}
        </div>
      )}
    </DashboardLayout>
  );
}

function ImagePicker({
  label, value, busy, shape, onPick, onClear,
}: {
  label: string;
  value: string;
  busy: boolean;
  shape: "square" | "wide";
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  const box = shape === "square" ? "size-28" : "h-28 w-full max-w-md";
  return (
    <div className="text-xs text-text-muted">
      {label}
      <div className="mt-2 flex items-start gap-3">
        <div className={`grid ${box} shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-bg-elev`}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="preview" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-7 text-text-dim" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-bg-elev px-3 py-1.5 text-xs font-medium text-text hover:border-brand">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            {value ? "Đổi ảnh" : "Chọn ảnh"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
          </label>
          {value && (
            <button type="button" onClick={onClear} className="inline-flex w-fit items-center gap-1 text-xs text-danger hover:underline">
              <X className="size-3.5" /> Gỡ ảnh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
