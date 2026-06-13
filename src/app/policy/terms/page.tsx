import { FileText } from "lucide-react";
import { SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Điều khoản sử dụng | MMO Market" };

export default function TermsPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <FileText className="size-10 text-success" />
        <h1 className="mt-4 text-3xl font-extrabold text-text md:text-4xl">
          Điều khoản sử dụng
        </h1>
        <p className="mt-3 text-sm leading-7 text-text-muted">
          Cập nhật lần cuối: 12/06/2026. Bằng việc truy cập và sử dụng MMO Market,
          bạn đồng ý tuân thủ toàn bộ các điều khoản dưới đây. Vui lòng đọc kỹ trước
          khi đăng ký tài khoản hoặc thực hiện giao dịch.
        </p>

        <div className="prose prose-invert mt-8 max-w-none text-sm leading-7 text-text-muted">
          <h2 className="text-text">1. Định nghĩa</h2>
          <p>
            &ldquo;Sàn&rdquo; là nền tảng MMO Market. &ldquo;Buyer&rdquo; là người mua,
            &ldquo;Seller&rdquo; là người bán. &ldquo;Sản phẩm&rdquo; bao gồm tài khoản,
            phần mềm, dịch vụ và các sản phẩm số khác được giao dịch trên sàn.
            &ldquo;Người dùng&rdquo; là bất kỳ cá nhân/tổ chức nào sử dụng dịch vụ.
          </p>

          <h2 className="text-text">2. Tài khoản người dùng</h2>
          <ul className="list-disc pl-5">
            <li>Người dùng phải đủ 18 tuổi hoặc có sự đồng ý của người giám hộ hợp pháp.</li>
            <li>Mỗi cá nhân chỉ được sở hữu một tài khoản, cung cấp thông tin chính xác.</li>
            <li>Người dùng chịu trách nhiệm bảo mật mật khẩu và mọi hoạt động dưới tài khoản của mình.</li>
            <li>Sàn có quyền yêu cầu xác minh danh tính (KYC) trước khi cho phép rút tiền.</li>
          </ul>

          <h2 className="text-text">3. Quy định giao dịch</h2>
          <p>
            Toàn bộ giao dịch áp dụng cơ chế escrow — tiền của buyer được giữ trung gian
            cho đến khi đơn hàng hoàn tất. Người dùng đồng ý không thực hiện giao dịch
            ngoài sàn để né phí; mọi giao dịch ngoài sàn sẽ không được bảo vệ và có thể
            dẫn đến khóa tài khoản. Phí sàn dao động 4-6% tùy loại sản phẩm.
          </p>

          <h2 className="text-text">4. Sản phẩm bị cấm</h2>
          <ul className="list-disc pl-5">
            <li>Tài khoản/dữ liệu có nguồn gốc bất hợp pháp, bị hack hoặc đánh cắp.</li>
            <li>Sản phẩm vi phạm bản quyền, sở hữu trí tuệ của bên thứ ba.</li>
            <li>Nội dung vi phạm pháp luật Việt Nam: cờ bạc, chất cấm, vũ khí, nội dung đồi trụy.</li>
            <li>Phần mềm chứa mã độc, công cụ lừa đảo hoặc xâm phạm dữ liệu người khác.</li>
          </ul>

          <h2 className="text-text">5. Trách nhiệm của Seller</h2>
          <p>
            Seller cam kết mô tả sản phẩm trung thực, giao hàng đúng thời hạn (auto-delivery
            trong 5 giây hoặc manual trong 24 giờ) và hỗ trợ bảo hành theo cam kết. Seller
            chịu hoàn toàn trách nhiệm về tính hợp pháp và chất lượng của sản phẩm đăng bán.
          </p>

          <h2 className="text-text">6. Trách nhiệm của Buyer</h2>
          <p>
            Buyer có 72 giờ kể từ khi nhận hàng để kiểm tra và khiếu nại nếu sản phẩm không
            đúng mô tả. Buyer cam kết không lạm dụng cơ chế khiếu nại để chiếm đoạt sản phẩm,
            và thanh toán đầy đủ cho các đơn hàng đã đặt.
          </p>

          <h2 className="text-text">7. Giải quyết tranh chấp</h2>
          <p>
            Khi phát sinh khiếu nại, đội ngũ Compliance sẽ điều tra trong 48-72 giờ dựa trên
            log giao dịch, bằng chứng giao hàng và lịch sử của hai bên. Quyết định của sàn là
            quyết định cuối cùng. Mọi quyết định đều được lưu log audit để truy vết.
          </p>

          <h2 className="text-text">8. Xử lý vi phạm</h2>
          <p>
            Tùy mức độ, sàn có thể cảnh báo, tạm khóa, khóa vĩnh viễn tài khoản hoặc tịch thu
            số dư có liên quan đến hành vi gian lận. Các hành vi vi phạm pháp luật có thể bị
            báo cáo cho cơ quan chức năng.
          </p>

          <h2 className="text-text">9. Giới hạn trách nhiệm</h2>
          <p>
            MMO Market là nền tảng trung gian kết nối buyer và seller. Sàn không phải chủ sở
            hữu của sản phẩm và không bảo đảm tuyệt đối về việc sản phẩm phù hợp với mọi mục
            đích sử dụng. Sàn không chịu trách nhiệm cho thiệt hại gián tiếp phát sinh ngoài
            phạm vi cơ chế bảo vệ escrow.
          </p>

          <h2 className="text-text">10. Thay đổi điều khoản</h2>
          <p>
            Sàn có quyền cập nhật điều khoản bất kỳ lúc nào. Thay đổi quan trọng sẽ được thông
            báo qua email hoặc trên website. Việc tiếp tục sử dụng dịch vụ sau khi điều khoản
            thay đổi đồng nghĩa với việc bạn chấp nhận điều khoản mới.
          </p>

          <h2 className="text-text">11. Liên hệ</h2>
          <p>
            Mọi thắc mắc về điều khoản sử dụng, vui lòng liên hệ bộ phận hỗ trợ qua email
            support@mmomarket.vn hoặc kênh hỗ trợ trực tuyến trên website.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
