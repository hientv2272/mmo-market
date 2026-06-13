import Link from "next/link";
import { HelpCircle, ChevronDown } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Câu hỏi thường gặp (FAQ) | MMO Market" };

const groups = [
  {
    title: "Chung",
    items: [
      {
        q: "MMO Market là gì?",
        a: "MMO Market là sàn trung gian mua bán tài khoản, phần mềm, dịch vụ và các sản phẩm số. Mọi giao dịch đều được bảo vệ bởi cơ chế escrow — tiền của buyer được giữ trung gian cho đến khi đơn hàng hoàn tất.",
      },
      {
        q: "Tôi cần đủ tuổi không để sử dụng?",
        a: "Bạn cần đủ 18 tuổi hoặc có sự đồng ý của người giám hộ hợp pháp. Mỗi cá nhân chỉ được sở hữu một tài khoản và phải cung cấp thông tin chính xác.",
      },
      {
        q: "Sản phẩm nào bị cấm giao dịch?",
        a: "Tài khoản/dữ liệu bất hợp pháp hoặc bị đánh cắp, sản phẩm vi phạm bản quyền, nội dung vi phạm pháp luật (cờ bạc, chất cấm, đồi trụy) và phần mềm chứa mã độc đều bị cấm.",
      },
    ],
  },
  {
    title: "Mua hàng & thanh toán",
    items: [
      {
        q: "Tôi đã thanh toán nhưng chưa nhận tài khoản, phải làm sao?",
        a: "Với sản phẩm auto-delivery, thông tin được giao ngay trong 5 giây tại trang đơn hàng. Với manual, seller có 24 giờ để giao. Nếu quá hạn vẫn chưa nhận, hãy mở khiếu nại — tiền của bạn vẫn được giữ trong escrow.",
      },
      {
        q: "Tài khoản bị thay mật khẩu, có được hoàn tiền không?",
        a: "Có. Nếu sản phẩm bị thu hồi/đổi mật khẩu trong cửa sổ kiểm tra 72 giờ, hãy mở khiếu nại kèm bằng chứng. Nếu buyer thắng, tiền được hoàn 100% (sàn không thu phí).",
      },
      {
        q: "Tôi có thể thanh toán bằng những hình thức nào?",
        a: "Bạn nạp tiền vào ví MMO Market qua chuyển khoản ngân hàng, ví điện tử hoặc cổng thanh toán, sau đó dùng số dư ví để thanh toán đơn hàng.",
      },
    ],
  },
  {
    title: "Escrow & khiếu nại",
    items: [
      {
        q: "Khi nào tiền được giải phóng cho seller?",
        a: "Sau 72 giờ kể từ khi giao hàng mà không có khiếu nại, hoặc khi buyer bấm xác nhận đã nhận, tiền (đã trừ phí sàn 4-6%) sẽ được giải phóng vào ví seller.",
      },
      {
        q: "Quy trình khiếu nại đơn hàng như thế nào?",
        a: "Mở khiếu nại trong cửa sổ 72 giờ kèm bằng chứng. Đội Compliance điều tra trong 48-72 giờ dựa trên log giao dịch và bằng chứng hai bên, rồi đưa ra quyết định cuối cùng. Xem chi tiết tại trang Khiếu nại đơn hàng.",
      },
      {
        q: "Escrow bảo vệ tôi như thế nào?",
        a: "Tiền của buyer được giữ trong tài khoản trung gian, seller chưa nhận được ngay. Trong 72 giờ buyer có thể kiểm tra, xác nhận hoặc khiếu nại. Điều này bảo vệ buyer khỏi rủi ro và giúp seller không bị “bùng”.",
      },
    ],
  },
  {
    title: "Bán hàng & rút tiền",
    items: [
      {
        q: "Phí sàn cho người bán là bao nhiêu?",
        a: "Phí sàn dao động 4-6% tùy loại sản phẩm, được trừ khi tiền được giải phóng cho seller. Nếu buyer thắng khiếu nại và được hoàn tiền, sàn không thu phí.",
      },
      {
        q: "Tôi cần làm gì để rút tiền?",
        a: "Bạn cần hoàn tất xác minh danh tính (KYC) trước khi rút. Sau khi tiền được giải phóng vào ví, bạn có thể rút về tài khoản ngân hàng bất kỳ lúc nào.",
      },
      {
        q: "Cách upload kho auto-delivery cho seller?",
        a: "Khi đăng sản phẩm, chọn hình thức auto-delivery và upload kho tài khoản/key theo đúng định dạng. Hệ thống sẽ tự động giao cho buyer trong 5 giây sau khi thanh toán.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <HelpCircle className="size-10 text-success" />
        <h1 className="mt-4 text-3xl font-extrabold text-text md:text-4xl">
          Câu hỏi thường gặp
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Tổng hợp câu trả lời cho những thắc mắc phổ biến nhất khi mua, bán và giao dịch
          trên MMO Market. Không tìm thấy câu trả lời? Hãy chat với chúng tôi 24/7.
        </p>

        <div className="mt-8 space-y-8">
          {groups.map((g) => (
            <div key={g.title}>
              <h2 className="text-lg font-bold text-text">{g.title}</h2>
              <div className="mt-3 space-y-2">
                {g.items.map((item) => (
                  <details
                    key={item.q}
                    className="group rounded-2xl border border-border bg-bg-card p-5 [&_summary]:list-none"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold text-text">
                      <span>{item.q}</span>
                      <ChevronDown className="size-5 shrink-0 text-text-muted transition group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 text-sm leading-7 text-text-muted">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-bg-card p-5 text-sm leading-7 text-text-muted">
          <h2 className="font-semibold text-text">Vẫn cần hỗ trợ?</h2>
          <p className="mt-1">
            Xem{" "}
            <Link href="/help/buy" className="text-brand hover:underline">
              hướng dẫn mua hàng
            </Link>
            ,{" "}
            <Link href="/help/sell" className="text-brand hover:underline">
              hướng dẫn bán hàng
            </Link>
            ,{" "}
            <Link href="/help/dispute" className="text-brand hover:underline">
              khiếu nại đơn hàng
            </Link>{" "}
            hoặc tới{" "}
            <Link href="/help" className="text-brand hover:underline">
              Trung tâm hỗ trợ
            </Link>
            . Bạn cũng có thể email{" "}
            <span className="text-text">support@mmomkt.vn</span>.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
