import Link from "next/link";
import { Star, ShieldCheck, Zap } from "lucide-react";
import type { Product } from "@/lib/types";
import { sellers } from "@/lib/data";
import { formatNumber, formatVND, pct } from "@/lib/format";
import { cn } from "@/lib/cn";
import { WishlistButton } from "./WishlistButton";

export function ProductCard({ product, compact }: { product: Product; compact?: boolean }) {
  const seller = product.seller || sellers.find((s) => s.id === product.sellerId);
  const discount =
    product.comparePrice && product.comparePrice > product.price
      ? 100 - Math.round((product.price / product.comparePrice) * 100)
      : 0;

  return (
    <Link
      href={`/p/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-card transition hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/10"
    >
      <div
        className={cn(
          "relative aspect-[5/4] overflow-hidden",
          compact && "aspect-[16/10]",
        )}
        style={{
          background: `linear-gradient(135deg, ${product.thumbnailColor}40, ${product.thumbnailColor}10)`,
        }}
      >
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <>
            <div
              aria-hidden
              className="absolute inset-0 bg-dots opacity-30"
            />
            <div className="absolute inset-0 grid place-items-center">
              <div
                className="grid size-20 place-items-center rounded-2xl text-3xl font-black shadow-xl"
                style={{
                  background: product.thumbnailColor,
                  color: "white",
                  boxShadow: `0 12px 40px -10px ${product.thumbnailColor}`,
                }}
              >
                {product.thumbnailIcon ?? product.title[0]}
              </div>
            </div>
          </>
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {discount > 0 && (
            <span className="rounded-md bg-danger/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
              -{discount}%
            </span>
          )}
          {product.badges?.includes("flash") && (
            <span className="flex items-center gap-0.5 rounded-md bg-warning/90 px-1.5 py-0.5 text-[10px] font-bold text-black">
              <Zap className="size-3" /> FLASH
            </span>
          )}
          {product.badges?.includes("top") && (
            <span className="rounded-md bg-brand/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
              TOP
            </span>
          )}
          {product.badges?.includes("new") && (
            <span className="rounded-md bg-accent/90 px-1.5 py-0.5 text-[10px] font-bold text-black">
              NEW
            </span>
          )}
        </div>

        {/* Wishlist button */}
        <WishlistButton
          productId={product.id}
          className="absolute right-2 bottom-2 size-7 backdrop-blur"
        />

        {/* Delivery badge */}
        <div className="absolute right-2 top-2">
          <span className="flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            {product.delivery === "auto" ? (
              <>⚡ Auto</>
            ) : product.delivery === "manual" ? (
              <>👤 Manual</>
            ) : (
              <>🔀 Hybrid</>
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-text group-hover:text-accent">
          {product.title}
        </h3>

        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <Star className="size-3.5 fill-warning text-warning" />
          <span className="font-medium text-text">{product.rating.toFixed(1)}</span>
          <span>({formatNumber(product.reviewCount)})</span>
          <span className="text-text-dim">•</span>
          <span>Đã bán {formatNumber(product.sold)}</span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <div className="num text-base font-extrabold text-accent">
              {formatVND(product.price)}
            </div>
            {product.comparePrice && (
              <div className="num text-xs text-text-dim line-through">
                {formatVND(product.comparePrice)}
              </div>
            )}
          </div>
          {product.warrantyDays > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-text-muted">
              <ShieldCheck className="size-3 text-success" />
              <span>BH {product.warrantyDays}d</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-2 text-xs text-text-muted">
          <span
            aria-hidden
            className="grid size-5 place-items-center rounded-full text-[10px] font-bold text-white"
            style={{ background: seller?.avatarColor ?? "#7c3aed" }}
          >
            {seller?.username[0].toUpperCase()}
          </span>
          <span className="truncate">{seller?.username}</span>
          {seller?.badge === "top" && (
            <span className="rounded bg-brand-soft px-1 text-[10px] text-brand">TOP</span>
          )}
          <span className="ml-auto text-text-dim">
            {pct(product.sold, product.sold + product.stock)}
          </span>
        </div>
      </div>
    </Link>
  );
}
