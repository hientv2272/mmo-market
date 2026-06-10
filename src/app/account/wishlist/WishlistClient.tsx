"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Loader2, ShieldCheck, Star, Zap, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useWishlist } from "@/lib/WishlistContext";
import { apiFetch } from "@/lib/api";
import type { ApiWishlistItem } from "@/lib/apiTypes";
import { formatNumber, formatVND } from "@/lib/format";

const DELIVERY_LABEL: Record<string, string> = {
  Auto: "⚡ Auto",
  Manual: "👤 Manual",
  Hybrid: "🔀 Hybrid",
};

export function WishlistClient() {
  const { user, token, loading: authLoading } = useAuth();
  const { toggle } = useWishlist();
  const [items, setItems] = useState<ApiWishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiFetch<ApiWishlistItem[]>("/api/wishlist", { token });
      setItems(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi tải danh sách");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const handleRemove = async (productId: string) => {
    await toggle(productId);
    setItems((prev) => prev.filter((i) => i.id !== productId));
  };

  if (authLoading || loading) {
    return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-text-muted" /></div>;
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
        <p className="text-sm text-text-muted">
          Vui lòng{" "}
          <Link href="/login" className="text-accent hover:underline">đăng nhập</Link>{" "}
          để xem danh sách yêu thích.
        </p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
        <p className="text-sm text-danger">{err}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-16 text-center">
        <Heart className="mx-auto size-12 text-border" />
        <p className="mt-4 text-base font-semibold text-text">Chưa có sản phẩm yêu thích</p>
        <p className="mt-1 text-sm text-text-muted">Nhấn vào icon trái tim trên sản phẩm để lưu vào đây.</p>
        <Link
          href="/marketplace"
          className="mt-6 inline-block rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          Khám phá sản phẩm
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-text-muted">{items.length} sản phẩm đã lưu</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const discount =
            item.comparePrice && item.comparePrice > item.price
              ? 100 - Math.round((item.price / item.comparePrice) * 100)
              : 0;

          return (
            <div
              key={item.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-card transition hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/10"
            >
              {/* Remove button */}
              <button
                onClick={() => handleRemove(item.id)}
                className="absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-full bg-black/40 text-white/70 backdrop-blur transition hover:bg-danger/80 hover:text-white"
                aria-label="Bỏ yêu thích"
              >
                <Trash2 className="size-3.5" />
              </button>

              <Link href={`/p/${item.slug}`} className="flex flex-1 flex-col">
                {/* Thumbnail */}
                <div
                  className="relative aspect-[5/4] overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${item.thumbnailColor}40, ${item.thumbnailColor}10)` }}
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.title} loading="lazy" className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <>
                      <div aria-hidden className="absolute inset-0 bg-dots opacity-30" />
                      <div className="absolute inset-0 grid place-items-center">
                        <div
                          className="grid size-20 place-items-center rounded-2xl text-3xl font-black shadow-xl"
                          style={{ background: item.thumbnailColor, color: "white", boxShadow: `0 12px 40px -10px ${item.thumbnailColor}` }}
                        >
                          {item.thumbnailIcon ?? item.title[0]}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Badges */}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    {discount > 0 && (
                      <span className="rounded-md bg-danger/90 px-1.5 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>
                    )}
                  </div>

                  {/* Delivery */}
                  <div className="absolute left-2 bottom-2">
                    <span className="flex items-center gap-1 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                      {item.delivery === "Auto" ? <><Zap className="size-3" />Auto</> : DELIVERY_LABEL[item.delivery] ?? item.delivery}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-text group-hover:text-accent">
                    {item.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Star className="size-3.5 fill-warning text-warning" />
                    <span className="font-medium text-text">{item.rating.toFixed(1)}</span>
                    <span>({formatNumber(item.reviewCount)})</span>
                    <span className="text-text-dim">•</span>
                    <span>Đã bán {formatNumber(item.sold)}</span>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-2">
                    <div>
                      <div className="num text-base font-extrabold text-accent">{formatVND(item.price)}</div>
                      {item.comparePrice && (
                        <div className="num text-xs text-text-dim line-through">{formatVND(item.comparePrice)}</div>
                      )}
                    </div>
                    {item.warrantyDays > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-text-muted">
                        <ShieldCheck className="size-3 text-success" />
                        BH {item.warrantyDays}d
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 border-t border-border pt-2 text-xs text-text-muted">
                    <span
                      className="grid size-5 place-items-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: item.sellerAvatarColor }}
                    >
                      {item.sellerUsername[0]?.toUpperCase()}
                    </span>
                    <span className="truncate">{item.sellerUsername}</span>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
