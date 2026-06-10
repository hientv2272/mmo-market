import { Suspense } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Logo } from "./Logo";
import { categories } from "@/lib/data";
import { HeaderUserActions } from "./HeaderUserActions";
import { HeaderSearch } from "./HeaderSearch";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur-xl">
      {/* Top bar */}
      <div className="hidden border-b border-border/60 bg-bg-elev/50 text-xs text-text-muted lg:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-success" />
              Hệ thống đang hoạt động bình thường
            </span>
            <span>Hỗ trợ 24/7</span>
            <Link href="/help" className="hover:text-text">
              Trung tâm hỗ trợ
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/seller/onboarding" className="hover:text-text">
              Đăng ký bán hàng
            </Link>
            <Link href="/affiliate" className="hover:text-text">
              Affiliate / CTV
            </Link>
            <Link href="/help/buy" className="hover:text-text">
              Hướng dẫn mua hàng
            </Link>
            <span className="text-text-dim">|</span>
            <span>VND 🇻🇳</span>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Logo />

        {/* Search */}
        <Suspense fallback={<div className="hidden h-11 flex-1 rounded-full border border-border bg-bg-elev md:block" />}>
          <HeaderSearch />
        </Suspense>

        {/* Actions — role-aware, rendered client-side */}
        <HeaderUserActions />
      </div>

      {/* Category nav */}
      <div className="hidden border-t border-border bg-bg-elev/40 md:block">
        <div className="mx-auto flex h-11 max-w-7xl items-center gap-1 overflow-x-auto px-2 text-sm no-scrollbar">
          <Link
            href="/marketplace"
            className="whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-text hover:bg-bg-elev"
          >
            Tất cả sản phẩm
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/c/${c.slug}`}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-text-muted hover:bg-bg-elev hover:text-text"
            >
              {c.name}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/flash-sale"
              className="whitespace-nowrap rounded-full bg-warning/10 px-3 py-1.5 font-medium text-warning hover:bg-warning/20"
            >
              ⚡ Flash Sale
            </Link>
            <Link
              href="/seller/dashboard"
              className="flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-text-muted hover:bg-bg-elev hover:text-text"
            >
              Kênh người bán
              <ChevronDown className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
