# QUY TRÌNH TEST END-TO-END — SÀN MMO

> Kịch bản kiểm thử thủ công đầy đủ cho toàn bộ tính năng đã triển khai (P0–P2 + production hardening + monetization).
> Mỗi bước có **Hành động** → **Kết quả mong đợi (PASS)**. Đánh dấu ✅/❌ khi chạy.

---

## 0. Chuẩn bị môi trường

### 0.1 Khởi động
```powershell
# Backend (API + SQLite + tự seed) — http://localhost:5199, Swagger: /swagger
dotnet run --project backend/src/MmoMarket.Api

# Frontend (Next.js) — http://localhost:3000 ; đã trỏ API qua .env.local (NEXT_PUBLIC_API_URL=http://localhost:5199)
npm run dev
```
- DB SQLite ở `C:\tmp\mmo-market.db`. **Reset sạch:** dừng API → xóa file → chạy lại (seeder tạo lại + nâng cấp schema tự động qua `UpgradeSchemaAsync`).

### 0.2 Tài khoản seed
| Vai trò | Email | Mật khẩu | Ghi chú |
|---|---|---|---|
| Admin | admin@mmo.local | Admin@123 | |
| Buyer | buyer@mmo.local | Buyer@123 | ví 5.000.000đ |
| Seller | kimchi@mmo.local | Seller@123 | ví 3.000.000đ, TrustScore 98 |
| Seller | vyhan@mmo.local | Seller@123 | ví 3.000.000đ |
| Seller | quynhnhu@mmo.local | Seller@123 | ví 3.000.000đ |

### 0.3 Mẹo rút ngắn thời gian chờ (test timeout)
Worker `OrderEscrowWorker` quét **mỗi 60s**. Cấu hình thời hạn đọc từ bảng `SiteConfigs`. Đổi bằng SQLite (vd `sqlite3 C:\tmp\mmo-market.db` hoặc DB Browser), **trước khi** thực hiện hành động liên quan:
```sql
-- Test auto-release: cho đơn ở Checking giải ngân ngay vòng quét kế tiếp
UPDATE SiteConfigs SET Value='0' WHERE Key='escrow_release_days';
-- Test auto-cancel: cho đơn manual chưa giao bị hủy ngay
UPDATE SiteConfigs SET Value='0' WHERE Key='deliver_window_hours';
```
> Nhớ trả về `2` sau khi test xong để các phần khác hoạt động bình thường.

---

## 1. Smoke test
1. `GET http://localhost:5199/health` → `{ status: "ok" }`. ✅
2. Mở http://localhost:3000 → trang chủ hiển thị, danh mục/sản phẩm load. ✅
3. Đăng nhập từng vai trò (admin/buyer/seller) → vào đúng dashboard. ✅
4. Gọi 1 API bất kỳ >100 lần/phút từ cùng IP → nhận **429 Too Many Requests** (rate limit #5). ✅

---

## 2. Luồng cốt lõi — ESCROW (mua hàng → giải ngân)
*Dùng thanh toán **Ví nội bộ** cho nhanh (tức thì). Cổng ngoài (VietQR/MoMo) cần webhook/sandbox.*

### 2.1 Seller đăng sản phẩm (kèm cọc đăng tin — P1.4)
1. Đăng nhập **kimchi** → Seller → Sản phẩm → Thêm sản phẩm (danh mục `game`, giá vd 600.000đ, Delivery **Manual**, kho/stock>0). 
   → **PASS:** tạo thành công, trạng thái **Chờ duyệt (Pending)**; ví seller bị trừ **cọc 5%** (clamp 10k–500k) → dòng "🔒 Cọc ..." trên sản phẩm; ví Wallet có giao dịch "Cọc đăng tin". ✅
2. Đăng nhập **admin** → Sản phẩm → **Duyệt** sản phẩm vừa tạo → trạng thái **Active**. ✅
3. (kimchi) Vào kho auto-deliv của 1 sản phẩm Auto → **Upload** vài dòng tài khoản.
   → **PASS:** lưu thành công; xem lại thấy **đã che (mask)**. Kiểm tra DB bảng `InventoryItems.EncryptedPayload` có tiền tố `enc:` (đã **mã hóa AES-256** at rest, #6). ✅

### 2.2 Buyer mua (escrow lock)
4. Đăng nhập **buyer** → mở sản phẩm Manual của kimchi → thêm giỏ → thanh toán bằng **Ví**.
   → **PASS:** đơn tạo, trạng thái **EscrowLocked → Delivering** (manual); ví buyer trừ tiền; "held balance" tăng; ví có giao dịch "Thanh toán đơn". ✅
5. (buyer) Account → Đơn hàng: đơn hiển thị **"Đang bàn giao"**; có hạn giao (DeliverDueAt). ✅

### 2.3 Seller bàn giao → Buyer kiểm tra → Hoàn tất
6. (kimchi) Seller → Đơn hàng → đơn ở "Chờ giao/Đang bàn giao" → **Giao** (nhập thông tin bàn giao).
   → **PASS:** đơn chuyển **Checking (Đang kiểm tra)**, set `EscrowReleaseAt` (+2 ngày), cọc đăng tin **không bị tịch thu**. ✅
7. (buyer) Đơn hàng → đơn "Đang kiểm tra" → **Xác nhận đã nhận**.
   → **PASS:** đơn **Completed**; TrustScore seller **+1**; doanh thu seller = giá − phí (theo danh mục game ≥500k = 6%); ví seller khả dụng tăng phần net. ✅
8. (buyer) Viết **đánh giá 5★** cho sản phẩm.
   → **PASS:** TrustScore seller **+1** nữa (tổng +2 cho hoàn tất+5★); rating/ReviewCount cập nhật. ✅

### 2.4 Kiểm tra phí theo danh mục (P1.1)
9. (admin) Phí sàn & Loyalty → tab **Phí danh mục** → thấy `game` có **2 mức** (<500k: 9%, ≥500k: 6%). Sửa thử 1 mức → lưu → mua đơn mới và xác nhận phí áp đúng theo giá/danh mục. ✅

---

## 3. Nhánh timeout (background worker — P0.1)
### 3.1 Auto-release (T+escrow)
1. Tạo + thanh toán 1 đơn, seller giao → đơn ở **Checking**.
2. Set `escrow_release_days=0` (mục 0.3) → chờ ≤60s.
   → **PASS:** đơn tự chuyển **Completed**, TrustScore seller +1, AuditLog có `escrow_auto_release`. ✅

### 3.2 Auto-cancel (seller trễ giao)
3. Set `deliver_window_hours=0` → buyer mua 1 sản phẩm **Manual** (đơn vào Delivering, DeliverDueAt≈now) → **KHÔNG** giao → chờ ≤60s.
   → **PASS:** đơn **Cancelled**, buyer được **hoàn 100%** vào ví, **cọc đăng tin bị tịch thu** (Forfeited), TrustScore seller **−5**, AuditLog `auto_cancel_refund` + `listing_deposit_forfeit`. ✅

---

## 4. Tranh chấp (Dispute — P0/P2)
1. (buyer) Với đơn ở Checking/Delivering → **Mở khiếu nại** (tiêu đề + nội dung).
   → **PASS:** tạo dispute, đơn chuyển **Disputed**, `EscrowReleaseAt` bị clear (không auto-release). ✅
2. (admin) Tranh chấp → mở dispute → thêm tin nhắn → trạng thái **Investigating**. ✅
3. Thử 3 kết quả (mỗi cái 1 đơn dispute riêng):
   - **refund_buyer:** hoàn 100% cho buyer, đơn **Refunded**, TrustScore seller **−10**. ✅
   - **release_seller:** đơn **Completed** (giải ngân seller). ✅
   - **partial_refund với %:** nhập vd **40%** → buyer hoàn 40% × Total, đơn **Completed**; AuditLog ghi đúng %. ✅
4. **Chống lạm dụng (P2.3):** buyer mở >3 tranh chấp/30 ngày → bị chặn với thông báo. ✅

---

## 5. Gói thành viên & Boost (P1.2 + Boost)
### 5.1 Mua gói (P1.2)
1. (kimchi) Seller → **Gói thành viên** → mua **Pro** (299k).
   → **PASS:** trừ ví 299k, gói hiệu lực 30 ngày; phí giao dịch sau đó **giảm theo gói** (Pro −40% phí danh mục); hạn mức tin tăng. ✅
2. (admin) **Gói Seller** (admin CRUD) → sửa giá/giảm phí/giới hạn tin của 1 gói → lưu → seller thấy thay đổi (không cần deploy). ✅
3. Giới hạn tin: với seller gói Free (10 tin), đăng vượt 10 tin → bị chặn "nâng cấp gói". ✅

### 5.2 Boost (free quota + trả phí)
4. (kimchi) Sản phẩm Active → nút **🚀 Boost** (còn quota) → boost.
   → **PASS:** sản phẩm "Đang Top"; ngoài marketplace tin này **lên đầu danh mục** + badge **Top**; banner "lượt boost còn lại" giảm 1. ✅
5. Dùng hết quota → boost tiếp → xác nhận **boost trả phí** (vd 20k) → trừ ví, vẫn boost được (BoostLog.Paid=true, không trừ vào quota). ✅

### 5.3 Badge Uy tín (#13a)
6. (seller đủ ≥50 đánh giá & ≥4.5★) → Gói thành viên → **Mua badge Uy tín** (200k/năm) → trừ ví, badge hiệu lực 1 năm. Seller chưa đủ điều kiện → bị chặn với thông báo. ✅

---

## 6. Affiliate (#12)
1. (buyer/khách mới) Đăng ký tài khoản **C** kèm **referral code** của buyer (lấy ở trang affiliate/tài khoản người giới thiệu).
2. Tài khoản C nạp ví → mua hàng → **hoàn tất giao dịch đầu tiên**.
   → **PASS:** người giới thiệu nhận **hoa hồng = 30% phí giao dịch** vào ví (WalletTxn "Hoa hồng giới thiệu"); chỉ thưởng **1 lần** (giao dịch thứ 2 của C không thưởng nữa). AuditLog `affiliate_commission`. ✅

---

## 7. Anti-fraud & giới hạn (P1.3)
1. (user chưa KYC) nạp > **2.000.000đ/ngày** → bị chặn (giới hạn nạp theo cấp). ✅
2. KYC: (seller mới) Onboarding → nộp KYC kèm **ảnh CCCD 2 mặt** (#P2.2) → admin → Người bán → thấy **thumbnail ảnh** → Duyệt/Từ chối. ✅
3. Rút tiền vượt hạn mức theo cấp → bị chặn. ✅

---

## 8. Admin & báo cáo
1. **Duyệt/Từ chối/Ban sản phẩm:** ban 1 sản phẩm → trạng thái **Banned**, TrustScore seller **−15**, AuditLog `product_ban`. ✅
2. **Banner CPM/CPC (#13b):** Banner & Flash sale → tạo/sửa banner, chọn **CPM/CPC + đơn giá** → gọi `POST /api/banners/{id}/view` và `/click` vài lần (Swagger) → list admin hiển thị **lượt hiển thị/click + chi phí ước tính**. ✅
3. **Đối soát dòng tiền (P2.5):** Tài chính → panel "Đối soát" hiển thị: ví Platform (phí thực thu), Escrow đang giữ, Reserve đã hoàn, cọc đang khóa/tịch thu, tổng nạp/rút, tổng số dư ví. ✅
4. **Audit log (P0.3):** kiểm tra bảng `AuditLogs` ghi mọi thao tác tài chính; thử UPDATE/DELETE 1 dòng qua EF → bị chặn (bất biến). ✅

---

## 9. Production hardening (#4–7)
1. **Rate limit (#5):** spam >100 req/phút/IP → 429. ✅
2. **Mã hóa AES (#6):** `InventoryItems.EncryptedPayload` có tiền tố `enc:`; seller xem kho vẫn đọc đúng (decrypt). ✅
3. **Email (#4):** mặc định `Email:Enabled=false` → log dòng `[Email:noop] To=... Subject=...` trong console API mỗi khi có notification. Bật SMTP thật (appsettings) để gửi email thực. ✅
4. **Realtime SignalR (#7):** mở 2 tab buyer; tạo sự kiện sinh thông báo cho buyer → **badge chuông tăng ngay** không cần refresh (kết nối `/hubs/notifications`). ✅

---

## 10. Checklist tổng hợp
| Nhóm | Hạng mục | Kết quả |
|---|---|---|
| P0 | Escrow lock/giao/kiểm tra/hoàn tất | ☐ |
| P0 | Auto-release + auto-cancel (worker) | ☐ |
| P0 | Audit log bất biến + PaymentTransaction | ☐ |
| P1 | Phí theo danh mục + ngưỡng giá | ☐ |
| P1 | Gói Seller (mua/giảm phí/giới hạn tin) | ☐ |
| P1 | Giới hạn nạp/rút theo KYC | ☐ |
| P1 | Cọc đăng tin (khóa/hoàn/tịch thu) | ☐ |
| P2 | Trust Score (±điểm + xếp hạng) | ☐ |
| P2 | Dispute (3 kết quả + %) + chống lạm dụng | ☐ |
| P2 | Ban sản phẩm | ☐ |
| P2 | Ảnh CCCD KYC + đối soát | ☐ |
| Hardening | Rate limit / AES / Email / SignalR | ☐ |
| Monetization | Boost trả phí / Affiliate / Badge / Banner CPM-CPC | ☐ |

> Gợi ý thứ tự chạy nhanh nhất: **0 → 1 → 2 (cốt lõi) → 5 → 4 → 3 (timeout) → 6/7/8/9**. Reset DB giữa các vòng nếu cần dữ liệu sạch.
