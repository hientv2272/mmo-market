"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { CheckCircle2, Loader2, X, Clock, Copy, Check, AlertTriangle, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ApiUsdtPayResult, ApiUsdtCheckResult } from "@/lib/apiTypes";
import { formatVND } from "@/lib/format";
import { isPaymentDone } from "@/lib/paymentStatus";

const USDT_COLOR = "#26a17b";
const TIMEOUT_SECS = 60 * 60; // 60 minutes — blockchain confirmations take longer
const CHECK_INTERVAL_MS = 30_000; // scan blockchain every 30 s
const POLL_INTERVAL_MS  = 8_000;  // check order status every 8 s

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handle}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-text-muted transition hover:bg-bg-elev"
    >
      {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
      {copied ? "Đã copy" : "Copy"}
    </button>
  );
}

export function UsdtPayModal({
  orderId,
  orderCode,
  total,
  usdtResult,
  token,
  onSuccess,
  onCancel,
  statusUrl,
  checkUrl,
  subjectLabel = "Đơn hàng",
  successText = "Đang chuyển đến đơn hàng…",
}: {
  orderId: string;
  orderCode: string;
  total: number;
  usdtResult: ApiUsdtPayResult;
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
  statusUrl?: string;
  checkUrl?: string;
  subjectLabel?: string;
  successText?: string;
}) {
  const [phase, setPhase] = useState<"waiting" | "success" | "failed">("waiting");
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECS);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (checkRef.current) clearInterval(checkRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const triggerCheck = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    setCheckMsg(null);
    try {
      const res = await apiFetch<ApiUsdtCheckResult>(checkUrl ?? `/api/orders/${orderId}/usdt-check`, {
        method: "POST",
        token,
      });
      if (res.found)        setCheckMsg("Đã tìm thấy giao dịch! Đang xác nhận...");
      else if (res.alreadyPaid) setCheckMsg("Giao dịch đã được xác nhận.");
      else                  setCheckMsg("Chưa tìm thấy giao dịch phù hợp.");
    } catch {
      setCheckMsg("Không thể kết nối blockchain. Thử lại sau.");
    } finally {
      setChecking(false);
    }
  }, [orderId, token, checkUrl, checking]);

  useEffect(() => {
    // Countdown
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { stopAll(); setPhase("failed"); return 0; }
        return t - 1;
      });
    }, 1000);

    // Poll payment status
    const url = statusUrl ?? `/api/orders/${orderId}`;
    pollRef.current = setInterval(async () => {
      try {
        const { status } = await apiFetch<{ status: string }>(url, { token });
        const { done, failed } = isPaymentDone(status);
        if (done) {
          stopAll();
          setPhase(failed ? "failed" : "success");
        }
      } catch { /* ignore */ }
    }, POLL_INTERVAL_MS);

    // Periodically trigger blockchain scan
    checkRef.current = setInterval(() => { triggerCheck(); }, CHECK_INTERVAL_MS);

    return stopAll;
  }, [orderId, token, statusUrl, stopAll, triggerCheck]);

  useEffect(() => {
    if (phase === "success") {
      const t = setTimeout(onSuccess, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, onSuccess]);

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");
  const usdtDisplay = usdtResult.usdtAmount.toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-bg-card shadow-2xl">
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 text-white"
          style={{ background: USDT_COLOR }}
        >
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-full bg-white/20 text-xs font-black">₮</div>
            <span className="font-bold tracking-wide">Thanh toán USDT (TRC20)</span>
          </div>
          {phase === "waiting" && (
            <button onClick={onCancel} className="opacity-70 transition hover:opacity-100">
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="px-5 py-4 space-y-3">
          {phase === "waiting" && (
            <>
              {/* Order info */}
              <div className="text-center">
                <p className="text-xs text-text-muted">
                  {subjectLabel} <span className="font-mono font-bold text-text">{orderCode}</span>
                  <span className="ml-2 text-text-muted">({formatVND(total)})</span>
                </p>
                {/* Big USDT amount */}
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="num text-3xl font-extrabold text-accent">{usdtDisplay}</span>
                  <span className="text-lg font-bold text-text-muted">USDT</span>
                  <CopyButton text={usdtDisplay} />
                </div>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  1 USDT ≈ {formatVND(usdtResult.exchangeRate)} • Gửi đúng số tiền trên
                </p>
              </div>

              {/* QR of TRON address */}
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={usdtResult.qrImageUrl}
                  alt="TRON Wallet QR"
                  width={180}
                  height={180}
                  className="rounded-xl border border-border"
                />
              </div>

              {/* TRON address */}
              <div className="rounded-xl border border-border bg-bg-elev px-3 py-2.5">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Địa chỉ nhận (TRC20)</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate font-mono text-xs text-text">{usdtResult.address}</span>
                  <CopyButton text={usdtResult.address} />
                </div>
              </div>

              {/* Warnings */}
              <div className="space-y-1.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
                <div className="flex items-start gap-1.5 text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span><strong>Gửi đúng số USDT</strong> — sai số tiền sẽ không khớp đơn hàng</span>
                </div>
                <div className="flex items-start gap-1.5 text-danger">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span><strong>Chỉ sử dụng mạng TRC20 (TRON)!</strong> Không dùng ERC20, BEP20</span>
                </div>
              </div>

              {/* Countdown */}
              <div className="flex items-center justify-center gap-1.5 text-sm text-text-muted">
                <Clock className="size-4" />
                Hết hạn sau <span className="ml-1 font-mono font-bold text-text">{mins}:{secs}</span>
              </div>

              {/* Manual verify + status */}
              <div className="space-y-2">
                <button
                  onClick={triggerCheck}
                  disabled={checking}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-text transition hover:bg-bg-elev disabled:opacity-50"
                >
                  {checking
                    ? <><Loader2 className="size-4 animate-spin" />Đang kiểm tra...</>
                    : <><RefreshCw className="size-4" />Kiểm tra giao dịch</>}
                </button>

                {checkMsg && (
                  <p className="text-center text-xs text-text-muted">{checkMsg}</p>
                )}

                <p className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
                  <Loader2 className="size-3 animate-spin" />
                  Tự động kiểm tra mỗi 30 giây...
                </p>
              </div>
            </>
          )}

          {phase === "success" && (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-16 text-success" />
              <p className="text-xl font-bold text-text">Thanh toán thành công!</p>
              <p className="mt-1 text-sm text-text-muted">{successText}</p>
            </div>
          )}

          {phase === "failed" && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 grid size-16 place-items-center rounded-full bg-danger/10">
                <X className="size-8 text-danger" />
              </div>
              <p className="text-xl font-bold text-text">Hết thời gian chờ</p>
              <p className="mt-1 text-sm text-text-muted">
                Nếu đã gửi USDT, đơn sẽ được xác nhận tự động khi blockchain hoàn tất.
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
