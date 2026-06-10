import { DashboardLayout } from "@/components/DashboardLayout";
import { buyerNav } from "@/lib/buyerNav";
import { ReferralClient } from "./ReferralClient";

export const metadata = { title: "Affiliate / Giới thiệu bạn | MMO Market" };

export default function ReferralPage() {
  return (
    <DashboardLayout
      variant="buyer"
      groups={buyerNav}
      title="Affiliate / Giới thiệu bạn"
      subtitle="Mời bạn bè – nhận đến 10% hoa hồng cho mỗi đơn họ mua"
    >
      <ReferralClient />
    </DashboardLayout>
  );
}
