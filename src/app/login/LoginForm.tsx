"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, AlertCircle, Info } from "lucide-react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/AuthContext";

export function LoginForm() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const expired = useSearchParams().get("expired") === "1";
  const [email, setEmail] = useState("buyer@mmo.local");
  const [password, setPassword] = useState("Buyer@123");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (cr: CredentialResponse) => {
    if (!cr.credential) return;
    setErr(null);
    setLoading(true);
    try {
      const user = await loginWithGoogle(cr.credential);
      if (user.role === "Admin" || user.role === "SuperAdmin") router.push("/admin");
      else if (user.role === "Seller") router.push("/seller/dashboard");
      else router.push("/account");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Đăng nhập Google thất bại");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "Admin" || user.role === "SuperAdmin") router.push("/admin");
      else if (user.role === "Seller") router.push("/seller/dashboard");
      else router.push("/account");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {expired && !err && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</span>
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{err}</span>
        </div>
      )}
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-text-muted">
        <strong className="text-accent">Demo accounts:</strong>{" "}
        <code className="text-text">buyer@mmo.local / Buyer@123</code> ·{" "}
        <code className="text-text">admin@mmo.local / Admin@123</code>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-muted">
          Email
        </label>
        <Input
          leftIcon={<Mail className="size-4" />}
          placeholder="email@gmail.com"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <label className="font-medium text-text-muted">Mật khẩu</label>
          <Link
            href="/forgot-password"
            className="text-accent hover:underline"
          >
            Quên mật khẩu?
          </Link>
        </div>
        <Input
          leftIcon={<Lock className="size-4" />}
          placeholder="••••••••"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" className="size-4 accent-brand" defaultChecked />
        Ghi nhớ đăng nhập trên thiết bị này
      </label>
      <Button size="lg" className="w-full" type="submit" disabled={loading}>
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
      <div className="relative flex items-center">
        <div className="flex-grow border-t border-border" />
        <span className="mx-3 shrink-0 text-xs text-text-muted">hoặc</span>
        <div className="flex-grow border-t border-border" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setErr("Đăng nhập Google thất bại")}
          theme="filled_black"
          size="large"
          text="continue_with"
          shape="rectangular"
          width={360}
        />
      </div>
      <p className="pt-2 text-center text-sm text-text-muted">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-semibold text-accent hover:underline">
          Đăng ký miễn phí
        </Link>
      </p>
    </form>
  );
}
