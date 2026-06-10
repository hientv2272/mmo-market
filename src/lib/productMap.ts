// Mapper thuần API -> Product, dùng được cả ở server (serverData) lẫn client (search).
// KHÔNG import "server-only" ở đây để client component có thể tái dùng.
import type { ApiProductListItem } from "./apiTypes";
import type { Product, CategorySlug, DeliveryMethod } from "./types";

export function mapDelivery(d: string): DeliveryMethod {
  return (d.toLowerCase() as DeliveryMethod) || "auto";
}

export function mapBadges(input: string[]): Product["badges"] {
  const out: Product["badges"] = [];
  for (const b of input) {
    const lo = b.toLowerCase();
    if (lo.includes("hot") || lo.includes("flash")) out.push("flash");
    else if (lo.includes("top")) out.push("top");
    else if (lo.includes("new") || lo.includes("mới")) out.push("new");
    else if (lo.includes("limit") || lo.includes("giới hạn")) out.push("limited");
  }
  return out.length > 0 ? out : ["top"];
}

export function mapProduct(p: ApiProductListItem): Product {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    category: p.categorySlug as CategorySlug,
    thumbnailColor: p.thumbnailColor,
    thumbnailIcon: p.thumbnailIcon || undefined,
    image: p.imageUrl || undefined,
    price: p.price,
    comparePrice: p.comparePrice || undefined,
    rating: p.rating,
    reviewCount: p.reviewCount,
    sold: p.sold,
    stock: p.stock,
    delivery: mapDelivery(p.delivery),
    warrantyDays: p.warrantyDays,
    sellerId: p.seller.id,
    seller: {
      id: p.seller.id,
      username: p.seller.username,
      displayName: p.seller.displayName,
      avatarColor: p.seller.avatarColor,
      badge: (p.seller.badge as "verified" | "top" | "new" | undefined) || undefined,
    },
    badges: mapBadges(p.badges),
    shortDescription: `${p.title} — bảo hành ${p.warrantyDays} ngày`,
    description: "",
    features: [],
    policies: [],
    faq: [],
    createdAt: new Date().toISOString(),
  };
}
