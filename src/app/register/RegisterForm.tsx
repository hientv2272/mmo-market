"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, User, AtSign, AlertCircle } from "lucide-react";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/AuthContext";

export function RegisterForm() {
  const { register, loginWithGoogle } = useAuth();
  const router = useRouter();
  const refParam = useSearchParams().get("ref") ?? "";
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [referralCode, setReferralCode] = useState(refParam);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (cr: CredentialResponse) => {
    if (!cr.credential) return;
    setErr(null);
    setLoading(true);
    try {
      await loginWithGoogle(cr.credential);
      router.push("/account");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Đăng ký qua Google thất bại");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) return setErr("Mật khẩu phải tối thiểu 6 ký tự");
    if (password !== confirm) return setErr("Mật khẩu nhập lại không khớp");
    setLoading(true);
    try {
      await register(email, password, username, displayName, referralCode || undefined);
      router.push("/account");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {err && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{err}</span>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Họ tên</label>
          <Input
            leftIcon={<User className="size-4" />}
            placeholder="Nguyễn Văn A"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Username</label>
          <Input
            leftIcon={<AtSign className="size-4" />}
            placeholder="username_3-20_kytu"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-muted">Email</label>
        <Input
          leftIcon={<Mail className="size-4" />}
          placeholder="email@gmail.com"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Mật khẩu</label>
          <Input
            leftIcon={<Lock className="size-4" />}
            placeholder="≥ 6 ký tự"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Nhập lại mật khẩu</label>
          <Input
            leftIcon={<Lock className="size-4" />}
            placeholder="••••••••"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-text-muted">Mã giới thiệu (tuỳ chọn)</label>
        <Input
          placeholder="Nhập mã giới thiệu (nếu có)"
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value)}
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-text-muted">
        <input type="checkbox" className="mt-0.5 size-4 accent-brand" defaultChecked />
        <span>
          Tôi đồng ý với{" "}
          <Link href="/policy/terms" className="text-accent hover:underline">Điều khoản sử dụng</Link> và{" "}
          <Link href="/policy/privacy" className="text-accent hover:underline">Chính sách bảo mật</Link>.
        </span>
      </label>
      <Button size="lg" className="w-full" type="submit" disabled={loading}>
        {loading ? "Đang tạo..." : "Tạo tài khoản"}
      </Button>
      <div className="relative flex items-center">
        <div className="flex-grow border-t border-border" />
        <span className="mx-3 shrink-0 text-xs text-text-muted">hoặc đăng ký nhanh</span>
        <div className="flex-grow border-t border-border" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setErr("Đăng ký qua Google thất bại")}
          theme="filled_black"
          size="large"
          text="signup_with"
          shape="rectangular"
          width={360}
        />
      </div>
      <p className="pt-2 text-center text-sm text-text-muted">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">Đăng nhập</Link>
      </p>
    </form>
  );
}
