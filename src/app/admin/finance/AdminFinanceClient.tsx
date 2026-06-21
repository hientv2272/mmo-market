"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { adminNav } from "@/lib/adminNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiAdminMetrics, ApiAdminWithdraw, ApiFinanceReconciliation } from "@/lib/apiTypes";
import { formatRelativeTime, formatVND } from "@/lib/format";

const TABS = [
  { key: "all", label: "Tất cả" },
  { key: "Pending", label: "Chờ duyệt" },
  { key: "Paid", label: "Đã thanh toán" },
  { key: "Rejected", label: "Bị từ chối" },
];

const tone: Record<string, "success" | "warning" | "danger" | "muted"> = {
  Paid: "success",
  Approved: "success",
  Pending: "warning",
  Rejected: "danger",
};

export function AdminFinanceClient() {
  const { token, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("Pending");
  const [items, setItems] = useState<ApiAdminWithdraw[]>([]);
  const [metrics, setMetrics] = useState<ApiAdminMetrics | null>(null);
  const [recon, setRecon] = useState<ApiFinanceReconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async (tk?: string | null, t?: string) => {
    if (!tk) return;
    try {
      const filter = (t ?? tab) === "all" ? "" : `?status=${t ?? tab}`;
      const [list, m, rc] = await Promise.all([
        apiFetch<ApiAdminWithdraw[]>(`/api/admin/withdrawals${filter}`, { token: tk }),
        apiFetch<ApiAdminMetrics>("/api/admin/metrics", { token: tk }),
        apiFetch<ApiFinanceReconciliation>("/api/admin/finance/reconciliation", { token: tk }),
      ]);
      setItems(list);
      setMetrics(m);
      setRecon(rc);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    void reload(token, tab).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab]);

  const onProcess = async (id: string, approve: boolean) => {
    if (!token) return;
    const note = approve ? prompt("Ghi chú (tuỳ chọn):", "Đã chuyển khoản") : prompt("Lý do từ chối?");
    if (approve === false && !note) return;
    let payoutReference: string | null = null;
    if (approve) {
      payoutReference = prompt("Mã giao dịch / tham chiếu khi chuyển tiền (tuỳ chọn):", "") || null;
    }
    try {
      await apiFetch(`/api/admin/withdrawals/${id}/process`, {
        method: "POST",
        token,
        body: JSON.stringify({ approve, adminNote: note ?? "", payoutReference }),
      });
      await reload(token, tab);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout variant="admin" groups={adminNav} title="Tài chính" subtitle="Đang tải...">
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-text-muted" /></div>
      </DashboardLayout>
    );
  }

  if (!token) {
    return (
      <DashboardLayout variant="admin" groups={adminNav} title="Tài chính" subtitle="">
        <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
          <p className="text-sm text-text-muted">Vui lòng <Link href="/login" className="text-accent hover:underline">đăng nhập</Link>.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout variant="admin" groups={adminNav} title="Tài chính" subtitle="Yêu cầu rút tiền & doanh thu sàn">
      {error && <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="GMV 30 ngày" value={formatVND(metrics?.gmv ?? 0)} tone="brand" />
        <Stat label="Doanh thu sàn (phí)" value={formatVND(metrics?.revenue ?? 0)} tone="success" />
        <Stat label="Yêu cầu rút chờ duyệt" value={String(metrics?.pendingWithdrawals ?? 0)} tone="warning" />
      </div>

      {recon && (
        <div className="mt-6 rounded-2xl border border-border bg-bg-card p-5">
          <h3 className="text-sm font-bold text-text">Đối soát dòng tiền (tài khoản logic)</h3>
          <p className="mt-0.5 text-xs text-text-muted">Tổng hợp từ ledger nội bộ. Ví Platform/Reserve/Escrow là tài khoản logic, chưa tách vật lý.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Ví Platform (phí thực thu)", value: recon.platformRevenue, tone: "text-success" },
              { label: "Escrow đang giữ", value: recon.escrowHeld, tone: "text-brand" },
              { label: "Reserve đã hoàn (tranh chấp/hủy)", value: recon.totalRefunded, tone: "text-warning" },
              { label: "Cọc đăng tin đang khóa", value: recon.depositsHeld, tone: "text-accent" },
              { label: "Cọc đã tịch thu", value: recon.depositsForfeited, tone: "text-success" },
              { label: "Tổng nạp ví", value: recon.totalTopup, tone: "text-text" },
              { label: "Tổng đã rút", value: recon.totalWithdrawn, tone: "text-text" },
              { label: "Tổng số dư ví user", value: recon.userWalletTotal, tone: "text-text" },
            ].map((r) => (
              <div key={r.label} className="rounded-xl border border-border bg-bg-elev p-3">
                <p className="text-xs text-text-muted">{r.label}</p>
                <p className={`mt-1 text-lg font-bold ${r.tone}`}>{formatVND(r.value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-bg-card">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-2 text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 ${tab === t.key ? "bg-brand text-white" : "text-text-muted hover:bg-bg-elev hover:text-text"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {items.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-text-muted">Không có yêu cầu.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
                <th className="px-4 py-3">Phương thức</th>
                <th className="px-4 py-3">Tài khoản</th>
                <th className="px-4 py-3">Ghi chú</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thời gian</th>
                <th className="px-4 py-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((w) => (
                <tr key={w.id} className="hover:bg-bg-elev/30">
                  <td className="px-4 py-3 font-medium text-text">@{w.sellerUsername}</td>
                  <td className="num px-4 py-3 text-right font-semibold text-text">{formatVND(w.amount)}</td>
                  <td className="px-4 py-3 text-text-muted">{w.method}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-text">{w.account}</div>
                    {w.cryptoNetwork && <div className="text-[10px] text-text-muted">Mạng: {w.cryptoNetwork}</div>}
                    {(w.method === "Bank" || w.method === "Momo") && w.holderMatchesKyc != null && (
                      w.holderMatchesKyc
                        ? <div className="text-[10px] text-success">✓ tên khớp KYC</div>
                        : <div className="text-[10px] text-warning">⚠ tên lệch KYC</div>
                    )}
                    {w.payoutReference && <div className="text-[10px] text-text-muted">ref: {w.payoutReference}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{w.note ?? "—"}</td>
                  <td className="px-4 py-3 text-center"><Badge tone={tone[w.status] ?? "muted"}>{w.status}</Badge></td>
                  <td className="px-4 py-3 text-right text-xs text-text-muted">{formatRelativeTime(w.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {w.status === "Pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="success" className="!h-8 !w-8 !px-0" onClick={() => onProcess(w.id, true)} title="Duyệt"><Check className="size-3.5" /></Button>
                        <Button size="sm" variant="danger" className="!h-8 !w-8 !px-0" onClick={() => onProcess(w.id, false)} title="Từ chối"><X className="size-3.5" /></Button>
                      </div>
                    ) : <span className="text-xs text-text-muted">{w.adminNote ?? "—"}</span>}
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
