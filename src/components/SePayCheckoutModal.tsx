"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, ExternalLink, Loader2, ShieldCheck, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { ApiSePayCheckout } from "@/lib/apiTypes";
import { formatVND } from "@/lib/format";

const SEPAY_COLOR = "#1652f0";
const TIMEOUT_SECS = 15 * 60; // 15 phút
const POLL_INTERVAL_MS = 4000;
const WINDOW_NAME = "sepay_checkout";

type CheckResult = { done: boolean; status: string };

export function SePayCheckoutModal({
  code,
  total,
  checkout,
  checkUrl,
  token,
  subjectLabel = "Đơn hàng",
  successText = "Đang chuyển đến đơn hàng…",
  onSuccess,
  onCancel,
}: {
  code: string;
  total: number;
  checkout: ApiSePayCheckout;
  checkUrl: string;
  token: string;
  subjectLabel?: string;
  successText?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<"waiting" | "success" | "failed">("waiting");
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECS);
  const formRef = useRef<HTMLFormElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Mở trang thanh toán SePay ở cửa sổ riêng (form POST kèm chữ ký).
  const openSePay = useCallback(() => {
    window.open("", WINDOW_NAME);
    formRef.current?.submit();
  }, []);

  useEffect(() => {
    // Thử mở ngay; nếu trình duyệt chặn popup, người dùng bấm nút thủ công.
    openSePay();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { stopAll(); setPhase("failed"); return 0; }
        return t - 1;
      });
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const res = await apiFetch<CheckResult>(checkUrl, { method: "POST", token });
        const failed = res.status === "FAILED" || res.status === "VOIDED"
          || res.status === "Cancelled" || res.status === "AMOUNT_MISMATCH";
        if (res.done || failed) {
          stopAll();
          setPhase(failed ? "failed" : "success");
        }
      } catch { /* bỏ qua lỗi tạm thời */ }
    }, POLL_INTERVAL_MS);

    return stopAll;
    // openSePay/stopAll ổn định theo useCallback
  }, [checkUrl, token, openSePay, stopAll]);

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
      {/* Form ẩn submit sang SePay */}
      <form ref={formRef} action={checkout.actionUrl} method="POST" target={WINDOW_NAME} className="hidden">
        {Object.entries(checkout.fields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} readOnly />
        ))}
      </form>

      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 text-white" style={{ background: SEPAY_COLOR }}>
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-full bg-white/20 text-xs font-black">SP</div>
            <span className="font-bold tracking-wide">Thanh toán qua SePay</span>
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
                {subjectLabel} <span className="font-mono font-bold text-text">{code}</span>
              </p>
              <p className="num mt-1 mb-4 text-2xl font-extrabold text-accent">{formatVND(total)}</p>

              <p className="mb-4 text-sm text-text-muted">
                Cửa sổ thanh toán SePay đã mở. Hoàn tất chuyển khoản/thanh toán tại đó — số dư sẽ tự cập nhật khi SePay xác nhận.
              </p>

              <button
                onClick={openSePay}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: SEPAY_COLOR }}
              >
                <ExternalLink className="size-4" />
                Mở lại trang thanh toán SePay
              </button>

              <div className="mb-3 flex items-center justify-center gap-1.5 text-sm text-text-muted">
                <Clock className="size-4" />
                Hết hạn sau <span className="font-mono font-bold text-text">{mins}:{secs}</span>
              </div>

              <p className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
                <Loader2 className="size-3 animate-spin" />
                Đang chờ SePay xác nhận thanh toán...
              </p>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-text-dim">
                <ShieldCheck className="size-3.5 text-success" />
                Thanh toán an toàn trên cổng SePay
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
              <p className="text-xl font-bold text-text">Chưa nhận được thanh toán</p>
              <p className="mt-1 text-sm text-text-muted">
                Nếu bạn đã thanh toán, hệ thống sẽ xác nhận tự động trong giây lát.
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
