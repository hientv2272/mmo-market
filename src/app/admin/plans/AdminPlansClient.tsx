"use client";
import { useEffect, useState } from "react";
import { Crown, Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/Badge";
import { adminNav } from "@/lib/adminNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiAdminPlan } from "@/lib/apiTypes";
import { formatVND } from "@/lib/format";

type PlanForm = {
  code: string; name: string; pricePerMonth: number; feeDiscountPercent: number;
  maxListings: number; boostsPerMonth: number; badge: string; position: number; isActive: boolean;
};
const emptyForm = (): PlanForm => ({
  code: "", name: "", pricePerMonth: 0, feeDiscountPercent: 0,
  maxListings: 10, boostsPerMonth: 0, badge: "", position: 1, isActive: true,
});

function PlanModal({ initial, onClose, onSave }: {
  initial: (PlanForm & { id?: string }) | null;
  onClose: () => void;
  onSave: (data: PlanForm & { id?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState<PlanForm>(initial ?? emptyForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof PlanForm, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr(null);
    try { await onSave({ ...form, id: initial?.id }); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Lỗi lưu gói"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-6 space-y-4 shadow-xl">
        <h3 className="text-base font-bold text-text">{initial?.id ? "Sửa" : "Thêm"} gói thành viên</h3>
        {err && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-muted">Mã gói (code) *</label>
            <input required value={form.code} onChange={e => set("code", e.target.value)} placeholder="vd: pro"
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Tên hiển thị *</label>
            <input required value={form.name} onChange={e => set("name", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Giá/tháng (₫)</label>
            <input type="number" min={0} value={form.pricePerMonth} onChange={e => set("pricePerMonth", parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Giảm phí (%)</label>
            <input type="number" min={0} max={100} value={form.feeDiscountPercent} onChange={e => set("feeDiscountPercent", parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Giới hạn tin (-1 = ∞)</label>
            <input type="number" value={form.maxListings} onChange={e => set("maxListings", parseInt(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Boost/tháng</label>
            <input type="number" min={0} value={form.boostsPerMonth} onChange={e => set("boostsPerMonth", parseInt(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Badge (verified/top, trống = không)</label>
            <input value={form.badge} onChange={e => set("badge", e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-xs text-text-muted">Vị trí (thứ tự)</label>
            <input type="number" min={0} value={form.position} onChange={e => set("position", parseInt(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-bg-elev px-3 py-2 text-sm text-text outline-none focus:border-brand" />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={form.isActive} onChange={e => set("isActive", e.target.checked)} className="size-4 accent-brand" />
          Đang bật (hiển thị cho seller mua)
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-bg-elev">Hủy</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AdminPlansClient() {
  const { token } = useAuth();
  const [plans, setPlans] = useState<ApiAdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<(PlanForm & { id?: string }) | null | "new">(null);

  async function load() {
    if (!token) return;
    setLoading(true);
    try { setPlans(await apiFetch<ApiAdminPlan[]>("/api/admin/plans", { token })); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function save(data: PlanForm & { id?: string }) {
    const body = JSON.stringify({
      code: data.code, name: data.name, pricePerMonth: data.pricePerMonth,
      feeDiscountPercent: data.feeDiscountPercent, maxListings: data.maxListings,
      boostsPerMonth: data.boostsPerMonth, badge: data.badge || null, position: data.position, isActive: data.isActive,
    });
    if (data.id) {
      const upd = await apiFetch<ApiAdminPlan>(`/api/admin/plans/${data.id}`, { token, method: "PUT", body });
      setPlans(ps => ps.map(p => p.id === data.id ? upd : p));
    } else {
      const created = await apiFetch<ApiAdminPlan>("/api/admin/plans", { token, method: "POST", body });
      setPlans(ps => [...ps, created]);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Xóa gói "${name}"? Seller đang dùng sẽ về mặc định Free.`)) return;
    try {
      await apiFetch(`/api/admin/plans/${id}`, { token, method: "DELETE" });
      setPlans(ps => ps.filter(p => p.id !== id));
    } catch (e) { alert((e as Error).message); }
  }

  return (
    <DashboardLayout variant="admin" groups={adminNav} title="Gói thành viên Seller" subtitle="Quản lý phí, giảm phí, hạn mức tin & lượt boost theo gói">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-muted">Thay đổi áp dụng ngay cho seller (không cần deploy lại).</p>
        <button onClick={() => setModal("new")} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
          <Plus className="size-4" /> Thêm gói
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-8 animate-spin text-text-muted" /></div>
      ) : (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elev text-xs uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 text-left">Gói</th>
                  <th className="px-4 py-3 text-right">Giá/tháng</th>
                  <th className="px-4 py-3 text-center">Giảm phí</th>
                  <th className="px-4 py-3 text-center">Giới hạn tin</th>
                  <th className="px-4 py-3 text-center">Boost/tháng</th>
                  <th className="px-4 py-3 text-center">Badge</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map(p => (
                  <tr key={p.id} className="hover:bg-bg-elev/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-medium text-text"><Crown className="size-4 text-warning" /> {p.name}</div>
                      <div className="text-xs text-text-dim">#{p.position} · {p.code}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-text">{p.pricePerMonth === 0 ? "Miễn phí" : formatVND(p.pricePerMonth)}</td>
                    <td className="px-4 py-3 text-center text-success">{p.feeDiscountPercent}%</td>
                    <td className="px-4 py-3 text-center text-text-muted">{p.maxListings < 0 ? "∞" : p.maxListings}</td>
                    <td className="px-4 py-3 text-center text-text-muted">{p.boostsPerMonth}</td>
                    <td className="px-4 py-3 text-center">{p.badge ? <Badge tone={p.badge === "top" ? "warning" : "accent"}>{p.badge}</Badge> : <span className="text-text-dim">—</span>}</td>
                    <td className="px-4 py-3 text-center">
                      {p.isActive ? <Badge tone="success">Bật</Badge> : <Badge tone="muted">Tắt</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setModal({ id: p.id, code: p.code, name: p.name, pricePerMonth: p.pricePerMonth, feeDiscountPercent: p.feeDiscountPercent, maxListings: p.maxListings, boostsPerMonth: p.boostsPerMonth, badge: p.badge ?? "", position: p.position, isActive: p.isActive })}
                          className="rounded-lg bg-brand/10 px-2.5 py-1.5 text-xs text-brand hover:bg-brand/20"><Edit2 className="size-3.5" /></button>
                        {p.code !== "free" && (
                          <button onClick={() => remove(p.id, p.name)} className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs text-danger hover:bg-danger/20"><Trash2 className="size-3.5" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal !== null && (
        <PlanModal initial={modal === "new" ? null : modal} onClose={() => setModal(null)} onSave={save} />
      )}
    </DashboardLayout>
  );
}
