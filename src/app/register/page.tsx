import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Đăng ký | MMO Market" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Đăng ký miễn phí"
      subtitle="Mở tài khoản trong 30 giây. Nhận ngay 100K vào ví & 100 điểm loyalty khi đăng ký."
    >
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
