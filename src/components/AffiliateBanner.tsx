import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { formatNumber, formatVND } from "@/lib/format";
import type { StatsOverview } from "@/lib/serverData";

export function AffiliateBanner({ stats }: { stats?: StatsOverview | null }) {
  return (
    <section className="mx-auto mt-12 max-w-7xl px-4">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-r from-brand via-fuchsia-600 to-accent p-6 md:p-10">
        <div
          aria-hidden
          className="absolute inset-0 bg-dots opacity-30 mix-blend-overlay"
        />
        <div
          aria-hidden
          className="absolute -right-10 top-1/2 size-40 -translate-y-1/2 rounded-full bg-white/20 blur-3xl"
        />
        <div className="relative grid items-center gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              <Sparkles className="size-3.5" /> MMO Market | Affiliate
            </span>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight text-white md:text-3xl">
              10% Hoa Hồng. Thu Nhập Trọn Đời. Đăng Ký Miễn Phí.
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Tạo link affiliate cho từng sản phẩm, tracking realtime click /
              conversion / doanh thu. Hỗ trợ 24/7 — thanh toán hoa hồng theo tuần
              hoặc rút theo yêu cầu.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/affiliate"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand-strong shadow-lg"
              >
                Đăng ký miễn phí
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/help/affiliate"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                Tìm hiểu cơ chế
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 md:grid-cols-1">
            {[
              ["Tổng hoa hồng đã trả", stats ? formatVND(stats.affiliateTotalPaid) : "—"],
              ["CTV đang hoạt động", stats ? formatNumber(stats.activeAffiliates) : "—"],
              ["Thanh toán", "Theo tuần / rút bất kỳ"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl bg-white/15 p-3 text-center text-white backdrop-blur md:text-left"
              >
                <div className="num text-xl font-bold">{value}</div>
                <div className="text-[10px] uppercase tracking-wider opacity-80 md:text-xs">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
