import Link from "next/link";
import { Scale, FileWarning, Send, Search, Gavel, Clock, AlertTriangle } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Khiếu nại đơn hàng | MMO Market" };

const steps = [
  {
    icon: FileWarning,
    title: "1. Khi nào nên khiếu nại",
    body: "Mở khiếu nại khi sản phẩm không đúng mô tả, không sử dụng được, bị thu hồi/đổi mật khẩu, hoặc seller giao thiếu/sai. Hãy thử liên hệ seller trước — nhiều vấn đề được giải quyết nhanh mà không cần khiếu nại.",
  },
  {
    icon: Clock,
    title: "2. Khiếu nại trong cửa sổ 72 giờ",
    body: "Bạn có 72 giờ kể từ khi nhận hàng để mở khiếu nại. Trong thời gian này tiền vẫn được giữ trong escrow. Sau 72 giờ không khiếu nại, tiền sẽ tự động giải phóng cho seller nên hãy kiểm tra sớm.",
  },
  {
    icon: Send,
    title: "3. Gửi khiếu nại & bằng chứng",
    body: "Vào trang đơn hàng, bấm “Khiếu nại”, mô tả vấn đề rõ ràng và đính kèm bằng chứng: ảnh chụp màn hình, video, log đăng nhập... Bằng chứng càng chi tiết, việc xử lý càng nhanh và chính xác.",
  },
  {
    icon: Search,
    title: "4. Đội Compliance điều tra",
    body: "Đội ngũ Compliance sẽ điều tra trong 48-72 giờ dựa trên log giao dịch, bằng chứng giao hàng và lịch sử của cả hai bên. Cả buyer và seller có thể được yêu cầu bổ sung thông tin trong quá trình này.",
  },
  {
    icon: Gavel,
    title: "5. Quyết định & xử lý",
    body: "Nếu buyer thắng, tiền được hoàn 100% (sàn không thu phí). Nếu seller thắng, tiền được giải phóng bình thường. Quyết định của sàn là cuối cùng và mọi bước đều được lưu log audit để truy vết.",
  },
];

const tips = [
  "Thu thập bằng chứng ngay khi phát hiện vấn đề — ảnh/video chụp màn hình rõ thời gian, tình trạng sản phẩm.",
  "Đừng thay đổi sản phẩm (đổi mật khẩu, thông tin) trước khi chụp bằng chứng nếu nó liên quan đến lỗi.",
  "Trình bày trung thực và đầy đủ — khai báo gian dối có thể khiến bạn thua khiếu nại và bị xử lý.",
  "Phản hồi nhanh khi Compliance yêu cầu bổ sung thông tin để tránh kéo dài thời gian xử lý.",
  "Không lạm dụng khiếu nại để chiếm đoạt sản phẩm — hành vi này sẽ bị ghi nhận và xử lý tài khoản.",
];

export default function DisputeGuidePage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Scale className="size-10 text-success" />
        <h1 className="mt-4 text-3xl font-extrabold text-text md:text-4xl">
          Khiếu nại đơn hàng
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Cơ chế khiếu nại giúp bảo vệ buyer khi sản phẩm không đúng cam kết, đồng thời
          đảm bảo công bằng cho seller. Dưới đây là quy trình khiếu nại và các lưu ý để
          được xử lý nhanh, chính xác.
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
            <h2 className="font-semibold">Lưu ý khi khiếu nại</h2>
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
