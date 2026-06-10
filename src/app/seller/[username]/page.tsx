import { notFound } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Star, ShieldCheck, Award, Calendar, Users } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { SiteShell } from "@/components/SiteShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fetchSellers, fetchSellerByUsername } from "@/lib/serverData";
import { formatNumber, formatRelativeTime } from "@/lib/format";

export const revalidate = 30;

export async function generateStaticParams() {
  const sellers = await fetchSellers();
  return sellers.map((s) => ({ username: s.username }));
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const data = await fetchSellerByUsername(username);
  if (!data) notFound();
  const { seller, products: sellerProducts } = data;

  return (
    <SiteShell>
      <div
        className="relative h-48 w-full overflow-hidden md:h-56"
        style={{
          background: `linear-gradient(135deg, ${seller.avatarColor}, ${seller.avatarColor}80)`,
        }}
      >
        <div className="absolute inset-0 bg-dots opacity-30" />
      </div>

      <div className="mx-auto max-w-7xl px-4">
        <div className="-mt-16 flex flex-col items-start gap-4 md:flex-row md:items-end">
          <div
            className="grid size-28 shrink-0 place-items-center rounded-3xl border-4 border-bg text-3xl font-extrabold text-white shadow-2xl md:size-32"
            style={{ background: seller.avatarColor }}
          >
            {seller.username[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-text md:text-3xl">
                @{seller.username}
              </h1>
              {seller.badge === "top" && <Badge tone="brand">TOP SELLER</Badge>}
              {seller.kycStatus === "approved" && (
                <Badge tone="success" icon={<ShieldCheck className="size-3" />}>
                  ĐÃ KYC
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-text-muted">{seller.displayName}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-text-muted">
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-warning text-warning" />
                <span className="font-semibold text-text">{seller.rating.toFixed(2)}</span>
                ({formatNumber(seller.reviewCount)} đánh giá)
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="size-4" />
                Tham gia {formatRelativeTime(seller.joinedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-4" />
                {formatNumber(seller.totalSold)} đã bán
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/account/chat?seller=${seller.username}`}>
              <Button leftIcon={<MessageCircle className="size-4" />}>Nhắn tin</Button>
            </Link>
            <Button variant="outline">Theo dõi</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {[
            ["Sản phẩm", sellerProducts.length],
            ["Đã bán", formatNumber(seller.totalSold)],
            ["Đánh giá", `${seller.rating.toFixed(2)}★ (${formatNumber(seller.reviewCount)})`],
            ["Phản hồi", seller.responseTime ?? "—"],
          ].map(([k, v]) => (
            <div
              key={String(k)}
              className="rounded-2xl border border-border bg-bg-card p-4 text-center"
            >
              <div className="text-xs text-text-muted">{k}</div>
              <div className="num mt-1 text-xl font-extrabold text-text">{v}</div>
            </div>
          ))}
        </div>

        {/* Products */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-text">
            Sản phẩm ({sellerProducts.length})
          </h2>
          {sellerProducts.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {sellerProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-text-muted">
              Shop chưa có sản phẩm đang bán.
            </p>
          )}
        </section>

        {/* About */}
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-bg-card p-5 md:col-span-2">
            <h3 className="text-base font-bold text-text">Giới thiệu</h3>
            <p className="mt-2 text-sm leading-7 text-text-muted">
              {seller.bio ??
                "Shop chuyên cung cấp tài khoản số chất lượng cao, bảo hành dài hạn. Đã KYC đầy đủ và phục vụ hàng nghìn khách hàng. Cam kết hỗ trợ trong vòng 30 phút trong giờ hành chính."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Badge tone="brand" icon={<Award className="size-3" />}>Top 1% sàn</Badge>
              <Badge tone="success">100% đơn auto-deliv</Badge>
              <Badge tone="accent">Bảo hành lên 60 ngày</Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-bg-card p-5">
            <h3 className="text-base font-bold text-text">Cam kết</h3>
            <ul className="mt-3 space-y-2 text-xs text-text-muted">
              <li>✅ Tài khoản chính chủ, không chia sẻ</li>
              <li>✅ Hỗ trợ chat 24/7</li>
              <li>✅ Đổi mới nếu lỗi trong bảo hành</li>
              <li>✅ Hoàn 100% nếu không đúng mô tả</li>
            </ul>
          </div>
        </section>

        <div className="h-12" />
      </div>
    </SiteShell>
  );
}
