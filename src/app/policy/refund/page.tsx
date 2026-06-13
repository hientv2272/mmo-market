import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Chính sách hoàn tiền | MMO Market" };

export default function RefundPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <RotateCcw className="size-10 text-success" />
        <h1 className="mt-4 text-3xl font-extrabold text-text md:text-4xl">
          Chính sách hoàn tiền
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Cập nhật lần cuối: 12/06/2026. Nhờ cơ chế escrow, tiền của buyer luôn được giữ
          trung gian cho đến khi đơn hàng hoàn tất — đây là nền tảng để hoàn tiền an toàn,
          minh bạch khi sản phẩm không đúng cam kết.
        </p>

        <div className="prose prose-invert mt-8 max-w-none text-sm leading-7 text-text-muted">
          <h2 className="text-text">1. Nguyên tắc chung</h2>
          <p>
            Khi đặt hàng, tiền của buyer được giữ trong tài khoản trung gian (escrow) chứ
            chưa chuyển cho seller. Trong cửa sổ kiểm tra 72 giờ, nếu sản phẩm không đúng
            mô tả, buyer có quyền yêu cầu hoàn tiền thông qua khiếu nại.
          </p>

          <h2 className="text-text">2. Trường hợp được hoàn tiền</h2>
          <ul className="list-disc pl-5">
            <li>Sản phẩm không đúng mô tả hoặc thiếu so với cam kết của seller.</li>
            <li>Tài khoản/sản phẩm không sử dụng được, bị thu hồi hoặc đổi mật khẩu trong cửa sổ 72 giờ.</li>
            <li>Seller không giao hàng đúng hạn (manual quá 24 giờ, auto-delivery lỗi không giao được).</li>
            <li>Đơn hàng có dấu hiệu gian lận từ phía seller.</li>
          </ul>

          <h2 className="text-text">3. Trường hợp không được hoàn tiền</h2>
          <ul className="list-disc pl-5">
            <li>Buyer đã xác nhận “đã nhận” hoặc cửa sổ 72 giờ đã kết thúc mà không khiếu nại.</li>
            <li>Sản phẩm đúng mô tả nhưng buyer đổi ý, không còn nhu cầu.</li>
            <li>Lỗi phát sinh do buyer (làm mất thông tin, đổi sai cách, dùng sai mục đích).</li>
            <li>Buyer vi phạm điều khoản hoặc cố tình lạm dụng khiếu nại để chiếm đoạt sản phẩm.</li>
          </ul>

          <h2 className="text-text">4. Quy trình yêu cầu hoàn tiền</h2>
          <p>
            Mở khiếu nại trong trang đơn hàng ngay trong cửa sổ 72 giờ, mô tả vấn đề và đính
            kèm bằng chứng (ảnh/video chụp màn hình, log đăng nhập). Đội ngũ Compliance sẽ
            điều tra trong 48-72 giờ dựa trên log giao dịch và bằng chứng của cả hai bên rồi
            đưa ra quyết định cuối cùng. Xem chi tiết tại trang{" "}
            <Link href="/help/dispute" className="text-brand">
              Khiếu nại đơn hàng
            </Link>
            .
          </p>

          <h2 className="text-text">5. Mức hoàn & xử lý phí</h2>
          <p>
            Nếu buyer thắng khiếu nại, tiền được hoàn 100% và sàn không thu phí giao dịch.
            Nếu seller thắng, tiền được giải phóng bình thường (đã trừ phí sàn 4-6%). Trong
            trường hợp hai bên thỏa thuận hoàn một phần, số tiền sẽ được chia theo thỏa thuận
            được ghi nhận trên hệ thống.
          </p>

          <h2 className="text-text">6. Thời gian & hình thức hoàn</h2>
          <p>
            Sau khi có quyết định hoàn tiền, số tiền được cộng lại vào ví MMO Market của buyer,
            sẵn sàng để mua hàng tiếp hoặc rút về ngân hàng. Thời gian xử lý vào ví thường tức
            thì sau khi quyết định được ban hành; thời gian rút về ngân hàng tùy theo cổng thanh toán.
          </p>

          <h2 className="text-text">7. Minh bạch & truy vết</h2>
          <p>
            Mọi quyết định hoàn tiền đều được lưu log audit, có thể truy vết. Cả buyer và seller
            được thông báo về kết quả và lý do của quyết định.
          </p>

          <h2 className="text-text">Liên hệ</h2>
          <p>
            Mọi thắc mắc về hoàn tiền, vui lòng liên hệ bộ phận hỗ trợ qua email{" "}
            <span className="text-text">support@mmomkt.vn</span> hoặc kênh chat trực tuyến 24/7.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
