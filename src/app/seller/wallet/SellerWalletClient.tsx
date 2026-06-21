"use client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { sellerNav } from "@/lib/sellerNav";
import { WalletClient } from "@/app/account/wallet/WalletClient";

export function SellerWalletClient() {
  return (
    <DashboardLayout
      variant="seller"
      groups={sellerNav}
      title="Nạp ví"
      subtitle="Nạp số dư để mua gói thành viên, đẩy tin (boost) và badge uy tín"
    >
      <WalletClient />
    </DashboardLayout>
  );
}
