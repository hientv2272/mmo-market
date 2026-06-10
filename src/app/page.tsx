import { AffiliateBanner } from "@/components/AffiliateBanner";
import { BannerGrid } from "@/components/BannerGrid";
import { CategoryTile } from "@/components/CategoryTile";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { PromoStrip } from "@/components/PromoStrip";
import { SectionHeader } from "@/components/SectionHeader";
import { SellerStrip } from "@/components/SellerStrip";
import { SiteShell } from "@/components/SiteShell";
import { fetchActiveFlashSale, fetchCategories, fetchProducts, fetchStatsOverview } from "@/lib/serverData";
import { formatNumber, formatVND } from "@/lib/format";
import Link from "next/link";

export const revalidate = 30;

export default async function Home() {
  const [categories, allProducts, top, fresh, ai, tools, courses, flashSale, stats] = await Promise.all([
    fetchCategories(),
    fetchProducts({ pageSize: 60 }),
    fetchProducts({ sort: "bestseller", pageSize: 10 }),
    fetchProducts({ sort: "newest", pageSize: 8 }),
    fetchProducts({ category: "ai", pageSize: 5 }),
    fetchProducts({ category: "tool", pageSize: 5 }),
    fetchProducts({ category: "course", pageSize: 5 }),
    fetchActiveFlashSale(),
    fetchStatsOverview(),
  ]);
  const flash = allProducts.filter((p) => p.comparePrice && p.comparePrice > p.price).slice(0, 5);

  return (
    <SiteShell>
      <PromoStrip />
      <Hero stats={stats} />
      <BannerGrid />

      {/* Categories */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <SectionHeader
          title="Chọn danh mục"
          subtitle="8 nhóm sản phẩm số chuyên biệt cho cộng đồng MMO"
          accent="🗂"
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          {categories.map((c) => (
            <CategoryTile key={c.slug} category={c} />
          ))}
        </div>
      </section>

      {/* Flash sale */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <SectionHeader
          title="Flash Sale"
          subtitle={flashSale ? `Giảm đến ${flashSale.discountPercent}% — số lượng có hạn` : "Giảm sốc, số lượng có hạn — nhanh tay kẻo lỡ"}
          href="/flash-sale"
          accent="⚡"
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {flash.slice(0, 5).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Bestsellers */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <SectionHeader
          title="Phần mềm, tài khoản bán chạy"
          subtitle="Top sản phẩm có lượt mua cao nhất 30 ngày"
          href="/marketplace?sort=top"
          accent="🔥"
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {top.slice(0, 10).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* AI showcase */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="card-glow flex h-full flex-col justify-between rounded-3xl bg-gradient-to-br from-violet-700/30 via-fuchsia-700/20 to-bg-card p-6">
              <div>
                <span className="rounded-full bg-brand/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
                  AI Hub
                </span>
                <h2 className="mt-4 text-2xl font-extrabold text-text">
                  Toàn bộ AI hot — giá tốt nhất Việt Nam
                </h2>
                <p className="mt-2 text-sm text-text-muted">
                  ChatGPT Plus, Claude Pro, Gemini Advanced + Veo 3, Cursor Max
                  Mode, Midjourney v7, Notion AI Plus...
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {["ChatGPT", "Claude", "Gemini", "Cursor", "Midjourney"].map(
                    (t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border bg-bg-card px-3 py-1 text-text-muted"
                      >
                        {t}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <Link
                href="/c/ai"
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-brand to-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/30"
              >
                Khám phá AI →
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
            {ai.slice(0, 5).map((p, i) => (
              <div key={p.id} className={i === 0 ? "sm:col-span-2 lg:col-span-2" : ""}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <SectionHeader
          title="Tool & phần mềm bản quyền"
          href="/c/tool"
          accent="🛠"
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {tools.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Courses */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <SectionHeader
          title="Khoá học MMO chất lượng"
          href="/c/course"
          accent="🎓"
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {courses.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Newest */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <SectionHeader title="Mới nhất trên sàn" href="/marketplace?sort=new" accent="🆕" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {fresh.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <AffiliateBanner stats={stats} />
      <SellerStrip />

      {/* Trust strip */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            {
              t: "🛡 Escrow giữ tiền",
              d: "Tiền của bạn được giữ trong hệ thống cho đến khi bạn xác nhận hoặc hết 72h auto-complete.",
            },
            {
              t: "🔍 Kiểm tra trùng",
              d: "Mọi tài khoản số được hash kiểm trùng trước khi giao — không có chuyện 'bán đi bán lại'.",
            },
            {
              t: "🔁 Bảo hành 1 đổi 1",
              d: "Tài khoản die trong thời hạn được hoàn tiền 100% hoặc đổi mới.",
            },
            {
              t: "👨‍⚖️ Trọng tài minh bạch",
              d: "Admin giải quyết tranh chấp trong 48-72h, có ghi log và bằng chứng đầy đủ.",
            },
          ].map((b) => (
            <div
              key={b.t}
              className="rounded-2xl border border-border bg-bg-card p-5 text-sm"
            >
              <div className="font-semibold text-text">{b.t}</div>
              <p className="mt-1 text-text-muted">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="mx-auto mt-12 max-w-7xl px-4">
        <div className="rounded-3xl border border-border bg-bg-card p-8 md:p-10">
          <h2 className="text-center text-2xl font-extrabold text-text md:text-3xl">
            MMO Market — Sàn TMĐT sản phẩm số
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-sm leading-7 text-text-muted">
            MMO Market được xây dựng nhằm mang đến nền tảng giao dịch sản phẩm
            số an toàn, minh bạch cho cộng đồng MMO Việt Nam. Chúng tôi giải
            quyết bài toán lừa đảo trên các kênh giao dịch tự phát bằng mô hình
            <span className="px-1 text-brand">trung gian giữ tiền</span>—
            <span className="px-1 text-accent">kiểm tra sản phẩm</span>—
            <span className="px-1 text-success">bảo vệ người mua</span>, cùng
            hệ thống Affiliate / Reseller chuyên nghiệp.
          </p>
          <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-4 text-center md:grid-cols-4">
            <div>
              <div className="num text-2xl font-extrabold text-text">{stats ? formatNumber(stats.totalCompletedOrders) : "—"}</div>
              <div className="text-xs text-text-muted">Đơn hàng hoàn tất</div>
            </div>
            <div>
              <div className="num text-2xl font-extrabold text-text">{stats ? formatNumber(stats.totalSellers) : "—"}</div>
              <div className="text-xs text-text-muted">Người bán</div>
            </div>
            <div>
              <div className="num text-2xl font-extrabold text-text">{stats ? formatVND(stats.gmv30d) : "—"}</div>
              <div className="text-xs text-text-muted">GMV 30 ngày</div>
            </div>
            <div>
              <div className="num text-2xl font-extrabold text-text">{stats ? formatNumber(stats.totalProducts) : "—"}</div>
              <div className="text-xs text-text-muted">Sản phẩm đang bán</div>
            </div>
          </div>
        </div>
      </section>

      <div className="h-8" />
    </SiteShell>
  );
}
