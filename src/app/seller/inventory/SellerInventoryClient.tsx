"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Database, Loader2, Upload, Pencil, Trash2, Eye, EyeOff, X } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { sellerNav } from "@/lib/sellerNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiSellerInventoryItem, ApiSellerInventoryView, ApiSellerProduct } from "@/lib/apiTypes";
import { formatRelativeTime } from "@/lib/format";

export function SellerInventoryClient() {
  const { token, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<ApiSellerProduct[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [view, setView] = useState<ApiSellerInventoryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ApiSellerInventoryItem | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<ApiSellerProduct[]>("/api/seller/products", { token })
      .then((p) => {
        setProducts(p);
        const first = p.find((pp) => pp.delivery === "Auto" || pp.delivery === "Hybrid") ?? p[0];
        if (first) setProductId(first.id);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !productId) return;
    apiFetch<ApiSellerInventoryView>(`/api/seller/inventory/${productId}`, { token })
      .then((v) => setView(v))
      .catch((e: Error) => setError(e.message));
  }, [token, productId]);

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !productId) return;
    const lines = items.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert("Hãy nhập ít nhất 1 mục (mỗi dòng = 1 tài khoản/code).");
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await apiFetch<{ added: number }>(`/api/seller/inventory/${productId}/upload`, {
        method: "POST",
        token,
        body: JSON.stringify({ items: lines }),
      });
      setMsg(`Đã thêm ${res.added}/${lines.length} mục (loại trùng tự động).`);
      setItems("");
      const v = await apiFetch<ApiSellerInventoryView>(`/api/seller/inventory/${productId}`, { token });
      setView(v);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleHold = async (it: ApiSellerInventoryItem) => {
    if (!token) return;
    setBusyId(it.id);
    try {
      const v = await apiFetch<ApiSellerInventoryView>(`/api/seller/inventory/item/${it.id}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ reserved: !it.reserved }),
      });
      setView(v);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (it: ApiSellerInventoryItem) => {
    if (!token) return;
    if (!confirm("Xoá mục này khỏi kho? Hành động không thể hoàn tác.")) return;
    setBusyId(it.id);
    try {
      const v = await apiFetch<ApiSellerInventoryView>(`/api/seller/inventory/item/${it.id}`, {
        method: "DELETE",
        token,
      });
      setView(v);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async () => {
    if (!token || !editTarget) return;
    const content = editContent.trim();
    if (!content) { alert("Nội dung không được để trống."); return; }
    setEditBusy(true);
    try {
      const v = await apiFetch<ApiSellerInventoryView>(`/api/seller/inventory/item/${editTarget.id}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ content }),
      });
      setView(v);
      setEditTarget(null);
      setEditContent("");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setEditBusy(false);
    }
  };

  if (authLoading || (token && loading)) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Kho auto-delivery" subtitle="Đang tải...">
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-text-muted" /></div>
      </DashboardLayout>
    );
  }

  if (!token) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Kho auto-delivery" subtitle="">
        <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
          <p className="text-sm text-text-muted">Vui lòng <Link href="/login" className="text-accent hover:underline">đăng nhập</Link>.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Kho auto-delivery" subtitle="">
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">{error}</div>
      </DashboardLayout>
    );
  }

  if (products.length === 0) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Kho auto-delivery" subtitle="">
        <div className="rounded-2xl border border-border bg-bg-card p-12 text-center text-sm text-text-muted">
          Bạn chưa có sản phẩm nào. <Link href="/seller/products" className="text-accent hover:underline">Tạo sản phẩm</Link> trước.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      variant="seller"
      groups={sellerNav}
      title="Kho auto-delivery"
      subtitle="Mỗi dòng = 1 tài khoản / gift code · trùng SHA-256 sẽ bị bỏ"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Có sẵn" value={String(view?.available ?? 0)} icon={<Database className="size-4" />} tone="brand" />
        <Stat label="Tạm ẩn" value={String(view?.reserved ?? 0)} tone="warning" />
        <Stat label="Đã giao" value={String(view?.soldCount ?? 0)} tone="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <form onSubmit={onUpload} className="lg:col-span-1 rounded-2xl border border-border bg-bg-card p-5">
          <h3 className="text-sm font-bold text-text">Upload kho</h3>
          <label className="mt-3 block text-xs text-text-muted">
            Sản phẩm
            <select
              className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
              value={productId ?? ""}
              onChange={(e) => setProductId(e.target.value || null)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs text-text-muted">
            Mỗi dòng = 1 tài khoản (định dạng tự do, ví dụ: <code>email|password</code> hoặc gift code)
            <textarea
              rows={10}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev p-3 font-mono text-xs text-text outline-none focus:border-brand"
              value={items}
              onChange={(e) => setItems(e.target.value)}
              placeholder="user1@mail.com|pass123\nXXXX-YYYY-ZZZZ-1234"
            />
          </label>
          <Button type="submit" size="sm" className="mt-3 w-full" disabled={submitting} leftIcon={<Upload className="size-3.5" />}>
            {submitting ? "Đang tải..." : "Upload"}
          </Button>
          {msg && <p className="mt-2 text-xs text-success">{msg}</p>}
        </form>

        <section className="lg:col-span-2 rounded-2xl border border-border bg-bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-sm font-bold text-text">Mục trong kho · {view?.items.length ?? 0}</h3>
          </div>
          {!view || view.items.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-text-muted">Kho trống.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-4 py-3">Mã</th>
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Tạo lúc</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {view.items.slice(0, 50).map((it) => (
                  <tr key={it.id} className="hover:bg-bg-elev/30">
                    <td className="px-4 py-3 font-mono text-[11px] text-text-muted">{it.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text">{it.preview}</td>
                    <td className="px-4 py-3 text-center">
                      {it.sold ? <Badge tone="success">Đã giao</Badge> : it.reserved ? <Badge tone="warning">Tạm ẩn</Badge> : <Badge tone="muted">Có sẵn</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-text-muted">{formatRelativeTime(it.createdAt)}</td>
                    <td className="px-4 py-3">
                      {it.sold ? (
                        <span className="block text-right text-xs text-text-dim">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={busyId === it.id}
                            onClick={() => toggleHold(it)}
                            title={it.reserved ? "Cho hiện lại (Có sẵn)" : "Tạm ẩn (không giao)"}
                            className="grid size-7 place-items-center rounded-md text-text-muted hover:bg-bg-elev hover:text-text disabled:opacity-50"
                          >
                            {busyId === it.id ? <Loader2 className="size-3.5 animate-spin" /> : it.reserved ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === it.id}
                            onClick={() => { setEditTarget(it); setEditContent(""); }}
                            title="Sửa nội dung"
                            className="grid size-7 place-items-center rounded-md text-text-muted hover:bg-bg-elev hover:text-text disabled:opacity-50"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === it.id}
                            onClick={() => removeItem(it)}
                            title="Xoá khỏi kho"
                            className="grid size-7 place-items-center rounded-md text-text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-text">Sửa nội dung mục kho</h3>
                <p className="text-xs text-text-muted">Mã {editTarget.id.slice(0, 8)} · nội dung cũ được ẩn vì lý do bảo mật. Nhập nội dung mới để thay thế.</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-text-muted hover:text-text"><X className="size-4" /></button>
            </div>
            <textarea
              rows={4}
              autoFocus
              placeholder="Nội dung mới, ví dụ: user1@mail.com|pass123"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="mt-4 w-full rounded-lg border border-border bg-bg-elev p-3 font-mono text-xs text-text outline-none focus:border-brand"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>Huỷ</Button>
              <Button size="sm" disabled={editBusy || !editContent.trim()} onClick={saveEdit}>{editBusy ? "Đang lưu..." : "Lưu"}</Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
