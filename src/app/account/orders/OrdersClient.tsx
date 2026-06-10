"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Star, Loader2, CheckCircle2, X } from "lucide-react";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiOrder, ApiOrderLine, ApiOwnReview } from "@/lib/apiTypes";
import type { OrderStatus } from "@/lib/types";
import { formatRelativeTime, formatVND } from "@/lib/format";

type ReviewTarget = { orderId: string; line: ApiOrderLine };
type DisputeTarget = { orderId: string; orderCode: string };

const tabs = [
  { v: "", label: "Tất cả" },
  { v: "PendingPayment", label: "Chờ thanh toán" },
  { v: "Delivering", label: "Đang bàn giao" },
  { v: "Checking", label: "Đang kiểm tra" },
  { v: "Completed", label: "Hoàn thành" },
  { v: "Disputed", label: "Tranh chấp" },
];

const apiToFrontStatus: Record<string, OrderStatus> = {
  PendingPayment: "PENDING_PAYMENT",
  EscrowLocked: "ESCROW_LOCKED",
  Delivering: "DELIVERING",
  Checking: "CHECKING",
  Completed: "COMPLETED",
  Disputed: "DISPUTED",
  Refunded: "REFUNDED",
  Cancelled: "CANCELLED",
};

export function OrdersClient() {
  const { user, token, loading: authLoading, refresh } = useAuth();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [tab, setTab] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<DisputeTarget | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [disputeForm, setDisputeForm] = useState({ title: "", body: "" });
  const [modalBusy, setModalBusy] = useState(false);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set()); // `${orderId}:${productId}`

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiFetch<ApiOrder[]>(`/api/orders${tab ? `?status=${tab}` : ""}`, { token });
      setOrders(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không tải được đơn hàng");
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => { if (!authLoading) reload(); }, [authLoading, reload]);

  useEffect(() => {
    if (!token) return;
    apiFetch<ApiOwnReview[]>("/api/reviews/mine", { token })
      .then((rs) => setReviewed(new Set(rs.filter((r) => r.orderId).map((r) => `${r.orderId}:${r.productId}`))))
      .catch(() => { /* không chặn trang nếu lỗi tải đánh giá */ });
  }, [token]);

  const confirm = async (id: string) => {
    if (!token) return;
    setBusy(id);
    try {
      await apiFetch(`/api/orders/${id}/confirm`, { method: "POST", token });
      await refresh();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(null);
    }
  };

  const pay = async (id: string) => {
    if (!token) return;
    setBusy(id);
    try {
      await apiFetch(`/api/orders/${id}/pay`, { method: "POST", token });
      await refresh();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(null);
    }
  };

  const submitReview = async () => {
    if (!token || !reviewTarget) return;
    setModalBusy(true);
    try {
      await apiFetch("/api/reviews", {
        method: "POST",
        token,
        body: JSON.stringify({
          orderId: reviewTarget.orderId,
          productId: reviewTarget.line.productId,
          rating: reviewForm.rating,
          comment: reviewForm.comment,
        }),
      });
      setReviewed((prev) => new Set(prev).add(`${reviewTarget.orderId}:${reviewTarget.line.productId}`));
      setReviewTarget(null);
      setReviewForm({ rating: 5, comment: "" });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setModalBusy(false);
    }
  };

  const submitDispute = async () => {
    if (!token || !disputeTarget) return;
    setModalBusy(true);
    try {
      await apiFetch("/api/disputes", {
        method: "POST",
        token,
        body: JSON.stringify({
          orderId: disputeTarget.orderId,
          title: disputeForm.title,
          body: disputeForm.body,
        }),
      });
      setDisputeTarget(null);
      setDisputeForm({ title: "", body: "" });
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setModalBusy(false);
    }
  };

  if (authLoading || loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-text-muted" /></div>;
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
        <p className="text-sm text-text-muted">Vui lòng <Link href="/login" className="text-accent hover:underline">đăng nhập</Link> để xem đơn hàng.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-bg-card">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-2 text-sm">
        {tabs.map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 ${tab === t.v ? "bg-brand text-white" : "text-text-muted hover:bg-bg-elev hover:text-text"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {err && <div className="m-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{err}</div>}

      {orders.length === 0 ? (
        <div className="p-12 text-center text-sm text-text-muted">
          Không có đơn nào. <Link href="/marketplace" className="text-accent hover:underline">Đi mua sắm</Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((o) => {
            const feStatus = apiToFrontStatus[o.status] || "PENDING_PAYMENT";
            return (
              <li key={o.id} className="p-5">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-mono font-semibold text-text">{o.code}</span>
                  <OrderStatusBadge status={feStatus} />
                  <span className="text-text-dim">|</span>
                  <span className="text-text-muted">Đặt {formatRelativeTime(o.createdAt)}</span>
                  {(o.status === "EscrowLocked" || o.status === "Checking") && o.escrowReleaseAt && (
                    <span className="rounded-md bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                      🔒 Escrow đến {new Date(o.escrowReleaseAt).toLocaleString("vi-VN")}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <ul className="space-y-2">
                    {o.lines.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-bg-elev/40 p-3">
                        <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-brand text-white text-base font-bold">{l.title[0]}</div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 text-sm font-medium text-text">{l.title}</div>
                          <div className="text-xs text-text-muted">SL {l.quantity} · {l.delivery === "Auto" ? "⚡ Auto" : "👤 Manual"}</div>
                          {l.deliveredItems && l.deliveredItems.length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {l.deliveredItems.map((it, i) => (
                                <div key={i} className="break-all font-mono text-[11px] text-success">✓ {it}</div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="num text-sm font-semibold text-text">{formatVND(l.unitPrice * l.quantity)}</div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col items-end justify-between gap-3">
                    <div className="text-right">
                      <div className="text-xs text-text-muted">Tổng</div>
                      <div className="num text-xl font-extrabold text-accent">{formatVND(o.total)}</div>
                      <div className="text-xs text-text-muted">{o.paymentMethod}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {o.status === "Checking" && (
                        <Button variant="success" size="sm" disabled={busy === o.id} onClick={() => confirm(o.id)} leftIcon={busy === o.id ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}>
                          Xác nhận đã nhận
                        </Button>
                      )}
                      {o.status === "PendingPayment" && (
                        <Button size="sm" disabled={busy === o.id} onClick={() => pay(o.id)}>
                          {busy === o.id ? "Đang xử lý..." : "Thanh toán ngay"}
                        </Button>
                      )}
                      {(o.status === "Completed" || o.status === "Checking") && o.lines[0] && (
                        reviewed.has(`${o.id}:${o.lines[0].productId}`) ? (
                          <Button variant="soft" size="sm" disabled leftIcon={<Star className="size-3.5" />}>Đã đánh giá</Button>
                        ) : (
                          <Button variant="soft" size="sm" leftIcon={<Star className="size-3.5" />} onClick={() => setReviewTarget({ orderId: o.id, line: o.lines[0] })}>Đánh giá</Button>
                        )
                      )}
                      {(o.status === "Checking" || o.status === "Completed") && (
                        <Button variant="outline" size="sm" leftIcon={<AlertTriangle className="size-3.5" />} onClick={() => setDisputeTarget({ orderId: o.id, orderCode: o.code })}>Mở khiếu nại</Button>
                      )}
                      {o.status === "Disputed" && (
                        <Link href="/account/disputes">
                          <Button variant="outline" size="sm" leftIcon={<AlertTriangle className="size-3.5" />}>Đang khiếu nại</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-text">Đánh giá sản phẩm</h3>
                <p className="text-xs text-text-muted line-clamp-1 max-w-md">{reviewTarget.line.title}</p>
              </div>
              <button onClick={() => setReviewTarget(null)} className="text-text-muted hover:text-text"><X className="size-4" /></button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setReviewForm({ ...reviewForm, rating: n })} className={`size-9 rounded-md ${reviewForm.rating >= n ? "bg-warning/20 text-warning" : "bg-bg-elev text-text-dim"}`}>
                  <Star className="mx-auto size-5" />
                </button>
              ))}
              <span className="ml-2 text-sm font-bold text-text">{reviewForm.rating}/5</span>
            </div>
            <textarea
              rows={4}
              placeholder="Chia sẻ trải nghiệm của bạn..."
              value={reviewForm.comment}
              onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              className="mt-3 w-full rounded-lg border border-border bg-bg-elev p-3 text-sm text-text outline-none focus:border-brand"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setReviewTarget(null)}>Huỷ</Button>
              <Button size="sm" disabled={modalBusy || !reviewForm.comment.trim()} onClick={submitReview}>{modalBusy ? "Đang gửi..." : "Gửi đánh giá"}</Button>
            </div>
          </div>
        </div>
      )}

      {disputeTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-text">Mở khiếu nại</h3>
                <p className="text-xs text-text-muted">Đơn {disputeTarget.orderCode}</p>
              </div>
              <button onClick={() => setDisputeTarget(null)} className="text-text-muted hover:text-text"><X className="size-4" /></button>
            </div>
            <input
              placeholder="Tiêu đề ngắn (vd: Tài khoản đã bị thay đổi)"
              value={disputeForm.title}
              onChange={(e) => setDisputeForm({ ...disputeForm, title: e.target.value })}
              className="mt-4 h-10 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
            />
            <textarea
              rows={5}
              placeholder="Mô tả chi tiết vấn đề..."
              value={disputeForm.body}
              onChange={(e) => setDisputeForm({ ...disputeForm, body: e.target.value })}
              className="mt-3 w-full rounded-lg border border-border bg-bg-elev p-3 text-sm text-text outline-none focus:border-brand"
            />
            <p className="mt-2 text-xs text-text-muted">Khiếu nại sẽ giữ tiền escrow đến khi admin giải quyết.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDisputeTarget(null)}>Huỷ</Button>
              <Button size="sm" variant="danger" disabled={modalBusy || !disputeForm.title.trim() || !disputeForm.body.trim()} onClick={submitDispute}>{modalBusy ? "Đang gửi..." : "Mở khiếu nại"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
