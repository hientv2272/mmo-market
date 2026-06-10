"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Loader2, Share2, TrendingUp, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Stat";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import { formatVND, formatRelativeTime } from "@/lib/format";

type ReferredUser = { displayName: string; username: string; joinedAt: string; orders: number; commission: number };
type ReferralStats = {
  referralCode: string;
  totalReferred: number;
  newReferred7d: number;
  totalCommission: number;
  ordersFromReferred: number;
  referred: ReferredUser[];
};

const TIERS = [
  { tier: "Bronze", min: 0, rate: "5%", color: "from-amber-700 to-amber-500" },
  { tier: "Silver", min: 10, rate: "7%", color: "from-slate-400 to-slate-200" },
  { tier: "Gold", min: 30, rate: "10%", color: "from-yellow-500 to-yellow-300" },
];

export function ReferralClient() {
  const { token, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    apiFetch<ReferralStats>("/api/referral/stats", { token })
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (authLoading || loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-text-muted" /></div>;
  }

  if (!token || !stats) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
        <p className="text-sm text-text-muted">Vui lòng <Link href="/login" className="text-accent hover:underline">đăng nhập</Link> để xem thống kê giới thiệu.</p>
      </div>
    );
  }

  const refLink = stats.referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${stats.referralCode}`
    : "";

  const copy = () => {
    if (!refLink) return;
    navigator.clipboard?.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          label="Tổng người đã giới thiệu"
          value={String(stats.totalReferred)}
          delta={stats.newReferred7d > 0 ? `+${stats.newReferred7d} trong 7 ngày` : "Chưa có người mới"}
          icon={<Users className="size-4" />}
          tone="brand"
        />
        <Stat
          label="Hoa hồng tích luỹ"
          value={formatVND(stats.totalCommission)}
          delta="Cộng vào ví khi đơn hoàn tất"
          icon={<Wallet className="size-4" />}
          tone="success"
        />
        <Stat
          label="Đơn từ người được ref"
          value={String(stats.ordersFromReferred)}
          delta="Đơn đã hoàn tất"
          icon={<TrendingUp className="size-4" />}
          tone="accent"
        />
      </div>

      <div className="mt-6 rounded-3xl border border-brand/30 bg-gradient-to-br from-brand/30 via-bg-card to-accent/20 p-6">
        <h3 className="text-base font-semibold text-text">Link giới thiệu của bạn</h3>
        <p className="mt-1 text-xs text-text-muted">
          Chia sẻ link để bạn bè đăng ký. Hoa hồng cộng vào ví ngay khi họ hoàn tất đơn đầu tiên.
        </p>
        {refLink ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="flex-1 rounded-xl border border-border bg-bg-card px-4 py-3 font-mono text-sm text-accent break-all">
              {refLink}
            </code>
            <Button leftIcon={<Copy className="size-4" />} onClick={copy}>{copied ? "Đã copy" : "Copy"}</Button>
            <Button variant="outline" leftIcon={<Share2 className="size-4" />} onClick={copy}>Share</Button>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-border bg-bg-card px-4 py-3 text-sm text-text-muted">
            Tài khoản của bạn chưa có mã giới thiệu.
          </p>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.tier} className={`rounded-2xl bg-gradient-to-br ${t.color} p-4 text-bg-card`}>
              <div className="text-xs font-bold uppercase opacity-80">{t.tier}</div>
              <div className="num mt-1 text-2xl font-extrabold">{t.rate}</div>
              <div className="text-xs opacity-80">Cần ≥ {t.min} ref active / tháng</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-bold text-text">Người được giới thiệu · {stats.totalReferred}</h2>
        </div>
        {stats.referred.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-text-muted">Chưa có ai đăng ký qua link của bạn.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-5 py-3">Người dùng</th>
                <th className="px-5 py-3">Đã tham gia</th>
                <th className="px-5 py-3">Số đơn</th>
                <th className="px-5 py-3 text-right">Hoa hồng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.referred.map((r) => (
                <tr key={r.username} className="hover:bg-bg-elev/30">
                  <td className="px-5 py-3">
                    <span className="font-medium text-text">{r.displayName}</span>
                    <span className="ml-1 text-xs text-text-muted">@{r.username}</span>
                  </td>
                  <td className="px-5 py-3 text-text-muted">{formatRelativeTime(r.joinedAt)}</td>
                  <td className="px-5 py-3 num text-text">{r.orders}</td>
                  <td className="px-5 py-3 num text-right font-semibold text-success">
                    {r.commission > 0 ? `+${formatVND(r.commission)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
