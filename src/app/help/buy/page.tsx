import Link from "next/link";
import { ShoppingBag, Search, Wallet, CreditCard, PackageCheck, ShieldCheck, AlertTriangle } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Hướng dẫn mua hàng | MMO Market" };

const steps = [
  {
    icon: Search,
    title: "1. Tìm sản phẩm",
    body: "Dùng thanh tìm kiếm hoặc lọc theo danh mục để tìm tài khoản, phần mềm hay dịch vụ bạn cần. Đọc kỹ mô tả, đánh giá của người mua trước và uy tín của seller (badge xác minh, tỉ lệ giao hàng thành công).",
  },
  {
    icon: Wallet,
    title: "2. Nạp tiền vào ví",
    body: "Nạp tiền vào ví MMO Market qua chuyển khoản ngân hàng, ví điện tử hoặc cổng thanh toán. Số dư trong ví sẽ được dùng để thanh toán đơn hàng — nhanh hơn và an toàn hơn so với thanh toán trực tiếp từng lần.",
  },
  {
    icon: CreditCard,
    title: "3. Đặt hàng & thanh toán",
    body: "Bấm “Mua ngay”, kiểm tra lại thông tin đơn và xác nhận thanh toán. Tiền sẽ được trừ khỏi ví và giữ trong tài khoản trung gian (escrow) — seller chưa nhận được tiền tại thời điểm này.",
  },
  {
    icon: PackageCheck,
    title: "4. Nhận hàng",
    body: "Với sản phẩm auto-delivery, thông tin được giao ngay trong vòng 5 giây. Với sản phẩm manual, seller có tối đa 24 giờ để giao. Bạn có thể xem thông tin tài khoản/sản phẩm ngay trong trang đơn hàng.",
  },
  {
    icon: ShieldCheck,
    title: "5. Kiểm tra & xác nhận",
    body: "Bạn có 72 giờ để kiểm tra sản phẩm. Nếu đúng mô tả, hãy bấm “Đã nhận” để giải phóng tiền cho seller và để lại đánh giá. Nếu không, hãy mở khiếu nại ngay trong cửa sổ 72 giờ này.",
  },
];

const tips = [
  "Luôn giao dịch trong sàn — đừng bao giờ chuyển khoản riêng cho seller để né phí, vì giao dịch ngoài sàn không được escrow bảo vệ.",
  "Đọc kỹ mô tả và phần bảo hành trước khi mua. Nếu có thắc mắc, hãy nhắn cho seller trước.",
  "Ưu tiên seller có badge xác minh (KYC) và lịch sử đánh giá tốt.",
  "Đổi mật khẩu / thông tin bảo mật ngay sau khi nhận tài khoản và kiểm tra trong cửa sổ 72 giờ.",
  "Lưu lại bằng chứng (ảnh chụp màn hình) nếu sản phẩm không đúng mô tả để phục vụ khiếu nại.",
];

export default function BuyGuidePage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ShoppingBag className="size-10 text-success" />
        <h1 className="mt-4 text-3xl font-extrabold text-text md:text-4xl">
          Hướng dẫn mua hàng
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Mua hàng trên MMO Market chỉ với vài bước, hoàn toàn được bảo vệ bởi cơ chế
          escrow. Dưới đây là quy trình chi tiết và một số lưu ý giúp bạn giao dịch an toàn.
        </p>

        <div className="mt-8 space-y-3">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="flex gap-4 rounded-2xl border border-border bg-bg-card p-5"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-text">{s.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-text-muted">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-warning/30 bg-warning/5 p-5">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="size-5" />
            <h2 className="font-semibold">Lưu ý để mua hàng an toàn</h2>
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-text-muted">
            {tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-bg-card p-5 text-sm leading-7 text-text-muted">
          <h2 className="font-semibold text-text">Cần hỗ trợ thêm?</h2>
          <p className="mt-1">
            Tìm hiểu thêm về{" "}
            <Link href="/policy/escrow" className="text-brand hover:underline">
              cơ chế Escrow
            </Link>
            , hoặc quay lại{" "}
            <Link href="/help" className="text-brand hover:underline">
              Trung tâm hỗ trợ
            </Link>
            . Bạn cũng có thể chat trực tiếp với chúng tôi 24/7 hoặc email{" "}
            <span className="text-text">support@mmomkt.vn</span>.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
