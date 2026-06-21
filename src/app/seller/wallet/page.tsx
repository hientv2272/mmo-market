import { SellerGuard } from "@/components/SellerGuard";
import { SellerWalletClient } from "./SellerWalletClient";

export const metadata = { title: "Nạp ví | MMO Market Seller" };

export default function SellerWalletPage() {
  return <SellerGuard><SellerWalletClient /></SellerGuard>;
}
