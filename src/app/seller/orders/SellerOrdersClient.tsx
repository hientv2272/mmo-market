"use client";
import { useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardList, Loader2, Package, Search, Send, Truck, X,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { sellerNav } from "@/lib/sellerNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiSellerOrderLine } from "@/lib/apiTypes";
import { formatVND } from "@/lib/format";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const STATUS_TABS = [
  { key: "",            label: "Tất cả" },
  { key: "EscrowLocked", label: "Chờ giao" },
  { key: "Delivering",  label: "Đang bàn giao" },
  { key: "Checking",    label: "Đã giao" },
  { key: "Completed",   label: "Hoàn thành" },
  { key: "Disputed",    label: "Tranh chấp" },
  { key: "Refunded",    label: "Hoàn tiền" },
  { key: "Cancelled",   label: "Đã hủy" },
] as const;

const DELIVERY_LABEL: Record<string, string> = {
  Auto: "Tự động", Manual: "Thủ công", Hybrid: "Hybrid",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PendingPayment: { label: "Chờ TT",     cls: "bg-warning/15 text-warning"  },
  EscrowLocked:   { label: "Đã vào escrow", cls: "bg-accent/15 text-accent" },
  Delivering:     { label: "Đang bàn giao", cls: "bg-brand/15 text-brand"   },
  Checking:       { label: "Đã giao",    cls: "bg-accent/15 text-accent"    },
  Completed:      { label: "Hoàn thành", cls: "bg-success/15 text-success"  },
  Disputed:       { label: "Tranh chấp", cls: "bg-danger/15 text-danger"    },
  Refunded:       { label: "Hoàn tiền",  cls: "bg-text-muted/15 text-text-muted" },
  Cancelled:      { label: "Đã hủy",     cls: "bg-text-muted/15 text-text-muted" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { label: status, cls: "bg-bg-elev text-text-muted" };
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cfg.cls}`}>{cfg.label}</span>;
}

// ── Deliver Modal ─────────────────────────────────────────────────────────────
function DeliverModal({
  line, remaining, onClose, onDelivered,
}: {
  line: ApiSellerOrderLine;
  remaining: number;
  onClose: () => void;
  onDelivered: (updated: ApiSellerOrderLine) => void;
}) {
  const { token } = useAuth();
  const [items, setItems] = useState<string[]>([""]); // each item = one account/key
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoDone = (line.deliveredItems?.length ?? 0);
  const isHybrid = line.delivery === "Hybrid";

  function addRow() { setItems(prev => [...prev, ""]); }
  function removeRow(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function setRow(i: number, v: string) { setItems(prev => prev.map((x, idx) => idx === i ? v : x)); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const filled = items.map(x => x.trim()).filter(Boolean);
    if (filled.length === 0) { setErr("Nhập ít nhất 1 item"); return; }
    setSaving(true); setErr(null);
    try {
      const updated = await apiFetch<ApiSellerOrderLine>(
        `/api/seller/orders/${line.orderLineId}/deliver`,
        { token, method: "POST", body: JSON.stringify({ items: filled }) }
      );
      onDelivered(updated);
      onClose();
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-text">Giao hàng thủ công</h3>
            <p className="text-xs text-text-muted mt-0.5">{line.productTitle} × {line.quantity}</p>
          </div>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            <X className="size-5" />
          </button>
        </div>

        {isHybrid && autoDone > 0 && (
          <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs text-accent">
            Đã tự động giao <strong>{autoDone}/{line.quantity}</strong> item từ kho. Chỉ cần giao tay <strong>{remaining} item</strong> còn thiếu.
          </div>
        )}
        <div className="rounded-xl border border-border bg-bg-elev p-3 text-xs text-text-muted">
          Nhập tài khoản / key / link — mỗi dòng 1 item (cần đủ <strong className="text-text">{remaining} item</strong>).
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {items.map((val, i) => (
            <div key={i} className="flex gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-bg-elev text-xs text-text-muted">{i + 1}</span>
              <input value={val} onChange={e => setRow(i, e.target.value)} placeholder="email:pass hoặc key..."
                className="flex-1 rounded-lg border border-border bg-bg-elev px-3 py-1.5 text-sm text-text outline-none focus:border-brand font-mono" />
              {items.length > 1 && (
                <button type="button" onClick={() => removeRow(i)} className="text-text-muted hover:text-danger">
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {items.length < Math.max(remaining, 1) * 3 && (
          <button type="button" onClick={addRow}
            className="text-xs text-brand hover:underline">+ Thêm dòng</button>
        )}

        {err && <p className="text-xs text-danger">{err}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-bg-elev">Hủy</button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 disabled:opacity-60">
            <Send className="size-4" /> {saving ? "Đang gửi..." : `Giao ${items.filter(x => x.trim()).length} item`}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Order Row ─────────────────────────────────────────────────────────────────
function OrderRow({ order, onDeliver }: { order: ApiSellerOrderLine; onDeliver: (o: ApiSellerOrderLine) => void }) {
  const [expanded, setExpanded] = useState(false);
  // Hybrid: phần đã tự động giao từ kho nằm trong deliveredItems → chỉ còn thiếu mới phải giao tay.
  const deliveredCount = order.deliveredItems?.length ?? 0;
  const remaining = order.delivery === "Hybrid" ? Math.max(0, order.quantity - deliveredCount) : order.quantity;
  const needsManual = order.delivery !== "Auto" && !(order.delivery === "Hybrid" && remaining === 0);
  const canDeliver = (order.status === "EscrowLocked" || order.status === "Delivering") && needsManual;

  return (
    <>
      <tr className="border-b border-border hover:bg-bg-elev/50 transition-colors">
        <td className="px-4 py-3">
          <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-1.5 text-text-muted hover:text-text">
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <p className="text-xs font-mono font-bold text-brand">{order.orderCode}</p>
          <p className="text-[11px] text-text-muted mt-0.5">{fmtDate(order.createdAt)}</p>
        </td>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-text">{order.productTitle}</p>
          <p className="text-xs text-text-muted">Qty: {order.quantity} × {formatVND(order.unitPrice)}</p>
        </td>
        <td className="px-4 py-3 text-sm font-bold text-text">{formatVND(order.lineTotal)}</td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${order.delivery === "Auto" ? "bg-accent/15 text-accent" : "bg-warning/15 text-warning"}`}>
            {DELIVERY_LABEL[order.delivery] ?? order.delivery}
          </span>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={order.status} />
        </td>
        <td className="px-4 py-3 text-xs text-text-muted">{order.buyerDisplayName}</td>
        <td className="px-4 py-3 text-right">
          {canDeliver && (
            <button onClick={() => onDeliver(order)}
              className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-success/90 ml-auto">
              <Truck className="size-3.5" /> Giao hàng
            </button>
          )}
          {order.status === "Completed" && (
            <span className="flex items-center gap-1 text-xs text-success justify-end">
              <CheckCircle2 className="size-3.5" /> Hoàn thành
            </span>
          )}
          {order.status === "Disputed" && (
            <span className="flex items-center gap-1 text-xs text-danger justify-end">
              <AlertTriangle className="size-3.5" /> Tranh chấp
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-bg-elev/30">
          <td colSpan={8} className="px-6 py-3">
            <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
              <div>
                <p className="text-text-muted">Thanh toán</p>
                <p className="font-medium text-text">{fmtDateTime(order.paidAt)}</p>
              </div>
              <div>
                <p className="text-text-muted">Giao hàng</p>
                <p className="font-medium text-text">{fmtDateTime(order.deliveredAt)}</p>
              </div>
              <div>
                <p className="text-text-muted">Hoàn thành</p>
                <p className="font-medium text-text">{fmtDateTime(order.completedAt)}</p>
              </div>
              <div>
                <p className="text-text-muted">Phương thức giao</p>
                <p className="font-medium text-text">{DELIVERY_LABEL[order.delivery] ?? order.delivery}</p>
              </div>
            </div>
            {order.deliveredItems && order.deliveredItems.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-text-muted mb-1.5">Items đã giao:</p>
                <div className="space-y-1">
                  {order.deliveredItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-bg-elev px-3 py-1.5">
                      <span className="text-[11px] text-text-muted w-5">#{i + 1}</span>
                      <span className="text-xs font-mono text-text">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function SellerOrdersClient() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<ApiSellerOrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [search, setSearch] = useState("");
  const [delivering, setDelivering] = useState<ApiSellerOrderLine | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch<ApiSellerOrderLine[]>(`/api/seller/orders${activeTab ? `?status=${activeTab}` : ""}`, { token })
      .then(setOrders)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [token, activeTab]);

  function handleDelivered(updated: ApiSellerOrderLine) {
    setOrders(os => os.map(o => o.orderLineId === updated.orderLineId ? updated : o));
  }

  const filtered = orders.filter(o => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.orderCode.toLowerCase().includes(q) || o.productTitle.toLowerCase().includes(q) || o.buyerDisplayName.toLowerCase().includes(q);
  });

  const awaiting = orders.filter(o => o.status === "EscrowLocked" || o.status === "Delivering").length;
  const completed = orders.filter(o => o.status === "Completed").length;
  const totalRevenue = orders.filter(o => o.status === "Completed").reduce((s, o) => s + o.lineTotal, 0);

  return (
    <DashboardLayout variant="seller" groups={sellerNav} title="Đơn hàng" subtitle="Theo dõi và xử lý đơn hàng của bạn">

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Tổng đơn", value: orders.length.toString(), color: "text-text" },
          { label: "Cần giao", value: awaiting.toString(), color: "text-warning" },
          { label: "Hoàn thành", value: completed.toString(), color: "text-success" },
          { label: "Doanh thu", value: formatVND(totalRevenue), color: "text-brand" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border bg-bg-card p-4">
            <p className="text-xs text-text-muted">{s.label}</p>
            <p className={`mt-1 text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-bg-elev p-1">
        {STATUS_TABS.map(tab => {
          const count = tab.key ? orders.filter(o => o.status === tab.key).length : orders.length;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === tab.key ? "bg-bg-card text-brand shadow" : "text-text-muted hover:text-text"}`}>
              {tab.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === tab.key ? "bg-brand/20 text-brand" : "bg-text-muted/20 text-text-muted"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm mã đơn, sản phẩm, người mua..."
          className="w-full rounded-xl border border-border bg-bg-card py-2.5 pl-10 pr-4 text-sm text-text outline-none focus:border-brand" />
      </div>

      {loading && (
        <div className="grid place-items-center py-20">
          <Loader2 className="size-8 animate-spin text-text-muted" />
        </div>
      )}

      {err && <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{err}</div>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-border py-16 text-center">
          <Package className="mx-auto mb-3 size-10 text-text-muted" />
          <p className="text-sm text-text-muted">
            {search ? "Không tìm thấy đơn hàng phù hợp" : "Chưa có đơn hàng nào"}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elev">
                  <th className="w-8 px-4 py-3"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Mã đơn</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Sản phẩm</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Tổng</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Giao hàng</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">Người mua</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <OrderRow key={order.orderLineId} order={order} onDeliver={setDelivering} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-2.5 text-right text-xs text-text-muted">
            {filtered.length} đơn{search && ` (lọc từ ${orders.length})`}
          </div>
        </div>
      )}

      {/* Awaiting delivery banner */}
      {awaiting > 0 && !loading && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-5 py-3">
          <ClipboardList className="size-5 shrink-0 text-warning" />
          <p className="text-sm text-warning">
            Bạn có <strong>{awaiting} đơn</strong> cần giao hàng thủ công. Hãy xử lý sớm để tránh tranh chấp.
          </p>
        </div>
      )}

      {delivering && (
        <DeliverModal
          line={delivering}
          remaining={delivering.delivery === "Hybrid"
            ? Math.max(0, delivering.quantity - (delivering.deliveredItems?.length ?? 0))
            : delivering.quantity}
          onClose={() => setDelivering(null)}
          onDelivered={handleDelivered}
        />
      )}
    </DashboardLayout>
  );
}
