"use client";
import { useEffect, useState } from "react";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    hh: Math.floor(total / 3600),
    mm: Math.floor((total % 3600) / 60),
    ss: total % 60,
  };
}
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Đồng hồ đếm ngược tới `endsAt` (ISO). Chạy client, cập nhật mỗi giây.
 * variant "text": "HH:MM:SS" · variant "boxes": 3 ô lớn (dùng trên banner flash sale).
 */
export function Countdown({ endsAt, variant = "text" }: { endsAt: string; variant?: "text" | "boxes" }) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    // Lấy thời gian thật + bật render sau khi mount để tránh lệch hydration giữa server/client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const end = new Date(endsAt).getTime();
  const { hh, mm, ss } = parts(end - now);

  if (variant === "boxes") {
    const cells = mounted ? [pad(hh), pad(mm), pad(ss)] : ["--", "--", "--"];
    return (
      <div className="flex items-center gap-2">
        {cells.map((n, i) => (
          <span
            key={i}
            className="num grid h-12 min-w-12 place-items-center rounded-xl bg-white/20 px-3 text-2xl font-extrabold backdrop-blur"
          >
            {n}
          </span>
        ))}
      </div>
    );
  }

  return <span className="num">{mounted ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : "--:--:--"}</span>;
}
