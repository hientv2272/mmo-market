import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Star,
  Zap,
  Clock,
  Package,
  TrendingUp,
  MessageCircle,
  Flag,
  Heart,
  Share2,
  Award,
} from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { SiteShell } from "@/components/SiteShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AddToCartButton } from "@/components/AddToCartButton";
import { Countdown } from "@/components/Countdown";
import { fetchActiveFlashSale, fetchCategories, fetchProductBySlug, fetchProducts } from "@/lib/serverData";
import { formatNumber, formatVND, formatRelativeTime } from "@/lib/format";

export const revalidate = 30;

export async function generateStaticParams() {
  const products = await fetchProducts({ pageSize: 60 });
  return products.map((p) => ({ slug: p.slug }));
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchProductBySlug(slug);
  if (!data) notFound();
  const { product, reviews: productReviews, seller } = data;

  const [categories, related, flashSale] = await Promise.all([
    fetchCategories(),
    fetchProducts({ category: product.category, pageSize: 6 }),
    fetchActiveFlashSale(),
  ]);
  const category = categories.find((c) => c.slug === product.category);
  const relatedFiltered = related.filter((p) => p.id !== product.id).slice(0, 5);
  const discount = product.comparePrice
    ? 100 - Math.round((product.price / product.comparePrice) * 100)
    : 0;

  // Phân bố sao tính từ đánh giá thật của sản phẩm
  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: productReviews.filter((r) => Math.round(r.rating) === stars).length,
  }));

  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-text-muted">
          <Link href="/" className="hover:text-text">Trang chủ</Link>
          <span>/</span>
          <Link href={`/c/${category?.slug}`} className="hover:text-text">
            {category?.name}
          </Link>
          <span>/</span>
          <span className="line-clamp-1 text-text">{product.title}</span>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* Gallery */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-3xl border border-border bg-bg-card">
              <div
                className="relative aspect-square w-full"
                style={{
                  background: `linear-gradient(135deg, ${product.thumbnailColor}50, ${product.thumbnailColor}10)`,
                }}
              >
                {product.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image}
                    alt={product.title}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-dots opacity-30" />
                    <div className="absolute inset-0 grid place-items-center">
                      <div
                        className="grid size-40 place-items-center rounded-3xl text-6xl font-black text-white shadow-2xl"
                        style={{
                          background: product.thumbnailColor,
                          boxShadow: `0 30px 80px -20px ${product.thumbnailColor}`,
                        }}
                      >
                        {product.thumbnailIcon ?? product.title[0]}
                      </div>
                    </div>
                  </>
                )}
                {discount > 0 && (
                  <span className="absolute left-4 top-4 rounded-md bg-danger px-2 py-1 text-xs font-bold text-white">
                    -{discount}%
                  </span>
                )}
              </div>
            </div>

            {/* Trust pillars */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-text-muted">
              <div className="rounded-xl border border-border bg-bg-card p-3">
                <ShieldCheck className="mx-auto size-5 text-success" />
                <div className="mt-1 font-medium text-text">Escrow</div>
                <div className="text-[11px]">3-7 ngày</div>
              </div>
              <div className="rounded-xl border border-border bg-bg-card p-3">
                <Zap className="mx-auto size-5 text-warning" />
                <div className="mt-1 font-medium text-text">
                  {product.delivery === "auto" ? "Auto-delivery" : "Giao tay"}
                </div>
                <div className="text-[11px]">
                  {product.delivery === "auto" ? "< 5 giây" : "< 24h"}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-bg-card p-3">
                <Award className="mx-auto size-5 text-accent" />
                <div className="mt-1 font-medium text-text">Bảo hành</div>
                <div className="text-[11px]">{product.warrantyDays} ngày</div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              {product.badges?.includes("flash") && (
                <Badge tone="warning" icon={<Zap className="size-3" />}>
                  FLASH SALE
                </Badge>
              )}
              {product.badges?.includes("top") && (
                <Badge tone="brand">TOP SẢN PHẨM</Badge>
              )}
              {product.badges?.includes("new") && (
                <Badge tone="accent">MỚI</Badge>
              )}
              <Badge tone="muted">
                {product.delivery === "auto"
                  ? "⚡ Giao tự động"
                  : product.delivery === "manual"
                    ? "👤 Giao thủ công"
                    : "🔀 Hybrid"}
              </Badge>
            </div>

            <h1 className="mt-3 text-2xl font-extrabold leading-tight text-text md:text-3xl">
              {product.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-muted">
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-warning text-warning" />
                <span className="font-semibold text-text">
                  {product.rating.toFixed(1)}
                </span>
                <span>({formatNumber(product.reviewCount)} đánh giá)</span>
              </span>
              <span className="text-text-dim">|</span>
              <span>
                Đã bán <span className="font-semibold text-text">{formatNumber(product.sold)}</span>
              </span>
              <span className="text-text-dim">|</span>
              <span>Còn <span className="font-semibold text-text">{formatNumber(product.stock)}</span> sản phẩm</span>
            </div>

            {/* Price */}
            <div className="mt-5 rounded-2xl border border-border bg-gradient-to-br from-brand/15 via-bg-card to-accent/10 p-5">
              <div className="flex flex-wrap items-end gap-3">
                <span className="num text-4xl font-extrabold text-accent">
                  {formatVND(product.price)}
                </span>
                {product.comparePrice && (
                  <>
                    <span className="num text-base text-text-dim line-through">
                      {formatVND(product.comparePrice)}
                    </span>
                    <span className="rounded-md bg-danger/20 px-2 py-1 text-xs font-bold text-danger">
                      Tiết kiệm{" "}
                      {formatVND(product.comparePrice - product.price)}
                    </span>
                  </>
                )}
              </div>
              {product.badges?.includes("flash") && flashSale && (
                <div className="mt-3 flex items-center gap-2 text-sm text-warning">
                  <Clock className="size-4" />
                  Flash sale kết thúc trong{" "}
                  <span className="num rounded-md bg-warning/15 px-2 py-0.5 font-bold">
                    <Countdown endsAt={flashSale.endsAt} />
                  </span>
                </div>
              )}
            </div>

            {/* Quantity & buy */}
            <div className="mt-5 grid gap-3 md:grid-cols-[140px_1fr_1fr]">
              <div className="flex h-12 items-center justify-between rounded-xl border border-border bg-bg-card px-2">
                <button className="grid size-8 place-items-center rounded-lg text-text-muted hover:bg-bg-elev">
                  −
                </button>
                <input
                  defaultValue={1}
                  className="w-10 bg-transparent text-center text-base font-semibold text-text outline-none"
                />
                <button className="grid size-8 place-items-center rounded-lg text-text-muted hover:bg-bg-elev">
                  +
                </button>
              </div>
              <AddToCartButton productId={product.id} variant="outline" size="lg" label="Thêm vào giỏ" />
              <AddToCartButton productId={product.id} size="lg" redirectTo="/cart" label="Mua ngay" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
              <button className="inline-flex items-center gap-1 hover:text-text">
                <Heart className="size-4" /> Yêu thích
              </button>
              <button className="inline-flex items-center gap-1 hover:text-text">
                <Share2 className="size-4" /> Chia sẻ
              </button>
              <button className="inline-flex items-center gap-1 hover:text-text">
                <Flag className="size-4" /> Báo cáo vi phạm
              </button>
            </div>

            {/* Seller card */}
            {seller && (
              <div className="mt-6 rounded-2xl border border-border bg-bg-card p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="grid size-12 place-items-center rounded-full text-lg font-bold text-white shadow"
                    style={{ background: seller.avatarColor }}
                  >
                    {seller.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/seller/${seller.username}`}
                        className="font-semibold text-text hover:text-accent"
                      >
                        @{seller.username}
                      </Link>
                      {seller.badge === "top" && (
                        <Badge tone="brand">TOP SELLER</Badge>
                      )}
                      {seller.badge === "verified" && (
                        <Badge tone="success">ĐÃ KYC</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Star className="size-3 fill-warning text-warning" />
                        {seller.rating.toFixed(2)} ({formatNumber(seller.reviewCount)})
                      </span>
                      <span>Đã bán {formatNumber(seller.totalSold)}</span>
                      <span>Phản hồi {seller.responseTime}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" leftIcon={<MessageCircle className="size-4" />}>
                      Chat
                    </Button>
                    <Link href={`/seller/${seller.username}`}>
                      <Button variant="soft" size="sm">Xem shop</Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Body sections */}
        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {/* Description */}
            <section className="rounded-2xl border border-border bg-bg-card p-6">
              <h2 className="text-lg font-bold text-text">Mô tả sản phẩm</h2>
              <p className="mt-3 text-sm leading-7 text-text-muted">
                {product.description}
              </p>

              <h3 className="mt-6 font-semibold text-text">Tính năng nổi bật</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-text-muted">
                {product.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                    {f}
                  </li>
                ))}
              </ul>

              <h3 className="mt-6 font-semibold text-text">Chính sách & lưu ý</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-text-muted">
                {product.policies.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-warning" />
                    {f}
                  </li>
                ))}
              </ul>
            </section>

            {/* FAQ */}
            <section className="rounded-2xl border border-border bg-bg-card p-6">
              <h2 className="text-lg font-bold text-text">Câu hỏi thường gặp</h2>
              <div className="mt-3 divide-y divide-border">
                {product.faq.map((f, i) => (
                  <details key={i} className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-text">
                      {f.q}
                      <span className="text-text-muted transition group-open:rotate-180">▾</span>
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>

            {/* Reviews */}
            <section className="rounded-2xl border border-border bg-bg-card p-6">
              <h2 className="text-lg font-bold text-text">
                Đánh giá ({formatNumber(product.reviewCount)})
              </h2>
              <div className="mt-4 grid gap-6 md:grid-cols-[200px_1fr]">
                <div className="text-center">
                  <div className="num text-5xl font-extrabold text-text">
                    {product.rating.toFixed(2)}
                  </div>
                  <div className="mt-1 text-warning">
                    {"★".repeat(Math.round(product.rating))}
                    <span className="text-text-dim">{"★".repeat(5 - Math.round(product.rating))}</span>
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    {formatNumber(product.reviewCount)} đánh giá
                  </div>
                </div>
                <div className="space-y-1.5">
                  {distribution.map((d) => {
                    const total = distribution.reduce((s, x) => s + x.count, 0) || 1;
                    const w = (d.count / total) * 100;
                    return (
                      <div key={d.stars} className="flex items-center gap-2 text-xs text-text-muted">
                        <span className="w-8">{d.stars}★</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elev">
                          <div
                            className="h-full bg-warning"
                            style={{ width: `${w}%` }}
                          />
                        </div>
                        <span className="num w-10 text-right">{formatNumber(d.count)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {productReviews.length === 0 ? (
                  <p className="text-sm text-text-muted">Chưa có đánh giá nào.</p>
                ) : (
                  productReviews.map((r) => (
                    <article
                      key={r.id}
                      className="rounded-xl border border-border bg-bg-elev/50 p-4"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-text">{r.buyerName}</span>
                        <span className="text-text-dim">•</span>
                        <span className="text-text-muted">
                          {formatRelativeTime(r.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1 text-warning text-xs">
                        {"★".repeat(r.rating)}
                        <span className="text-text-dim">{"★".repeat(5 - r.rating)}</span>
                      </div>
                      <p className="mt-2 text-sm text-text-muted">{r.comment}</p>
                      {r.reply && (
                        <div className="mt-3 rounded-lg border border-brand/30 bg-brand-soft p-3 text-sm text-text-muted">
                          <span className="font-semibold text-brand">Phản hồi từ shop:</span>{" "}
                          {r.reply}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right rail */}
          <aside className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl border border-border bg-bg-card p-5">
              <h3 className="text-sm font-semibold text-text">Quy trình giao dịch</h3>
              <ol className="mt-3 space-y-3 text-xs text-text-muted">
                {[
                  ["1", "Đặt hàng & thanh toán", "Tiền được giữ trong ví hệ thống (escrow)."],
                  ["2", "Giao hàng tự động/thủ công", "Auto < 5s, hoặc manual trong 24h."],
                  ["3", "Bạn nhận & kiểm tra", "Có 72h để kiểm tra hoặc khiếu nại."],
                  ["4", "Hoàn tất giao dịch", "Tiền giải phóng cho seller (trừ phí sàn)."],
                ].map(([n, t, d]) => (
                  <li key={n} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                      {n}
                    </span>
                    <div>
                      <div className="font-medium text-text">{t}</div>
                      <div>{d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-border bg-bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <TrendingUp className="size-4 text-success" />
                Thống kê sản phẩm
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-bg-elev p-3">
                  <dt className="text-xs text-text-muted">Lượt xem 7 ngày</dt>
                  <dd className="num mt-1 font-bold text-text">{formatNumber(product.sold * 8)}</dd>
                </div>
                <div className="rounded-lg bg-bg-elev p-3">
                  <dt className="text-xs text-text-muted">Tỷ lệ mua</dt>
                  <dd className="num mt-1 font-bold text-text">12.4%</dd>
                </div>
                <div className="rounded-lg bg-bg-elev p-3">
                  <dt className="text-xs text-text-muted">Tỷ lệ dispute</dt>
                  <dd className="num mt-1 font-bold text-success">0.4%</dd>
                </div>
                <div className="rounded-lg bg-bg-elev p-3">
                  <dt className="text-xs text-text-muted">SLA giao hàng</dt>
                  <dd className="num mt-1 font-bold text-text">99.8%</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-border bg-bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-text">
                <Package className="size-4 text-brand" />
                Sản phẩm khác từ shop
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {relatedFiltered.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/p/${p.slug}`}
                      className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-bg-elev"
                    >
                      <div
                        className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white"
                        style={{ background: p.thumbnailColor }}
                      >
                        {p.thumbnailIcon ?? p.title[0]}
                      </div>
                      <span className="line-clamp-2 text-xs text-text-muted">
                        {p.title}
                      </span>
                      <span className="num ml-auto shrink-0 text-xs font-semibold text-accent">
                        {formatVND(p.price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>

        {/* Related */}
        {relatedFiltered.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-xl font-bold text-text">Sản phẩm liên quan</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {relatedFiltered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </SiteShell>
  );
}
