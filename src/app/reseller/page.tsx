import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Headphones,
  Layers,
  Percent,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/Button";
import { formatVND } from "@/lib/format";

export const metadata = { title: "Reseller Program | MMO Market" };

const tiers = [
  {
    name: "Bronze",
    discount: "8%",
    color: "from-amber-700 to-amber-500",
    minVolume: formatVND(5_000_000),
    benefits: ["Chiết khấu sỉ mọi sản phẩm", "API lấy kho cơ bản", "Hỗ trợ trong giờ hành chính"],
  },
  {
    name: "Silver",
    discount: "15%",
    color: "from-slate-400 to-slate-200",
    minVolume: formatVND(30_000_000),
    benefits: ["Tất cả Bronze +", "Ưu tiên kho hàng số lượng lớn", "Hỗ trợ 1-1", "Công nợ ngắn hạn"],
  },
  {
    name: "Gold",
    discount: "25%",
    color: "from-yellow-500 to-yellow-300",
    minVolume: formatVND(100_000_000),
    benefits: [
      "Tất cả Silver +",
      "Giá riêng theo thỏa thuận",
      "Account Manager riêng",
      "Ưu tiên xử lý khiếu nại",
    ],
    highlight: true,
  },
];

const perks = [
  {
    icon: Percent,
    title: "Chiết khấu theo sỉ",
    body: "Mua số lượng lớn với giá ưu đãi đến 25%, tự đặt biên lợi nhuận khi bán lại cho khách của bạn.",
  },
  {
    icon: Boxes,
    title: "Kho hàng dồi dào",
    body: "Ưu tiên truy cập kho auto-delivery số lượng lớn, đảm bảo nguồn cung ổn định cho việc bán lại.",
  },
  {
    icon: Layers,
    title: "API & tích hợp",
    body: "Lấy kho và đồng bộ đơn hàng qua API để bán trên website hoặc kênh riêng của bạn một cách tự động.",
  },
  {
    icon: Zap,
    title: "Giao tự động 24/7",
    body: "Đơn hàng auto-delivery được giao trong 5 giây, hoạt động liên tục kể cả khi bạn offline.",
  },
  {
    icon: Headphones,
    title: "Hỗ trợ ưu tiên",
    body: "Reseller được xử lý nhanh hơn, có kênh hỗ trợ 1-1 và Account Manager riêng ở hạng Gold.",
  },
  {
    icon: TrendingUp,
    title: "Mở rộng linh hoạt",
    body: "Hạng được nâng tự động theo doanh số — càng bán nhiều, chiết khấu và ưu đãi càng lớn.",
  },
];

export default function ResellerPage() {
  return (
    <SiteShell>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand via-fuchsia-700 to-accent">
        <div className="absolute inset-0 bg-dots opacity-20 mix-blend-overlay" />
        <div className="absolute -right-20 top-1/4 size-96 rounded-full bg-white/15 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 text-white md:py-24">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Sparkles className="size-3.5" /> MMO Market | Reseller
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
                Trở thành đại lý.<br />
                Chiết khấu sỉ đến <span className="text-yellow-200">25%</span>.
              </h1>
              <p className="mt-4 max-w-lg text-white/85">
                Nhập hàng số lượng lớn với giá ưu đãi, bán lại theo biên lợi nhuận của riêng
                bạn. Kho dồi dào, giao tự động 24/7, tích hợp API — tất cả được bảo vệ bởi escrow.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/register">
                  <Button size="lg" variant="outline" className="bg-white text-brand-strong hover:bg-white/90">
                    Đăng ký Reseller
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href="/help/sell">
                  <Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                    Tìm hiểu thêm
                  </Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: <Boxes className="size-5" />, value: "640+", label: "Đại lý đang hoạt động" },
                { icon: <Percent className="size-5" />, value: "25%", label: "Chiết khấu tối đa" },
                { icon: <Zap className="size-5" />, value: "5 giây", label: "Giao hàng tự động" },
                { icon: <TrendingUp className="size-5" />, value: "3 hạng", label: "Nâng hạng theo doanh số" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl bg-white/15 p-4 text-white backdrop-blur"
                >
                  <div className="mb-1">{s.icon}</div>
                  <div className="num text-2xl font-extrabold">{s.value}</div>
                  <div className="text-xs opacity-80">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-text">Cách hoạt động</h2>
          <p className="mt-2 text-text-muted">Chỉ 4 bước để bắt đầu kinh doanh quy mô đại lý.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            ["1", "Đăng ký & KYC", "Tạo tài khoản, hoàn tất xác minh danh tính để mở khóa quyền đại lý."],
            ["2", "Đạt doanh số tối thiểu", "Nhập hàng đạt ngưỡng để được xếp hạng và hưởng chiết khấu sỉ."],
            ["3", "Nhập kho giá sỉ", "Mua số lượng lớn với giá ưu đãi, lấy kho qua dashboard hoặc API."],
            ["4", "Bán lại & thu lời", "Bán cho khách của bạn theo giá tự đặt — chênh lệch là lợi nhuận."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border border-border bg-bg-card p-5">
              <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-accent text-base font-extrabold text-white">
                {n}
              </div>
              <h3 className="mt-4 font-semibold text-text">{t}</h3>
              <p className="mt-1 text-sm text-text-muted">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Perks */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-text">Quyền lợi đại lý</h2>
          <p className="mt-2 text-text-muted">Mọi thứ bạn cần để kinh doanh sản phẩm số ở quy mô lớn.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {perks.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-2xl border border-border bg-bg-card p-5">
                <div className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-3 font-semibold text-text">{p.title}</h3>
                <p className="mt-1 text-sm leading-7 text-text-muted">{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tiers */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-text">3 hạng đại lý</h2>
          <p className="mt-2 text-text-muted">Tự động nâng hạng dựa trên doanh số nhập hàng mỗi tháng.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-3xl border p-6 ${
                t.highlight
                  ? "border-brand bg-gradient-to-br from-brand/30 via-bg-card to-accent/20 shadow-2xl shadow-brand/20"
                  : "border-border bg-bg-card"
              }`}
            >
              <div
                className={`mb-3 inline-flex rounded-full bg-gradient-to-r ${t.color} px-3 py-1 text-xs font-bold uppercase text-bg-card`}
              >
                {t.name}
              </div>
              <div className="num text-5xl font-extrabold text-text">{t.discount}</div>
              <div className="mt-1 text-sm text-text-muted">
                Doanh số tối thiểu {t.minVolume}/tháng
              </div>
              <ul className="mt-5 space-y-2 text-sm text-text-muted">
                {t.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-brand to-accent p-10 text-center text-white">
          <h2 className="text-3xl font-extrabold">Sẵn sàng làm đại lý?</h2>
          <p className="mx-auto mt-2 max-w-xl text-white/85">
            Nhập sỉ giá tốt, giao tự động, bảo vệ bởi escrow. Đăng ký Reseller Program ngay hôm nay.
          </p>
          <Link href="/register" className="mt-6 inline-block">
            <Button size="lg" variant="outline" className="bg-white text-brand-strong hover:bg-white/90">
              Đăng ký ngay
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
