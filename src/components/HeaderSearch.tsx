"use client";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";

export function HeaderSearch() {
  const q = useSearchParams().get("q") ?? "";
  return (
    <form action="/search" className="relative hidden flex-1 md:block" role="search">
      <input
        name="q"
        type="search"
        defaultValue={q}
        key={q}
        placeholder="Tìm tài khoản AI, tool, gift card, khoá học..."
        className="h-11 w-full rounded-full border border-border bg-bg-elev pl-11 pr-32 text-sm text-text placeholder:text-text-dim outline-none ring-0 transition focus:border-brand focus:bg-bg-card"
      />
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
      <button
        type="submit"
        className="absolute right-1.5 top-1.5 h-8 rounded-full bg-gradient-to-r from-brand to-accent px-4 text-xs font-semibold text-white shadow-md shadow-brand/40"
      >
        Tìm kiếm
      </button>
    </form>
  );
}
