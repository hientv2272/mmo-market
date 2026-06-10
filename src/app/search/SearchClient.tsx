"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MarketplaceClient } from "../marketplace/MarketplaceClient";
import { apiFetch } from "@/lib/api";
import { mapProduct } from "@/lib/productMap";
import type { ApiProductListResponse } from "@/lib/apiTypes";
import type { Product } from "@/lib/types";

export function SearchClient() {
  const term = (useSearchParams().get("q") ?? "").trim();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!term) { setProducts([]); return; }
    let cancelled = false;
    setLoading(true);
    apiFetch<ApiProductListResponse>(`/api/products?q=${encodeURIComponent(term)}&pageSize=60`)
      .then((res) => { if (!cancelled) setProducts(res.items.map(mapProduct)); })
      .catch(() => { if (!cancelled) setProducts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [term]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-2 text-xs text-text-muted">
        <Link href="/" className="hover:text-text">Trang chủ</Link>
        <span>/</span>
        <span className="text-text">Tìm kiếm</span>
      </nav>

      <h1 className="mb-1 text-2xl font-extrabold text-text md:text-3xl">Kết quả tìm kiếm</h1>
      <p className="mb-6 text-sm text-text-muted">
        {term
          ? <>Tìm thấy <span className="font-semibold text-text">{products.length}</span> sản phẩm cho “<span className="text-text">{term}</span>”</>
          : "Nhập từ khoá vào ô tìm kiếm phía trên để bắt đầu."}
      </p>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-text-muted" /></div>
      ) : term && products.length === 0 ? (
        <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
          <p className="text-sm text-text-muted">
            Không tìm thấy sản phẩm nào khớp với “{term}”.{" "}
            <Link href="/marketplace" className="text-accent hover:underline">Xem tất cả sản phẩm</Link>
          </p>
        </div>
      ) : term ? (
        <MarketplaceClient initialProducts={products} />
      ) : null}
    </div>
  );
}
