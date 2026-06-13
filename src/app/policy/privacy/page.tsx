import { Lock } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Chính sách bảo mật | MMO Market" };

export default function PrivacyPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Lock className="size-10 text-success" />
        <h1 className="mt-4 text-3xl font-extrabold text-text md:text-4xl">
          Chính sách bảo mật
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Cập nhật lần cuối: 12/06/2026. MMO Market cam kết bảo vệ dữ liệu cá nhân
          của bạn. Chính sách này giải thích chúng tôi thu thập, sử dụng, lưu trữ và
          bảo vệ thông tin của bạn như thế nào khi sử dụng dịch vụ.
        </p>

        <div className="prose prose-invert mt-8 max-w-none text-sm leading-7 text-text-muted">
          <h2 className="text-text">1. Thông tin chúng tôi thu thập</h2>
          <ul className="list-disc pl-5">
            <li>Thông tin tài khoản: tên đăng nhập, email, số điện thoại, mật khẩu (đã mã hóa).</li>
            <li>Thông tin xác minh (KYC): họ tên, giấy tờ tùy thân khi bạn rút tiền hoặc trở thành seller.</li>
            <li>Dữ liệu giao dịch: lịch sử đơn hàng, ví, thanh toán, khiếu nại.</li>
            <li>Dữ liệu kỹ thuật: địa chỉ IP, loại trình duyệt, thiết bị, cookie phiên đăng nhập.</li>
          </ul>

          <h2 className="text-text">2. Mục đích sử dụng</h2>
          <ul className="list-disc pl-5">
            <li>Vận hành tài khoản, xử lý giao dịch và áp dụng cơ chế escrow.</li>
            <li>Xác minh danh tính, phòng chống gian lận và rửa tiền.</li>
            <li>Hỗ trợ khách hàng và giải quyết tranh chấp.</li>
            <li>Gửi thông báo giao dịch, cập nhật chính sách và thông tin khuyến mãi (nếu bạn đồng ý).</li>
          </ul>

          <h2 className="text-text">3. Bảo mật dữ liệu</h2>
          <p>
            Mật khẩu được băm một chiều và không thể khôi phục. Dữ liệu nhạy cảm được mã hóa
            AES-256 khi lưu trữ. Toàn bộ truyền tải sử dụng HTTPS/TLS. Truy cập dữ liệu nội bộ
            được phân quyền chặt chẽ và ghi log audit để truy vết.
          </p>

          <h2 className="text-text">4. Chia sẻ thông tin</h2>
          <p>
            Chúng tôi không bán dữ liệu cá nhân của bạn. Thông tin chỉ được chia sẻ trong các
            trường hợp: với cổng thanh toán để xử lý giao dịch; với cơ quan chức năng khi có yêu
            cầu hợp pháp; hoặc giữa buyer và seller ở mức tối thiểu cần thiết để hoàn tất đơn hàng.
          </p>

          <h2 className="text-text">5. Cookie</h2>
          <p>
            Chúng tôi sử dụng cookie để duy trì phiên đăng nhập, ghi nhớ tùy chọn và phân tích
            lưu lượng truy cập. Bạn có thể tắt cookie trong trình duyệt, nhưng một số tính năng
            có thể không hoạt động đầy đủ.
          </p>

          <h2 className="text-text">6. Lưu trữ dữ liệu</h2>
          <p>
            Dữ liệu được lưu trữ trong suốt thời gian tài khoản của bạn còn hoạt động và một
            khoảng thời gian sau đó theo quy định pháp luật (phục vụ kiểm toán, giải quyết tranh
            chấp). Dữ liệu giao dịch có thể được giữ lâu hơn để phục vụ nghĩa vụ pháp lý.
          </p>

          <h2 className="text-text">7. Quyền của người dùng</h2>
          <ul className="list-disc pl-5">
            <li>Truy cập, chỉnh sửa thông tin cá nhân trong phần cài đặt tài khoản.</li>
            <li>Yêu cầu xóa tài khoản và dữ liệu cá nhân (trừ dữ liệu phải lưu theo luật).</li>
            <li>Rút lại sự đồng ý nhận email marketing bất kỳ lúc nào.</li>
            <li>Khiếu nại về việc xử lý dữ liệu qua bộ phận hỗ trợ.</li>
          </ul>

          <h2 className="text-text">8. Bảo vệ trẻ vị thành niên</h2>
          <p>
            Dịch vụ không dành cho người dưới 18 tuổi. Chúng tôi không cố ý thu thập dữ liệu của
            trẻ vị thành niên; nếu phát hiện, dữ liệu sẽ được xóa.
          </p>

          <h2 className="text-text">9. Thay đổi chính sách</h2>
          <p>
            Chính sách bảo mật có thể được cập nhật theo thời gian. Thay đổi quan trọng sẽ được
            thông báo qua email hoặc trên website. Việc tiếp tục sử dụng dịch vụ đồng nghĩa với
            việc bạn chấp nhận chính sách mới.
          </p>

          <h2 className="text-text">10. Liên hệ</h2>
          <p>
            Mọi thắc mắc về chính sách bảo mật hoặc yêu cầu liên quan đến dữ liệu cá nhân, vui
            lòng liên hệ bộ phận hỗ trợ qua email support@mmomarket.vn hoặc kênh hỗ trợ trực
            tuyến trên website.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
