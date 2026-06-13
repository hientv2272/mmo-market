"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle2, Loader2, ExternalLink, X, Clock, Smartphone } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ApiVNPayResult } from "@/lib/apiTypes";
import { formatVND } from "@/lib/format";
import { isPaymentDone } from "@/lib/paymentStatus";

const VNPAY_COLOR = "#003399";
const TIMEOUT_SECS = 15 * 60; // VNPay default expiry is 15 minutes

function qrSrc(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=200x200&margin=8`;
}

export function VNPayModal({
  orderId,
  orderCode,
  total,
  vnpayResult,
  token,
  onSuccess,
  onCancel,
  statusUrl,
  subjectLabel = "Đơn hàng",
  successText = "Đang chuyển đến đơn hàng…",
}: {
  orderId: string;
  orderCode: string;
  total: number;
  vnpayResult: ApiVNPayResult;
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
  statusUrl?: string;
  subjectLabel?: string;
  successText?: string;
}) {
  const [phase, setPhase] = useState<"waiting" | "success" | "failed">("waiting");
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECS);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { stopAll(); setPhase("failed"); return 0; }
        return t - 1;
      });
    }, 1000);

    const url = statusUrl ?? `/api/orders/${orderId}`;
    pollRef.current = setInterval(async () => {
      try {
        const { status } = await apiFetch<{ status: string }>(url, { token });
        const { done, failed } = isPaymentDone(status);
        if (done) {
          stopAll();
          setPhase(failed ? "failed" : "success");
        }
      } catch { /* ignore transient errors */ }
    }, 3000);

    return stopAll;
  }, [orderId, token, statusUrl, stopAll]);

  useEffect(() => {
    if (phase === "success") {
      const t = setTimeout(onSuccess, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, onSuccess]);

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-bg-card shadow-2xl">
        {/* VNPay header bar */}
        <div
          className="flex items-center justify-between px-5 py-4 text-white"
          style={{ background: VNPAY_COLOR }}
        >
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-full bg-white/20 text-xs font-black tracking-tight">VNP</div>
            <span className="font-bold tracking-wide">Thanh toán VNPay</span>
          </div>
          {phase === "waiting" && (
            <button onClick={onCancel} className="opacity-70 transition hover:opacity-100">
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-5 text-center">
          {phase === "waiting" && (
            <>
              <p className="text-xs text-text-muted">
                {subjectLabel} <span className="font-mono font-bold text-text">{orderCode}</span>
              </p>
              <p className="num mt-1 mb-5 text-2xl font-extrabold text-accent">{formatVND(total)}</p>

              {/* QR generated from payment URL */}
              <div className="mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc(vnpayResult.paymentUrl)}
                  alt="VNPay QR Code"
                  width={200}
                  height={200}
                  className="mx-auto rounded-xl border border-border"
                />
                <p className="mt-2 text-xs text-text-muted">
                  <Smartphone className="mr-1 inline size-3.5" />
                  Mở app ngân hàng / VNPay và quét mã QR
                </p>
              </div>

              <div className="mb-4 flex items-center justify-center gap-1.5 text-sm text-text-muted">
                <Clock className="size-4" />
                Hết hạn sau{" "}
                <span className="font-mono font-bold text-text">{mins}:{secs}</span>
              </div>

              <a
                href={vnpayResult.paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: VNPAY_COLOR }}
              >
                <ExternalLink className="size-4" />
                Mở trang VNPay
              </a>

              <p className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
                <Loader2 className="size-3 animate-spin" />
                Đang chờ xác nhận thanh toán...
              </p>
            </>
          )}

          {phase === "success" && (
            <div className="py-8">
              <CheckCircle2 className="mx-auto mb-3 size-16 text-success" />
              <p className="text-xl font-bold text-text">Thanh toán thành công!</p>
              <p className="mt-1 text-sm text-text-muted">{successText}</p>
            </div>
          )}

          {phase === "failed" && (
            <div className="py-8">
              <div className="mx-auto mb-3 grid size-16 place-items-center rounded-full bg-danger/10">
                <X className="size-8 text-danger" />
              </div>
              <p className="text-xl font-bold text-text">Thanh toán thất bại</p>
              <p className="mt-1 text-sm text-text-muted">
                Hết thời gian hoặc giao dịch bị từ chối
              </p>
              <button
                onClick={onCancel}
                className="mt-5 rounded-xl border border-border px-8 py-2.5 text-sm font-semibold text-text transition hover:bg-bg-elev"
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
