import { Clock, Zap } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { SiteShell } from "@/components/SiteShell";
import { Countdown } from "@/components/Countdown";
import { fetchActiveFlashSale, fetchProducts } from "@/lib/serverData";

export const metadata = { title: "Flash Sale | MMO Market" };
export const revalidate = 30;

export default async function FlashSalePage() {
  const [sale, allProducts] = await Promise.all([
    fetchActiveFlashSale(),
    fetchProducts({ pageSize: 60 }),
  ]);
  const onSale = allProducts.filter((p) => p.comparePrice && p.comparePrice > p.price);
  const list = onSale.length > 0 ? onSale : allProducts.slice(0, 12);
  return (
    <SiteShell>
      <section className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-rose-600 to-pink-600">
        <div className="absolute inset-0 bg-dots opacity-25 mix-blend-overlay" />
        <div className="mx-auto max-w-7xl px-4 py-12 text-white">
          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest">
            <Zap className="size-5" />
            {sale ? sale.title : "Flash sale"}
          </div>
          <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">
            {sale ? (
              <>Giảm sốc đến <span className="text-yellow-200">{sale.discountPercent}%</span></>
            ) : (
              "Ưu đãi giảm giá"
            )}
          </h1>
          <p className="mt-3 max-w-xl text-white/85">
            Số lượng có hạn — nhanh tay kẻo lỡ.
          </p>

          {sale && (
            <div className="mt-6 flex items-center gap-2">
              <Clock className="size-5" />
              <span className="text-sm font-semibold">Kết thúc trong:</span>
              <Countdown endsAt={sale.endsAt} variant="boxes" />
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
