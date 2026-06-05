import { AdminGuard } from "@/components/AdminGuard";
import { AdminPlansClient } from "./AdminPlansClient";

export const metadata = { title: "Gói thành viên Seller | Admin" };

export default function AdminPlansPage() {
  return <AdminGuard><AdminPlansClient /></AdminGuard>;
}
