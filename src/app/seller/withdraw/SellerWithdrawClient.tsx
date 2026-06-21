"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine, Loader2, Plus, Trash2, Pencil, Star, AlertTriangle,
  Wallet, Building2, Smartphone, Bitcoin, X, ShieldCheck,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TotpVerifyModal } from "@/components/TotpVerifyModal";
import { sellerNav } from "@/lib/sellerNav";
import { useAuth } from "@/lib/AuthContext";
import { apiFetch } from "@/lib/api";
import type { ApiSellerDashboard, ApiSellerWithdraw, ApiPayoutMethod, ApiPayoutMethodSave } from "@/lib/apiTypes";
import { formatRelativeTime, formatVND } from "@/lib/format";
import { VN_BANKS, USDT_NETWORKS } from "@/lib/vnBanks";

const statusTone: Record<string, "success" | "warning" | "danger" | "muted"> = {
  Paid: "success",
  Approved: "success",
  Pending: "warning",
  Rejected: "danger",
};

const typeLabel: Record<string, string> = { Bank: "Ngân hàng", Momo: "MoMo", Usdt: "USDT" };
const typeIcon: Record<string, React.ReactNode> = {
  Bank: <Building2 className="size-4" />,
  Momo: <Smartphone className="size-4" />,
  Usdt: <Bitcoin className="size-4" />,
};

// Chuẩn hoá tên giống backend để cảnh báo lệch KYC ngay trên UI.
const normalizeName = (s?: string | null) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

const maskTail = (s?: string | null, keep = 4) => {
  if (!s) return "";
  if (s.length <= keep) return s;
  return "•••" + s.slice(-keep);
};

function payoutSummary(m: ApiPayoutMethod): string {
  if (m.type === "Bank") return `${m.bankName ?? "Ngân hàng"} · ${maskTail(m.accountNumber)} · ${m.accountHolder ?? ""}`;
  if (m.type === "Momo") return `MoMo ${maskTail(m.accountNumber)} · ${m.accountHolder ?? ""}`;
  if (m.type === "Usdt") return `USDT ${m.cryptoNetwork} · ${maskTail(m.walletAddress, 6)}`;
  return m.label;
}

type EditorState = {
  id?: string;
  type: string;
  label: string;
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  cryptoNetwork: string;
  walletAddress: string;
  isDefault: boolean;
};

const emptyEditor: EditorState = {
  type: "Bank", label: "", bankBin: "", bankName: "", accountNumber: "",
  accountHolder: "", cryptoNetwork: "TRC20", walletAddress: "", isDefault: false,
};

export function SellerWithdrawClient() {
  const { user, token, loading: authLoading, refresh } = useAuth();
  const [dash, setDash] = useState<ApiSellerDashboard | null>(null);
  const [withdraws, setWithdraws] = useState<ApiSellerWithdraw[]>([]);
  const [methods, setMethods] = useState<ApiPayoutMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form rút tiền
  const [amount, setAmount] = useState(0);
  const [toWallet, setToWallet] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [note, setNote] = useState("");

  // editor tài khoản nhận
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorErr, setEditorErr] = useState<string | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);

  const [totpModal, setTotpModal] = useState(false);
  const [totpErr, setTotpErr] = useState<string | null>(null);

  const reload = async () => {
    if (!token) return;
    try {
      const [d, w, m] = await Promise.all([
        apiFetch<ApiSellerDashboard>("/api/seller/dashboard", { token }),
        apiFetch<ApiSellerWithdraw[]>("/api/seller/withdraws", { token }),
        apiFetch<ApiPayoutMethod[]>("/api/seller/payout-methods", { token }),
      ]);
      setDash(d);
      setWithdraws(w);
      setMethods(m);
      setSelectedMethodId((prev) => prev || m.find((x) => x.isDefault)?.id || m[0]?.id || "");
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    void reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const balance = dash?.availableBalance ?? 0;
  const minWithdraw = dash?.minWithdraw ?? 50000;
  const maxWithdraw = dash?.maxWithdraw ?? 50000000;
  const selectedMethod = methods.find((m) => m.id === selectedMethodId) ?? null;

  // cảnh báo lệch tên KYC cho tài khoản đang chọn (chỉ khi có tên KYC để đối chiếu)
  const kycVerified = dash?.kycVerified ?? false;
  const kycName = dash?.kycFullName ?? null;
  const selectedHolderMismatch = useMemo(() => {
    if (!selectedMethod || (selectedMethod.type !== "Bank" && selectedMethod.type !== "Momo")) return false;
    if (!kycName) return false; // không có tên KYC trên hồ sơ → không thể đối chiếu
    return normalizeName(selectedMethod.accountHolder) !== normalizeName(kycName);
  }, [selectedMethod, kycName]);

  const doWithdraw = async (totpCode?: string) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        amount: Number(amount),
        method: toWallet ? "Wallet" : (selectedMethod?.type ?? "Bank"),
        note,
        totpCode: totpCode ?? null,
      };
      if (!toWallet) body.payoutMethodId = selectedMethodId;
      await apiFetch<ApiSellerWithdraw>("/api/seller/withdraws", {
        method: "POST", token, body: JSON.stringify(body),
      });
      setAmount(0); setNote(""); setTotpModal(false);
      await reload();
      if (toWallet) refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!toWallet && !selectedMethodId) { alert("Vui lòng chọn hoặc thêm tài khoản nhận tiền."); return; }
    if (amount < minWithdraw) { alert(`Số tiền rút tối thiểu là ${formatVND(minWithdraw)}.`); return; }
    if (amount > balance) { alert(`Vượt quá số dư khả dụng (${formatVND(balance)}).`); return; }
    if (user?.twoFactorEnabled) { setTotpErr(null); setTotpModal(true); return; }
    try { await doWithdraw(); }
    catch (e) { alert((e as Error).message); }
  };

  // ── Editor tài khoản nhận ──────────────────────────────────────────────────
  const openCreate = () => { setEditorErr(null); setEditor({ ...emptyEditor, isDefault: methods.length === 0 }); };
  const openEdit = (m: ApiPayoutMethod) => {
    setEditorErr(null);
    setEditor({
      id: m.id, type: m.type, label: m.label, bankBin: m.bankBin ?? "", bankName: m.bankName ?? "",
      accountNumber: m.accountNumber ?? "", accountHolder: m.accountHolder ?? "",
      cryptoNetwork: m.cryptoNetwork ?? "TRC20", walletAddress: m.walletAddress ?? "", isDefault: m.isDefault,
    });
  };

  const saveEditor = async () => {
    if (!token || !editor) return;
    setEditorSaving(true);
    setEditorErr(null);
    try {
      const payload: ApiPayoutMethodSave = {
        type: editor.type,
        label: editor.label || undefined,
        bankBin: editor.type === "Bank" ? editor.bankBin || null : null,
        bankName: editor.type === "Bank" ? editor.bankName || null : null,
        accountNumber: editor.type === "Bank" || editor.type === "Momo" ? editor.accountNumber || null : null,
        accountHolder: editor.type === "Bank" || editor.type === "Momo" ? editor.accountHolder || null : null,
        cryptoNetwork: editor.type === "Usdt" ? editor.cryptoNetwork || null : null,
        walletAddress: editor.type === "Usdt" ? editor.walletAddress || null : null,
        isDefault: editor.isDefault,
      };
      const saved = editor.id
        ? await apiFetch<ApiPayoutMethod>(`/api/seller/payout-methods/${editor.id}`, { method: "PUT", token, body: JSON.stringify(payload) })
        : await apiFetch<ApiPayoutMethod>("/api/seller/payout-methods", { method: "POST", token, body: JSON.stringify(payload) });
      setEditor(null);
      await reload();
      setSelectedMethodId(saved.id);
    } catch (e) {
      setEditorErr((e as Error).message);
    } finally {
      setEditorSaving(false);
    }
  };

  const deleteMethod = async (id: string) => {
    if (!token || !confirm("Xoá tài khoản nhận tiền này?")) return;
    try {
      await apiFetch(`/api/seller/payout-methods/${id}`, { method: "DELETE", token });
      if (selectedMethodId === id) setSelectedMethodId("");
      await reload();
    } catch (e) { alert((e as Error).message); }
  };

  const setDefault = async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/api/seller/payout-methods/${id}/default`, { method: "POST", token });
      await reload();
    } catch (e) { alert((e as Error).message); }
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Rút tiền" subtitle="Đang tải...">
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-text-muted" /></div>
      </DashboardLayout>
    );
  }

  if (!token) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Rút tiền" subtitle="">
        <div className="rounded-2xl border border-border bg-bg-card p-12 text-center">
          <p className="text-sm text-text-muted">Vui lòng <Link href="/login" className="text-accent hover:underline">đăng nhập</Link>.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout variant="seller" groups={sellerNav} title="Rút tiền" subtitle="">
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">{error}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      variant="seller"
      groups={sellerNav}
      title="Rút tiền"
      subtitle="Doanh thu đã trừ phí sàn · rút ra ngoài xử lý trong 1-2 ngày làm việc"
    >
      {totpModal && (
        <TotpVerifyModal
          title="Xác thực 2FA — Rút tiền"
          description="Nhập mã 6 chữ số từ Google Authenticator để xác nhận yêu cầu rút tiền."
          error={totpErr}
          loading={submitting}
          onConfirm={async (code) => {
            setTotpErr(null);
            try { await doWithdraw(code); }
            catch (e) { setTotpErr((e as Error).message || "Mã không đúng, vui lòng thử lại."); }
          }}
          onCancel={() => { setTotpModal(false); setTotpErr(null); }}
        />
      )}

      {editor && (
        <PayoutEditorModal
          editor={editor}
          setEditor={setEditor}
          error={editorErr}
          saving={editorSaving}
          kycName={kycName}
          onSave={saveEditor}
          onClose={() => setEditor(null)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 rounded-3xl border border-border bg-gradient-to-br from-brand/30 via-bg-card to-accent/20 p-6">
          <div className="text-xs font-medium uppercase tracking-wider text-text-muted">Số dư có thể rút</div>
          <div className="mt-2 num text-4xl font-bold text-text">{formatVND(balance)}</div>
          <p className="mt-2 text-xs text-text-muted">
            Tối thiểu {formatVND(minWithdraw)} · tối đa {formatVND(maxWithdraw)}/lần · còn {dash?.pendingWithdrawals ?? 0} yêu cầu đang chờ duyệt
          </p>
          {!kycVerified ? (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="size-3.5 shrink-0" />
              Bạn chưa có KYC được duyệt. <Link href="/seller/kyc" className="underline">Hoàn tất KYC</Link> để rút tiền an toàn.
            </p>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
              <ShieldCheck className="size-3.5 shrink-0" />
              KYC đã được duyệt{kycName ? ` — ${kycName}` : ""}. Nên rút về tài khoản đứng tên chính bạn.
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="rounded-3xl border border-border bg-bg-card p-5">
          <h3 className="text-sm font-bold text-text">Yêu cầu rút mới</h3>

          <label className="mt-3 block text-xs text-text-muted">
            Số tiền (VND)
            <input
              type="number" min={minWithdraw} max={balance} required
              className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
              value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>

          {/* Đích đến */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setToWallet(true)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${toWallet ? "border-brand bg-brand/10 text-text" : "border-border bg-bg-elev text-text-muted hover:text-text"}`}>
              <Wallet className="size-3.5" /> Vào ví (ngay)
            </button>
            <button type="button" onClick={() => setToWallet(false)}
              className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${!toWallet ? "border-brand bg-brand/10 text-text" : "border-border bg-bg-elev text-text-muted hover:text-text"}`}>
              <ArrowDownToLine className="size-3.5" /> Ra ngoài
            </button>
          </div>

          {toWallet ? (
            <p className="mt-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text-muted">
              Doanh thu chuyển <b className="text-text">ngay lập tức</b> vào số dư ví để mua gói, đẩy tin (boost) hoặc badge — không cần admin duyệt.
            </p>
          ) : (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Tài khoản nhận tiền</span>
                <button type="button" onClick={openCreate} className="flex items-center gap-1 text-xs text-accent hover:underline">
                  <Plus className="size-3" /> Thêm
                </button>
              </div>
              {methods.length === 0 ? (
                <p className="mt-1 rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-text-muted">
                  Chưa có tài khoản nhận. Bấm “Thêm” để tạo.
                </p>
              ) : (
                <select
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
                  value={selectedMethodId} onChange={(e) => setSelectedMethodId(e.target.value)}
                >
                  {methods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {typeLabel[m.type] ?? m.type} — {m.label}{m.isDefault ? " ★" : ""}
                    </option>
                  ))}
                </select>
              )}
              {selectedMethod && (
                <p className="mt-1.5 font-mono text-[11px] text-text-muted">{payoutSummary(selectedMethod)}</p>
              )}
              {selectedHolderMismatch && (
                <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-[11px] text-warning">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  Tên chủ tài khoản không khớp tên KYC{kycName ? ` (${kycName})` : ""}. Yêu cầu có thể bị admin từ chối.
                </p>
              )}
            </div>
          )}

          <label className="mt-3 block text-xs text-text-muted">
            Ghi chú
            <input
              className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
              value={note} onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <Button type="submit" size="sm" className="mt-4 w-full"
            disabled={submitting || balance < minWithdraw || (!toWallet && !selectedMethodId)}
            leftIcon={<ArrowDownToLine className="size-3.5" />}>
            {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
          </Button>
        </form>
      </div>

      {/* Sổ tài khoản nhận tiền */}
      <section className="mt-6 rounded-2xl border border-border bg-bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-text">Sổ tài khoản nhận tiền</h3>
            <p className="text-xs text-text-muted">Lưu sẵn để rút nhanh. Tên chủ tài khoản nên khớp tên KYC.</p>
          </div>
          <Button size="sm" variant="outline" onClick={openCreate} leftIcon={<Plus className="size-3.5" />}>Thêm tài khoản</Button>
        </div>
        {methods.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-text-muted">Chưa có tài khoản nhận nào.</div>
        ) : (
          <div className="divide-y divide-border">
            {methods.map((m) => {
              return (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-bg-elev text-text-muted">{typeIcon[m.type]}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-text">{m.label}</span>
                      {m.isDefault && <Badge tone="success">Mặc định</Badge>}
                      {m.type !== "Usdt" && kycName && (m.holderMatchesKyc
                        ? <span className="inline-flex items-center gap-0.5 text-[10px] text-success"><ShieldCheck className="size-3" /> khớp KYC</span>
                        : <span className="inline-flex items-center gap-0.5 text-[10px] text-warning"><AlertTriangle className="size-3" /> lệch KYC</span>)}
                    </div>
                    <div className="truncate font-mono text-[11px] text-text-muted">{payoutSummary(m)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!m.isDefault && (
                      <button title="Đặt mặc định" onClick={() => setDefault(m.id)} className="rounded-md p-1.5 text-text-muted hover:bg-bg-elev hover:text-warning"><Star className="size-4" /></button>
                    )}
                    <button title="Sửa" onClick={() => openEdit(m)} className="rounded-md p-1.5 text-text-muted hover:bg-bg-elev hover:text-text"><Pencil className="size-4" /></button>
                    <button title="Xoá" onClick={() => deleteMethod(m.id)} className="rounded-md p-1.5 text-text-muted hover:bg-bg-elev hover:text-danger"><Trash2 className="size-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Lịch sử */}
      <section className="mt-6 rounded-2xl border border-border bg-bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-bold text-text">Lịch sử yêu cầu</h3>
        </div>
        {withdraws.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-text-muted">Chưa có yêu cầu nào.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
                <th className="px-4 py-3">Phương thức</th>
                <th className="px-4 py-3">Tài khoản nhận</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {withdraws.map((w) => (
                <tr key={w.id} className="hover:bg-bg-elev/30">
                  <td className="px-4 py-3 font-mono text-[11px] text-text-muted">WD-{w.id.slice(0, 6)}</td>
                  <td className="num px-4 py-3 text-right font-semibold text-text">{formatVND(w.amount)}</td>
                  <td className="px-4 py-3 text-text-muted">{typeLabel[w.method] ?? w.method}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-text-muted">{w.account}</div>
                    {w.payoutReference && <div className="text-[10px] text-success">ref: {w.payoutReference}</div>}
                  </td>
                  <td className="px-4 py-3 text-center"><Badge tone={statusTone[w.status] ?? "muted"}>{w.status}</Badge></td>
                  <td className="px-4 py-3 text-right text-xs text-text-muted">{formatRelativeTime(w.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </DashboardLayout>
  );
}

// ── Modal thêm/sửa tài khoản nhận ─────────────────────────────────────────────
function PayoutEditorModal({
  editor, setEditor, error, saving, kycName, onSave, onClose,
}: {
  editor: EditorState;
  setEditor: (e: EditorState) => void;
  error: string | null;
  saving: boolean;
  kycName: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const set = (patch: Partial<EditorState>) => setEditor({ ...editor, ...patch });
  const holderMismatch =
    (editor.type === "Bank" || editor.type === "Momo") && editor.accountHolder.trim().length > 0 &&
    !!kycName && normalizeName(editor.accountHolder) !== normalizeName(kycName);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text">{editor.id ? "Sửa tài khoản nhận" : "Thêm tài khoản nhận"}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-text-muted hover:bg-bg-elev hover:text-text"><X className="size-4" /></button>
        </div>

        <label className="mt-3 block text-xs text-text-muted">
          Loại
          <select className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
            value={editor.type} onChange={(e) => set({ type: e.target.value })}>
            <option value="Bank">Ngân hàng</option>
            <option value="Momo">MoMo</option>
            <option value="Usdt">USDT (crypto)</option>
          </select>
        </label>

        {editor.type === "Bank" && (
          <>
            <label className="mt-2 block text-xs text-text-muted">
              Ngân hàng
              <select className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
                value={editor.bankBin}
                onChange={(e) => {
                  const bank = VN_BANKS.find((b) => b.bin === e.target.value);
                  set({ bankBin: e.target.value, bankName: bank?.short ?? "" });
                }}>
                <option value="">— Chọn ngân hàng —</option>
                {VN_BANKS.map((b) => <option key={b.bin} value={b.bin}>{b.name}</option>)}
              </select>
            </label>
            <label className="mt-2 block text-xs text-text-muted">
              Số tài khoản
              <input inputMode="numeric" className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
                value={editor.accountNumber} onChange={(e) => set({ accountNumber: e.target.value.replace(/\D/g, "") })} />
            </label>
            <label className="mt-2 block text-xs text-text-muted">
              Tên chủ tài khoản (không dấu)
              <input className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm uppercase text-text outline-none focus:border-brand"
                value={editor.accountHolder} onChange={(e) => set({ accountHolder: e.target.value })} />
            </label>
          </>
        )}

        {editor.type === "Momo" && (
          <>
            <label className="mt-2 block text-xs text-text-muted">
              Số điện thoại MoMo
              <input inputMode="numeric" placeholder="09xxxxxxxx" className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
                value={editor.accountNumber} onChange={(e) => set({ accountNumber: e.target.value.replace(/\D/g, "") })} />
            </label>
            <label className="mt-2 block text-xs text-text-muted">
              Tên chủ ví
              <input className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm uppercase text-text outline-none focus:border-brand"
                value={editor.accountHolder} onChange={(e) => set({ accountHolder: e.target.value })} />
            </label>
          </>
        )}

        {editor.type === "Usdt" && (
          <>
            <label className="mt-2 block text-xs text-text-muted">
              Mạng lưới
              <select className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
                value={editor.cryptoNetwork} onChange={(e) => set({ cryptoNetwork: e.target.value })}>
                {USDT_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="mt-2 block text-xs text-text-muted">
              Địa chỉ ví
              <input className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 font-mono text-xs text-text outline-none focus:border-brand"
                value={editor.walletAddress} onChange={(e) => set({ walletAddress: e.target.value.trim() })} />
            </label>
            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-text-muted">
              <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning" />
              Kiểm tra kỹ địa chỉ &amp; đúng mạng lưới. Chuyển sai mạng/địa chỉ sẽ <b>mất tiền vĩnh viễn</b>.
            </p>
          </>
        )}

        <label className="mt-3 block text-xs text-text-muted">
          Tên gợi nhớ (tuỳ chọn)
          <input placeholder="VD: VCB chính" className="mt-1 h-9 w-full rounded-lg border border-border bg-bg-elev px-3 text-sm text-text outline-none focus:border-brand"
            value={editor.label} onChange={(e) => set({ label: e.target.value })} />
        </label>

        <label className="mt-3 flex items-center gap-2 text-xs text-text-muted">
          <input type="checkbox" checked={editor.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} />
          Đặt làm tài khoản mặc định
        </label>

        {holderMismatch && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            Tên chủ tài khoản không khớp tên KYC ({kycName}).
          </p>
        )}

        {error && <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose} disabled={saving}>Huỷ</Button>
          <Button size="sm" onClick={onSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
        </div>
      </div>
    </div>
  );
}
