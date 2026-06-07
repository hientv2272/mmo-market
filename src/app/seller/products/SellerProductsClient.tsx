"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Loader2, Plus, Rocket, Trash2, Upload } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { sellerNav } from "@/lib/sellerNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiBoostInfo, ApiCategory, ApiSellerProduct } from "@/lib/apiTypes";
import { formatNumber, formatVND } from "@/lib/format";

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "Active", label: "Đang bán" },
  { key: "Pending", label: "Chờ duyệt" },
  { key: "Rejected", label: "Bị từ chối" },
  { key: "Hidden", label: "Tạm ẩn" },
];

function statusBadge(status: string, stock: number) {
  if (status === "Pending") return <Badge tone="warning">Chờ duyệt</Badge>;
  if (status === "Rejected") return <Badge tone="danger">Từ chối</Badge>;
  if (status === "Hidden") return <Badge tone="muted">Đã ẩn</Badge>;
  if (stock === 0) return <Badge tone="muted">Hết hàng</Badge>;
  return <Badge tone="success">Đang bán</Badge>;
}

export function SellerProductsClient() {
  const { token, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<ApiSellerProduct[]>([]);
  const [cats, setCats] = useState<ApiCategory[]>([]);
  const [boost, setBoost] = useState<ApiBoostInfo | null>(null);
  const [boosting, setBoosting] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    categorySlug: "ai",
    price: 100000,
    comparePrice: 0,
    delivery: "Manual",
    warrantyDays: 30,
    stock: 0,
    thumbnailColor: "#7c3aed",
    thumbnailIcon: "🚀",
    description: "",
  });

  const reload = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, c, bi] = await Promise.all([
        apiFetch<ApiSellerProduct[]>("/api/seller/products", { token }),
        apiFetch<ApiCategory[]>("/api/categories"),
        apiFetch<ApiBoostInfo>("/api/seller/boost-info", { token }),
      ]);
      setProducts(list);
      setCats(c);
      setBoost(bi);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await apiFetch<ApiSellerProduct>("/api/seller/products", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: form.title,
          categorySlug: form.categorySlug,
          price: Number(form.price),
          comparePrice: form.comparePrice ? Number(form.comparePrice) : null,
          delivery: form.delivery,
          warrantyDays: Number(form.warrantyDays),
          stock: Number(form.stock),
          thumbnailColor: form.thumbnailColor,
          thumbnailIcon: form.thumbnailIcon,
          description: form.description,
        }),
      });
      setShowForm(false);
      setForm({ ...form, title: "", description: "" });
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!token || !confirm("Xoá sản phẩm này?")) return;
    try {
      await apiFetch(`/api/seller/products/${id}`, { method: "DELETE", token });
      await reload();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const onBoost = async (id: string) => {
    if (!token || !boost) return;
    let pay = false;
    if (boost.remaining <= 0) {
      if (!confirm(`Hết lượt boost miễn phí tháng này. Boost trả phí ${formatVND(boost.paidPrice)} từ ví?`)) return;
      pay = true;
    }
    setBoosting(id);
    try {
      await apiFetch(`/api/seller/products/${id}/boost${pay ? "?pay=true" : ""}`, { method: "POST", token });
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBoosting(null);
    }
  };

  const isBoosted = (p: ApiSellerProduct) => !!p.boostedUntil && new Date(p.boostedUntil).getTime() > Date.now();

  if (authLoading || loading) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Sản phẩm" subtitle="Đang tải...">
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-text-muted" />
        </div>
      </DashboardLayout>
    );
  }

  if (!token) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Sản phẩm" subtitle="">
        <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
          <p className="text-sm text-text-muted">
            Vui lòng <Link href="/login" className="text-accent hover:underline">đăng nhập</Link>.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Sản phẩm" subtitle="">
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">{error}</div>
      </DashboardLayout>
    );
  }

  const filtered = products.filter((p) => {
    if (tab !== "all" && p.status !== tab) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const summary = `${products.length} sản phẩm · ${products.filter((p) => p.status === "Pending").length} chờ duyệt · ${products.filter((p) => p.status === "Rejected").length} từ chối`;

  return (
    <DashboardLayout
      variant="seller"
      groups={sellerNav}
      title="Quản lý sản phẩm"
      subtitle={summary}
      topRight={
        <Button size="sm" leftIcon={<Plus className="size-3.5" />} onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Đóng form" : "Thêm sản phẩm"}
        </Button>
      }
    >
      {boost && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-bg-card p-4 text-sm">
          <Rocket className="size-5 text-brand" />
          <span className="text-text">Lượt boost tháng này: <b className="text-brand">{boost.remaining}/{boost.quota}</b> còn lại</span>
          <span className="text-text-muted">· đẩy tin lên đầu danh mục {boost.durationHours}h · hết lượt: trả phí <b className="text-text">{formatVND(boost.paidPrice)}</b>/lần</span>
          {boost.quota === 0 && <Link href="/seller/plan" className="ml-auto font-medium text-accent hover:underline">Nâng cấp gói để có lượt boost miễn phí →</Link>}
        </div>
      )}
      {showForm && (
        <form onSubmit={onCreate} className="mb-4 rounded-2xl border border-border bg-bg-card p-5">
          <h3 className="text-sm font-bold text-text">Sản phẩm mới (sẽ ở trạng thái Chờ duyệt)</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-text-muted">
              Tên sản phẩm
              <input className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="text-xs text-text-muted">
              Danh mục
              <select className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand" value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}>
                {cats.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-text-muted">
              Giá bán (VND)
              <input type="number" min={1000} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand" required value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-text-muted">
              Giá gốc (tuỳ chọn)
              <input type="number" min={0} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand" value={form.comparePrice} onChange={(e) => setForm({ ...form, comparePrice: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-text-muted">
              Hình thức giao
              <select className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand" value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value })}>
                <option value="Manual">Manual</option>
                <option value="Auto">Auto (kho có sẵn)</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </label>
            <label className="text-xs text-text-muted">
              Bảo hành (ngày)
              <input type="number" min={0} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand" value={form.warrantyDays} onChange={(e) => setForm({ ...form, warrantyDays: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-text-muted">
              Tồn kho ban đầu
              <input type="number" min={0} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-text-muted">
              Màu thumbnail
              <input className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand" value={form.thumbnailColor} onChange={(e) => setForm({ ...form, thumbnailColor: e.target.value })} />
            </label>
            <label className="text-xs text-text-muted">
              Icon (emoji 1 ký tự)
              <input maxLength={4} className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand" value={form.thumbnailIcon} onChange={(e) => setForm({ ...form, thumbnailIcon: e.target.value })} />
            </label>
            <label className="text-xs text-text-muted md:col-span-2">
              Mô tả
              <textarea rows={3} className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>{submitting ? "Đang gửi..." : "Tạo sản phẩm"}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Huỷ</Button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-border bg-bg-card">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-2 text-sm">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 ${tab === t.key ? "bg-brand text-white" : "text-text-muted hover:bg-bg-elev hover:text-text"}`}
            >
              {t.label}
            </button>
          ))}
          <input
            placeholder="Tìm sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ml-auto h-9 w-64 rounded-full border border-border bg-bg-elev px-4 text-xs text-text placeholder:text-text-dim outline-none focus:border-brand"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-text-muted">Chưa có sản phẩm nào.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3 text-right">Giá</th>
                <th className="px-4 py-3 text-right">Tồn kho</th>
                <th className="px-4 py-3 text-right">Đã bán</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-bg-elev/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
                        style={{ background: p.thumbnailColor }}
                      >
                        {p.thumbnailIcon ?? p.title[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="line-clamp-1 max-w-xs font-medium text-text">{p.title}</div>
                        <div className="text-xs text-text-muted">
                          {p.delivery === "Auto" ? "⚡ Auto" : p.delivery} · BH {p.warrantyDays}d · Kho {p.inventoryAvailable}
                        </div>
                        {p.depositAmount > 0 && p.depositStatus !== "None" && (
                          <div className="mt-0.5 text-[11px]">
                            {p.depositStatus === "Held" && <span className="text-warning">🔒 Cọc {formatVND(p.depositAmount)}</span>}
                            {p.depositStatus === "Refunded" && <span className="text-text-dim">Đã hoàn cọc {formatVND(p.depositAmount)}</span>}
                            {p.depositStatus === "Forfeited" && <span className="text-danger">Mất cọc {formatVND(p.depositAmount)}</span>}
                          </div>
                        )}
                        {isBoosted(p) && (
                          <div className="mt-0.5 text-[11px] text-brand">🚀 Đang Top đến {new Date(p.boostedUntil!).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="num font-semibold text-text">{formatVND(p.price)}</div>
                    {p.comparePrice ? (
                      <div className="num text-xs text-text-dim line-through">{formatVND(p.comparePrice)}</div>
                    ) : null}
                  </td>
                  <td className="num px-4 py-3 text-right text-text-muted">{formatNumber(p.stock)}</td>
                  <td className="num px-4 py-3 text-right text-text-muted">{formatNumber(p.sold)}</td>
                  <td className="px-4 py-3 text-center">{statusBadge(p.status, p.stock)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link href={`/p/${p.slug}`} title="Xem">
                        <Button variant="outline" size="sm" className="!h-8 !w-8 !px-0"><Eye className="size-3.5" /></Button>
                      </Link>
                      <Link href={`/seller/inventory?productId=${p.id}`} title="Kho">
                        <Button variant="outline" size="sm" className="!h-8 !w-8 !px-0"><Upload className="size-3.5" /></Button>
                      </Link>
                      {p.status === "Active" && !isBoosted(p) && (
                        <Button variant="outline" size="sm" className="!h-8 !w-8 !px-0 !text-brand" disabled={boosting === p.id} onClick={() => onBoost(p.id)} title={(boost?.remaining ?? 0) <= 0 ? `Boost trả phí ${formatVND(boost?.paidPrice ?? 0)}` : "Boost lên Top (miễn phí)"}>
                          {boosting === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="!h-8 !w-8 !px-0" onClick={() => onDelete(p.id)} title="Xoá">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DashboardLayout>
  );
}
