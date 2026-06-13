import Link from "next/link";
import { Users, UserCheck, Store, Upload, Truck, Wallet, AlertTriangle } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Hướng dẫn bán hàng | MMO Market" };

const steps = [
  {
    icon: UserCheck,
    title: "1. Đăng ký & xác minh (KYC)",
    body: "Đăng ký tài khoản seller và hoàn tất xác minh danh tính (KYC): họ tên, giấy tờ tùy thân. KYC là bắt buộc để rút tiền và giúp tăng uy tín — seller có badge xác minh được buyer tin tưởng hơn nhiều.",
  },
  {
    icon: Store,
    title: "2. Đăng sản phẩm",
    body: "Tạo tin bán với tiêu đề rõ ràng, mô tả trung thực, ảnh đại diện và giá hợp lý. Mô tả càng chi tiết, chính xác thì tỉ lệ chốt đơn càng cao và rủi ro khiếu nại càng thấp.",
  },
  {
    icon: Upload,
    title: "3. Cấu hình giao hàng",
    body: "Chọn hình thức giao: auto-delivery (upload kho tài khoản/key để hệ thống giao tự động trong 5 giây) hoặc manual (bạn tự giao trong vòng 24 giờ). Sản phẩm hybrid kết hợp cả hai cũng được hỗ trợ.",
  },
  {
    icon: Truck,
    title: "4. Xử lý đơn hàng",
    body: "Khi có đơn, tiền của buyer được giữ trong escrow. Với auto-delivery, hệ thống giao ngay. Với manual, hãy giao đúng hạn 24 giờ và hỗ trợ buyer trong cửa sổ kiểm tra 72 giờ để tránh khiếu nại.",
  },
  {
    icon: Wallet,
    title: "5. Nhận & rút tiền",
    body: "Sau 72 giờ không khiếu nại hoặc khi buyer xác nhận đã nhận, tiền (đã trừ phí sàn 4-6%) được giải phóng vào ví của bạn. Bạn có thể rút về ngân hàng bất kỳ lúc nào sau khi đã hoàn tất KYC.",
  },
];

const tips = [
  "Mô tả trung thực — phóng đại sản phẩm là nguyên nhân khiếu nại số một và làm giảm uy tín lâu dài.",
  "Giao hàng đúng hạn: auto-delivery tức thì, manual trong 24 giờ. Trễ hẹn có thể bị hủy đơn và đánh giá xấu.",
  "Giữ kho auto-delivery luôn đủ hàng và đúng định dạng để tránh giao nhầm/giao thiếu.",
  "Phản hồi buyer nhanh trong cửa sổ 72 giờ — nhiều khiếu nại được giải quyết chỉ bằng cách hỗ trợ kịp thời.",
  "Không giao dịch ngoài sàn để né phí: giao dịch ngoài sàn không được bảo vệ và có thể dẫn đến khóa tài khoản.",
];

export default function SellGuidePage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Users className="size-10 text-success" />
        <h1 className="mt-4 text-3xl font-extrabold text-text md:text-4xl">
          Hướng dẫn bán hàng
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Bắt đầu kinh doanh trên MMO Market chỉ với vài bước. Cơ chế escrow bảo vệ cả
          hai phía, giúp bạn bán hàng an tâm. Dưới đây là quy trình và các lưu ý để bán
          hiệu quả, ít khiếu nại.
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
            <h2 className="font-semibold">Lưu ý để bán hàng hiệu quả</h2>
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
            , xem{" "}
            <Link href="/help/buy" className="text-brand hover:underline">
              hướng dẫn mua hàng
            </Link>{" "}
            hoặc quay lại{" "}
            <Link href="/help" className="text-brand hover:underline">
              Trung tâm hỗ trợ
            </Link>
            . Bạn cũng có thể chat trực tiếp 24/7 hoặc email{" "}
            <span className="text-text">support@mmomkt.vn</span>.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
