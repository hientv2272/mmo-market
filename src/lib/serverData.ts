import "server-only";
import { API_URL } from "./api";
import { mapProduct } from "./productMap";
import type {
  ApiCategory,
  ApiProductDetail,
  ApiProductListItem,
  ApiProductListResponse,
  ApiSellerSummary,
} from "./apiTypes";
import type {
  Category,
  Product,
  ReviewItem,
  Seller,
  CategorySlug,
} from "./types";

async function safeFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      next: { revalidate: 30 },
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const categoryColorMap: Record<string, string> = {
  ai: "from-violet-500 to-fuchsia-500",
  tool: "from-cyan-500 to-blue-500",
  course: "from-emerald-500 to-teal-500",
  giftcard: "from-pink-500 to-rose-500",
  game: "from-amber-500 to-orange-500",
  social: "from-sky-500 to-indigo-500",
  engagement: "from-red-500 to-pink-500",
  bestseller: "from-fuchsia-500 to-purple-500",
};

function mapCategory(c: ApiCategory): Category {
  return {
    slug: c.slug as CategorySlug,
    name: c.name,
    short: c.short,
    iconKey: c.iconKey,
    description: c.description,
    color: categoryColorMap[c.slug] || "from-violet-500 to-fuchsia-500",
    productCount: c.productCount,
  };
}

function mapSeller(s: ApiSellerSummary): Seller {
  const kyc = s.kycStatus.toLowerCase();
  return {
    id: s.id,
    username: s.username,
    displayName: s.displayName,
    avatarColor: s.avatarColor,
    rating: s.rating,
    reviewCount: s.reviewCount,
    joinedAt: s.joinedAt ?? new Date().toISOString(),
    totalSold: s.totalSold,
    badge: (s.badge as Seller["badge"]) || undefined,
    kycStatus: (kyc === "approved" || kyc === "pending" || kyc === "rejected" ? kyc : "approved") as Seller["kycStatus"],
    trustScore: s.trustScore,
    responseTime: s.responseTime ?? undefined,
  };
}

function mapProductDetail(p: ApiProductDetail): { product: Product; reviews: ReviewItem[]; seller: Seller } {
  return {
    product: {
      ...mapProduct(p),
      description: p.description,
      features: p.features,
      policies: p.policies,
      faq: p.faq,
    },
    reviews: p.reviews.map((r) => ({
      id: r.id,
      productId: p.id,
      buyerName: r.buyerName,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      reply: r.reply || undefined,
    })),
    seller: mapSeller(p.seller),
  };
}

export type StatsOverview = {
  totalProducts: number;
  totalSellers: number;
  gmv30d: number;
  orders30d: number;
  totalCompletedOrders: number;
  avgRating: number;
  affiliateTotalPaid: number;
  activeAffiliates: number;
};

export async function fetchStatsOverview(): Promise<StatsOverview | null> {
  return await safeFetch<StatsOverview>("/api/stats/overview");
}

export type ActiveFlashSale = { id: string; title: string; discountPercent: number; startsAt: string; endsAt: string };

export async function fetchActiveFlashSale(): Promise<ActiveFlashSale | null> {
  return await safeFetch<ActiveFlashSale>("/api/flash-sale/active");
}

export async function fetchCategories(): Promise<Category[]> {
  const data = await safeFetch<ApiCategory[]>("/api/categories");
  if (!data) {
    const { categories } = await import("./data");
    return categories;
  }
  return data.map(mapCategory);
}

export async function fetchProducts(opts: { category?: string; sort?: string; page?: number; pageSize?: number; q?: string } = {}): Promise<Product[]> {
  const params = new URLSearchParams();
  if (opts.category) params.set("category", opts.category);
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.q) params.set("q", opts.q);
  params.set("page", String(opts.page ?? 1));
  params.set("pageSize", String(opts.pageSize ?? 60));
  const data = await safeFetch<ApiProductListResponse>(`/api/products?${params}`);
  if (!data) {
    const { products } = await import("./data");
    let list = opts.category ? products.filter((p) => p.category === opts.category) : products;
    if (opts.q) {
      const term = opts.q.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term));
    }
    return list;
  }
  return data.items.map(mapProduct);
}

export async function fetchProductBySlug(slug: string): Promise<{ product: Product; reviews: ReviewItem[]; seller: Seller } | null> {
  const data = await safeFetch<ApiProductDetail>(`/api/products/${slug}`);
  if (!data) {
    const { products, sellers } = await import("./data");
    const p = products.find((x) => x.slug === slug);
    if (!p) return null;
    const seller = sellers.find((s) => s.id === p.sellerId);
    if (!seller) return null;
    return { product: p, reviews: [], seller };
  }
  return mapProductDetail(data);
}

export async function fetchSellers(): Promise<Seller[]> {
  const data = await safeFetch<ApiSellerSummary[]>("/api/sellers");
  if (!data) {
    const { sellers } = await import("./data");
    return sellers;
  }
  return data.map(mapSeller);
}

export async function fetchSellerByUsername(username: string): Promise<{ seller: Seller; products: Product[] } | null> {
  const data = await safeFetch<{ seller: ApiSellerSummary; products: ApiProductListItem[] }>(`/api/sellers/${username}`);
  if (!data) {
    const { sellers, products } = await import("./data");
    const s = sellers.find((x) => x.username === username);
    if (!s) return null;
    return { seller: s, products: products.filter((p) => p.sellerId === s.id) };
  }
  return { seller: mapSeller(data.seller), products: data.products.map(mapProduct) };
}
