"use client";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, ChevronDown, ChevronUp, Clock, Edit2, Image,
  Loader2, Plus, Tag, Trash2, XCircle, Zap,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { adminNav } from "@/lib/adminNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatVND } from "@/lib/format";
import type { ApiBanner, ApiFlashSale } from "@/lib/apiTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setLeft("Đã kết thúc"); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      setLeft(`${h}g ${m}p ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return <span className="font-mono text-xs text-warning">{left}</span>;
}

const STATUS_COLOR: Record<string, string> = {
  Draft:  "bg-text-muted/20 text-text-muted",
  Active: "bg-success/15 text-success",
  Ended:  "bg-danger/15 text-danger",
};
const STATUS_VI: Record<string, string> = { Draft: "Nháp", Active: "Đang chạy", Ended: "Đã kết thúc" };

// ── Banner Form Modal ──────────────────────────────────────────────────────────
type BannerForm = {
  title: string; subtitle: string; linkUrl: string;
  bgColor: string; textColor: string; position: number;
  isActive: boolean; startsAt: string; endsAt: string;
  costModel: string; rate: number;
};
const defaultBannerForm = (): BannerForm => ({
  title: "", subtitle: "", linkUrl: "", bgColor: "#7c3aed",
  textColor: "#ffffff", position: 1, isActive: true, startsAt: "", endsAt: "",
  costModel: "none", rate: 0,
});

function BannerModal({
  initial, onClose, onSave,
}: {
  initial: (BannerForm & { id?: string }) | null;
  onClose: () => void;
  onSave: (data: BannerForm & { id?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState<BannerForm>(
    initial ? { ...initial } : defaultBannerForm()
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof BannerForm, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave({ ...form, id: initial?.id }); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-text">{initial?.id ? "Chỉnh sửa" : "Thêm"} Banner</h3>

        {/* Preview */}
        <div className="rounded-xl p-4 text-center" style={{ background: form.bgColor, color: form.textColor }}>
          <p className="font-bold text-lg">{form.title || "Tiêu đề banner"}</p>
          <p className="text-sm opacity-80 mt-1">{form.subtitle || "Mô tả phụ"}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-text-muted">Tiêu đề *</label>
            <input required value={form.title} onChange={e => set("title", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-muted">Mô tả phụ</label>
            <input value={form.subtitle} onChange={e => set("subtitle", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-muted">Link URL</label>
            <input value={form.linkUrl} onChange={e => set("linkUrl", e.target.value)}
              placeholder="/products?category=ai"
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Màu nền</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={form.bgColor} onChange={e => set("bgColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-bg-elev p-1" />
              <input value={form.bgColor} onChange={e => set("bgColor", e.target.value)}
                className="flex-1 rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand font-mono" />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted">Màu chữ</label>
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={form.textColor} onChange={e => set("textColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-bg-elev p-1" />
              <input value={form.textColor} onChange={e => set("textColor", e.target.value)}
                className="flex-1 rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand font-mono" />
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted">Vị trí (thứ tự)</label>
            <input type="number" min={1} value={form.position} onChange={e => set("position", parseInt(e.target.value) || 1)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={form.isActive} onChange={e => set("isActive", e.target.checked)}
                className="size-4 accent-brand" />
              Hiển thị
            </label>
          </div>
          <div>
            <label className="text-xs text-text-muted">Bắt đầu (tuỳ chọn)</label>
            <input type="datetime-local" value={form.startsAt} onChange={e => set("startsAt", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Kết thúc (tuỳ chọn)</label>
            <input type="datetime-local" value={form.endsAt} onChange={e => set("endsAt", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Mô hình tính phí (quảng cáo)</label>
            <select value={form.costModel} onChange={e => set("costModel", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand">
              <option value="none">Không tính phí</option>
              <option value="cpm">CPM (giá / 1000 lượt hiển thị)</option>
              <option value="cpc">CPC (giá / lượt click)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Đơn giá (₫)</label>
            <input type="number" min={0} value={form.rate} onChange={e => set("rate", parseFloat(e.target.value) || 0)}
              disabled={form.costModel === "none"}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand disabled:opacity-50" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-bg-elev">
            Hủy
          </button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── FlashSale Form Modal ───────────────────────────────────────────────────────
type FlashForm = { title: string; discountPercent: number; startsAt: string; endsAt: string; status: string };
const defaultFlashForm = (): FlashForm => ({
  title: "", discountPercent: 20,
  startsAt: "", endsAt: "", status: "Draft",
});

function FlashModal({
  initial, onClose, onSave,
}: {
  initial: (FlashForm & { id?: string }) | null;
  onClose: () => void;
  onSave: (data: FlashForm & { id?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState<FlashForm>(initial ?? defaultFlashForm());
  const [saving, setSaving] = useState(false);

  const set = (k: keyof FlashForm, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.startsAt || !form.endsAt) return;
    setSaving(true);
    try { await onSave({ ...form, id: initial?.id }); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-text">{initial?.id ? "Chỉnh sửa" : "Thêm"} Flash Sale</h3>

        <div>
          <label className="text-xs text-text-muted">Tên chương trình *</label>
          <input required value={form.title} onChange={e => set("title", e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
        </div>
        <div>
          <label className="text-xs text-text-muted">Phần trăm giảm giá (%)</label>
          <input type="number" min={1} max={99} value={form.discountPercent}
            onChange={e => set("discountPercent", parseInt(e.target.value) || 10)}
            className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-muted">Bắt đầu *</label>
            <input required type="datetime-local" value={form.startsAt}
              onChange={e => set("startsAt", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Kết thúc *</label>
            <input required type="datetime-local" value={form.endsAt}
              onChange={e => set("endsAt", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
        </div>
        {initial?.id && (
          <div>
            <label className="text-xs text-text-muted">Trạng thái</label>
            <select value={form.status} onChange={e => set("status", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand">
              <option value="Draft">Nháp</option>
              <option value="Active">Đang chạy</option>
              <option value="Ended">Kết thúc</option>
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-bg-elev">
            Hủy
          </button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Confirm Delete Modal ───────────────────────────────────────────────────────
function ConfirmDelete({ label, onConfirm, onClose }: { label: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-6 shadow-xl text-center space-y-4">
        <Trash2 className="mx-auto size-10 text-danger" />
        <p className="text-sm text-text">Xác nhận xóa <strong>{label}</strong>?</p>
        <div className="flex gap-2 justify-center">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-bg-elev">Hủy</button>
          <button onClick={async () => { setLoading(true); await onConfirm(); onClose(); }}
            disabled={loading}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white hover:bg-danger/90 disabled:opacity-60">
            {loading ? "Đang xóa..." : "Xóa"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function AdminBannersClient() {
  const { token } = useAuth();
  const [tab, setTab] = useState<"banners" | "flash">("banners");
  const [banners, setBanners] = useState<ApiBanner[]>([]);
  const [flashSales, setFlashSales] = useState<ApiFlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [bannerModal, setBannerModal] = useState<(ReturnType<typeof defaultBannerForm> & { id?: string }) | null | "new">(null);
  const [flashModal, setFlashModal] = useState<(ReturnType<typeof defaultFlashForm> & { id?: string }) | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "banner" | "flash"; id: string; label: string } | null>(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [b, f] = await Promise.all([
        apiFetch<ApiBanner[]>("/api/admin/banners", { token }),
        apiFetch<ApiFlashSale[]>("/api/admin/flash-sales", { token }),
      ]);
      setBanners(b);
      setFlashSales(f);
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveBanner(data: ReturnType<typeof defaultBannerForm> & { id?: string }) {
    const body = {
      title: data.title, subtitle: data.subtitle, linkUrl: data.linkUrl || null,
      bgColor: data.bgColor, textColor: data.textColor, position: data.position,
      isActive: data.isActive,
      startsAt: data.startsAt ? new Date(data.startsAt).toISOString() : null,
      endsAt: data.endsAt ? new Date(data.endsAt).toISOString() : null,
      costModel: data.costModel, rate: data.rate,
    };
    if (data.id) {
      const updated = await apiFetch<ApiBanner>(`/api/admin/banners/${data.id}`, { token, method: "PUT", body: JSON.stringify(body) });
      setBanners(bs => bs.map(b => b.id === data.id ? updated : b));
    } else {
      const created = await apiFetch<ApiBanner>("/api/admin/banners", { token, method: "POST", body: JSON.stringify(body) });
      setBanners(bs => [...bs, created]);
    }
  }

  async function toggleBanner(id: string) {
    const updated = await apiFetch<ApiBanner>(`/api/admin/banners/${id}/toggle`, { token, method: "POST" });
    setBanners(bs => bs.map(b => b.id === id ? updated : b));
  }

  async function deleteBanner(id: string) {
    await apiFetch(`/api/admin/banners/${id}`, { token, method: "DELETE" });
    setBanners(bs => bs.filter(b => b.id !== id));
  }

  async function saveFlash(data: ReturnType<typeof defaultFlashForm> & { id?: string }) {
    const body = {
      title: data.title, discountPercent: data.discountPercent,
      startsAt: new Date(data.startsAt).toISOString(),
      endsAt: new Date(data.endsAt).toISOString(),
      status: data.status,
    };
    if (data.id) {
      const updated = await apiFetch<ApiFlashSale>(`/api/admin/flash-sales/${data.id}`, { token, method: "PUT", body: JSON.stringify(body) });
      setFlashSales(fs => fs.map(f => f.id === data.id ? updated : f));
    } else {
      const created = await apiFetch<ApiFlashSale>("/api/admin/flash-sales", { token, method: "POST", body: JSON.stringify(body) });
      setFlashSales(fs => [created, ...fs]);
    }
  }

  async function deleteFlash(id: string) {
    await apiFetch(`/api/admin/flash-sales/${id}`, { token, method: "DELETE" });
    setFlashSales(fs => fs.filter(f => f.id !== id));
  }

  function openEditBanner(b: ApiBanner) {
    setBannerModal({
      id: b.id, title: b.title, subtitle: b.subtitle,
      linkUrl: b.linkUrl ?? "", bgColor: b.bgColor, textColor: b.textColor,
      position: b.position, isActive: b.isActive,
      startsAt: toLocalInput(b.startsAt), endsAt: toLocalInput(b.endsAt),
      costModel: b.costModel ?? "none", rate: b.rate ?? 0,
    });
  }

  function openEditFlash(f: ApiFlashSale) {
    setFlashModal({
      id: f.id, title: f.title, discountPercent: f.discountPercent,
      startsAt: toLocalInput(f.startsAt), endsAt: toLocalInput(f.endsAt),
      status: f.status,
    });
  }

  return (
    <DashboardLayout variant="admin" groups={adminNav} title="Banner & Flash Sale" subtitle="Quản lý banner trang chủ và chương trình flash sale">

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border bg-bg-elev p-1 w-fit">
        {(["banners", "flash"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === t ? "bg-bg-card text-brand shadow" : "text-text-muted hover:text-text"}`}>
            {t === "banners" ? <span className="flex items-center gap-2"><Image className="size-4" />Banner ({banners.length})</span>
              : <span className="flex items-center gap-2"><Zap className="size-4" />Flash Sale ({flashSales.length})</span>}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid place-items-center py-20">
          <Loader2 className="size-8 animate-spin text-text-muted" />
        </div>
      )}
      {err && <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{err}</div>}

      {/* ── Banners Tab ── */}
      {!loading && tab === "banners" && (
        <div className="space-y-4">
          {/* Stats + Add */}
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div className="rounded-xl border border-border bg-bg-card px-4 py-2 text-center">
                <p className="text-xs text-text-muted">Tổng banner</p>
                <p className="text-lg font-bold text-text">{banners.length}</p>
              </div>
              <div className="rounded-xl border border-border bg-bg-card px-4 py-2 text-center">
                <p className="text-xs text-text-muted">Đang hiển thị</p>
                <p className="text-lg font-bold text-success">{banners.filter(b => b.isActive).length}</p>
              </div>
              <div className="rounded-xl border border-border bg-bg-card px-4 py-2 text-center">
                <p className="text-xs text-text-muted">Tổng lượt click</p>
                <p className="text-lg font-bold text-accent">{banners.reduce((s, b) => s + b.clickCount, 0).toLocaleString("vi")}</p>
              </div>
            </div>
            <button onClick={() => setBannerModal("new")}
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
              <Plus className="size-4" /> Thêm banner
            </button>
          </div>

          {banners.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-border py-16 text-center">
              <Image className="mx-auto mb-3 size-10 text-text-muted" />
              <p className="text-sm text-text-muted">Chưa có banner nào</p>
            </div>
          )}

          {/* Banner cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {banners.map(b => (
              <div key={b.id} className="rounded-2xl border border-border bg-bg-card overflow-hidden">
                {/* Preview */}
                <div className="relative h-28 flex flex-col items-center justify-center px-4 text-center"
                  style={{ background: b.bgColor, color: b.textColor }}>
                  <p className="font-bold text-base leading-tight">{b.title}</p>
                  <p className="text-xs mt-1 opacity-80">{b.subtitle}</p>
                  <span className="absolute top-2 left-2 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold text-white">
                    #{b.position}
                  </span>
                  <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${b.isActive ? "bg-success/30 text-white" : "bg-black/40 text-white/70"}`}>
                    {b.isActive ? "LIVE" : "OFF"}
                  </span>
                </div>

                {/* Details */}
                <div className="p-3 space-y-2">
                  {b.linkUrl && (
                    <p className="truncate text-xs text-text-muted">
                      <Tag className="mr-1 inline size-3" />{b.linkUrl}
                    </p>
                  )}
                  {(b.startsAt || b.endsAt) && (
                    <p className="text-xs text-text-muted">
                      <Clock className="mr-1 inline size-3" />
                      {b.startsAt ? fmtDate(b.startsAt) : "∞"} → {b.endsAt ? fmtDate(b.endsAt) : "∞"}
                    </p>
                  )}
                  <p className="text-xs text-text-dim">
                    {b.viewCount.toLocaleString("vi")} hiển thị · {b.clickCount.toLocaleString("vi")} click
                    {b.costModel !== "none" && (
                      <> · {b.costModel.toUpperCase()} {formatVND(b.rate)} → <span className="font-semibold text-text">{formatVND(b.estimatedCost)}</span></>
                    )}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={() => toggleBanner(b.id)}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${b.isActive ? "bg-success/15 text-success hover:bg-success/25" : "bg-bg-elev text-text-muted hover:bg-border"}`}>
                      {b.isActive ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                      {b.isActive ? "Ẩn" : "Hiện"}
                    </button>
                    <button onClick={() => openEditBanner(b)}
                      className="flex items-center gap-1 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20">
                      <Edit2 className="size-3" /> Sửa
                    </button>
                    <button onClick={() => setDeleteTarget({ type: "banner", id: b.id, label: b.title })}
                      className="ml-auto rounded-lg bg-danger/10 px-2 py-1.5 text-xs text-danger hover:bg-danger/20">
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Flash Sale Tab ── */}
      {!loading && tab === "flash" && (
        <div className="space-y-4">
          {/* Stats + Add */}
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              {(["Active", "Draft", "Ended"] as const).map(s => (
                <div key={s} className="rounded-xl border border-border bg-bg-card px-4 py-2 text-center">
                  <p className="text-xs text-text-muted">{STATUS_VI[s]}</p>
                  <p className={`text-lg font-bold ${s === "Active" ? "text-success" : s === "Draft" ? "text-text-muted" : "text-danger"}`}>
                    {flashSales.filter(f => f.status === s).length}
                  </p>
                </div>
              ))}
            </div>
            <button onClick={() => setFlashModal("new")}
              className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
              <Plus className="size-4" /> Tạo Flash Sale
            </button>
          </div>

          {flashSales.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-border py-16 text-center">
              <Zap className="mx-auto mb-3 size-10 text-text-muted" />
              <p className="text-sm text-text-muted">Chưa có flash sale nào</p>
            </div>
          )}

          <div className="space-y-3">
            {flashSales.map(f => (
              <div key={f.id} className="rounded-2xl border border-border bg-bg-card p-4">
                <div className="flex items-start gap-4">
                  {/* Discount badge */}
                  <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-danger text-white">
                    <span className="text-xl font-extrabold leading-none">-{f.discountPercent}%</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-text">{f.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLOR[f.status] ?? "bg-bg-elev text-text-muted"}`}>
                        {STATUS_VI[f.status] ?? f.status}
                      </span>
                      {f.productCount > 0 && (
                        <span className="text-xs text-text-muted">{f.productCount} sản phẩm</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-text-muted">
                      <Clock className="mr-1 inline size-3" />
                      {fmtDate(f.startsAt)} → {fmtDate(f.endsAt)}
                    </p>
                    {f.status === "Active" && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-text-muted">
                        Còn lại: <Countdown endsAt={f.endsAt} />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEditFlash(f)}
                      className="rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/20">
                      <Edit2 className="size-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget({ type: "flash", id: f.id, label: f.title })}
                      className="rounded-lg bg-danger/10 px-3 py-1.5 text-xs text-danger hover:bg-danger/20">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {bannerModal !== null && (
        <BannerModal
          initial={bannerModal === "new" ? null : bannerModal}
          onClose={() => setBannerModal(null)}
          onSave={saveBanner}
        />
      )}
      {flashModal !== null && (
        <FlashModal
          initial={flashModal === "new" ? null : flashModal}
          onClose={() => setFlashModal(null)}
          onSave={saveFlash}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          label={deleteTarget.label}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            if (deleteTarget.type === "banner") await deleteBanner(deleteTarget.id);
            else await deleteFlash(deleteTarget.id);
          }}
        />
      )}
    </DashboardLayout>
  );
}
