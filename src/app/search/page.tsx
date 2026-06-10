import { Suspense } from "react";
import { SiteShell } from "@/components/SiteShell";
import { SearchClient } from "./SearchClient";

export const metadata = { title: "Tìm kiếm | MMO Market" };

export default function SearchPage() {
  return (
    <SiteShell>
      <Suspense fallback={null}>
        <SearchClient />
      </Suspense>
    </SiteShell>
  );
}
