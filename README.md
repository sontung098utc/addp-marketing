# ADDP Marketing & Commerce Intelligence Platform
> **Nền tảng Quản trị & Phân tích Tăng trưởng Doanh thu, Chi phí Quảng cáo & Hiệu quả Bán hàng Đa kênh (TikTok Shop & TikTok Ads GMV Max)**  
> **Phiên bản:** `2.1.0-p0-webhook-dbfirst` | **Môi trường triển khai:** `marketing.addp.vn`  
> **Chính sách dữ liệu:** **100% Data Thật - Zero Mock / Zero Synthetic Metrics - ROI Mục tiêu chuẩn 15.0x**

---

## 📌 MỤC LỤC
1. [Giới thiệu & Triết lý Dự án](#1-giới-thiệu--triết-lý-dự-án)
2. [Kiến trúc Kỹ thuật & Công nghệ](#2-kiến-trúc-kỹ-thuật--công-nghệ)
3. [Báo cáo Chi tiết: Những việc ĐÃ LÀM ĐƯỢC](#3-những-việc-đã-làm-được)
4. [Báo cáo Chi tiết: Những VẤN ĐỀ HIỆN TẠI & Rào cản kỹ thuật](#4-những-vấn-đề-hiện-tại--rào-cản-kỹ-thuật)
5. [Báo cáo Chi tiết: Những việc CHƯA LÀM ĐƯỢC](#5-những-việc-chưa-làm-được)
6. [Hướng dẫn Cài đặt, Cấu hình & Vận hành](#6-hướng-dẫn-cài-đặt-cấu-hình--vận-hành)
7. [Hướng dẫn Cấu hình Quyền hạn TikTok Partner Center](#7-hướng-dẫn-cấu-hình-quyền-hạn-tiktok-partner-center)
8. [Ma trận Kiểm thử & Kiểm soát Chất lượng (QA)](#8-ma-trận-kiểm-thử--kiểm-soát-chất-lượng-qa)

---

## 1. GIỚI THIỆU & TRIẾT LÝ DỰ ÁN

Phần mềm **ADDP Commerce Intelligence** được xây dựng nhằm giải quyết bài toán cốt lõi của nhà bán hàng trên TikTok Shop và TikTok Ads: **đối soát tài chính minh bạch, loại bỏ số liệu ảo và đo lường chính xác hiệu quả từng đồng ngân sách quảng cáo**.

### 3 Nguyên tắc Bất khả xâm phạm:
1. **Dữ liệu thật 100% (Absolute Truth & Data Integrity):** Tuyệt đối không sinh dữ liệu giả lập (mock data), không ước tính tỷ lệ tùy tiện (hoa hồng cố định 10%, tỷ lệ hủy giả lập `crc32`, đơn hàng ảo 350.000đ). Mọi chỉ số đều bắt nguồn từ Webhook và REST API chính thức của TikTok.
2. **Khóa chặt ROI Mục tiêu ở mức 15.0x:** Hệ thống định chuẩn cố định `Target ROI = 15.0x`. Mọi phân tích, đánh giá hiệu quả video/chiến dịch và đề xuất tối ưu hóa (Scale/Optimize/Pause) đều đối chiếu trực tiếp với mốc chuẩn này.
3. **Database-First Reporting:** Báo cáo thời gian thực ưu tiên đọc từ cơ sở dữ liệu đã chuẩn hóa (MariaDB) với độ trễ < 20ms, loại bỏ cơ chế `LIVE_FALLBACK` chậm chạp và không phụ thuộc vào việc gọi API trực tiếp mỗi khi người dùng đổi bộ lọc ngày.

---

## 2. KIẾN TRÚC KỸ THUẬT & CÔNG NGHỆ

```
┌────────────────────────────────────────────────────────────────────────┐
│                          GIAO DIỆN NGƯỜI DÙNG                          │
│               React 19 + Vite + Tailwind CSS + Lucide Icons            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (REST API JSON / HTTP)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       BACKEND API & SERVICES (PHP 8.2)                 │
│  ├─ commerce_dashboard.php            : API Gateway & Controller        │
│  ├─ commerce_ads_service.php          : Bộ não Phân tích Ads & AI Video │
│  ├─ commerce_analytics_service.php    : Dịch vụ TikTok Shop Analytics   │
│  ├─ commerce_sync_orchestrator.php    : Điều phối viên Đồng bộ Dữ liệu  │
│  ├─ commerce_loss_engine.php          : Sổ cái Đối soát Đơn Hủy / Lỗ    │
│  ├─ commerce_product_cost_service.php : Quản trị Giá vốn SPU/SKU & BE ROI│
│  ├─ tiktok_client.php                 : TikTok Open API Client v2       │
│  └─ tiktok_webhook.php                : Webhook Ingestion Engine        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (PDO Prepared Statements)
┌───────────────────────────────────▼────────────────────────────────────┐
│                    DATABASE CSDL QUAN HỆ (MariaDB 10.6+)               │
│  ├─ commerce_orders & order_items     : Sổ cái đơn hàng chuẩn hóa       │
│  ├─ commerce_video_analytics          : Phân tích video ngắn (Media CDN)│
│  ├─ commerce_affiliate_orders         : Đơn tiếp thị liên kết thật      │
│  ├─ commerce_product_costs            : Giá vốn, phí sàn, Break-even ROI│
│  ├─ commerce_loss_ledger              : Sổ cái ghi nhận tổn thất & RMA  │
│  ├─ commerce_webhook_events           : Hộp thư sự kiện chống trùng lặp │
│  └─ commerce_sync_runs & jobs         : Nhật ký & Checkpoint đồng bộ    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. NHỮNG VIỆC ĐÃ LÀM ĐƯỢC

### 3.1. Phân Tích & Báo Cáo Video Quảng Cáo & Video Ngắn (Tab Video Intelligence)
- [x] **Hiển thị đầy đủ Media thực tế:** Tích hợp ảnh bìa video (`cover_url`), tiêu đề video, tên creator/kênh đăng từ CDN chính thức của TikTok.
- [x] **Nút xem video trực tiếp:** Nút `Xem video` trên từng hàng và `Xem trên TikTok` trong modal, mở trực tiếp video trên ứng dụng/web TikTok trong tab mới.
- [x] **Bộ lọc nguồn dữ liệu (Source Tabs):**
  - `Tất cả`: Xem bức tranh toàn cảnh cả chiến dịch và video.
  - `🎬 Video Ngắn TikTok Shop`: Xem video ngắn organic/affiliate với số liệu lượt xem, CTR, GPM, doanh thu, đơn hàng, lượt thích, bình luận, chia sẻ.
  - `📢 Chiến Dịch GMV Max`: Xem chiến dịch quảng cáo với ngân sách chi tiêu, CPA và ROI Ads.
- [x] **Modal Chi tiết Video & Phân tích AI:**
  - Nhấp vào từng video/chiến dịch mới mở modal phân tích chi tiết.
  - Phân tích điểm mạnh, điểm nghẽn (Hook, CTR, Conversion).
  - Phân loại trạng thái: *Video Đang Hiệu Quả* (ROI $\ge$ 15x), *Video Đang Chưa Hiệu Quả* (ROI < 15x), *Video Không Còn Phân Phối*.
  - Khuyến nghị tối ưu bằng AI: Nâng ngân sách 15–25%/ngày, cải thiện 3 giây đầu (Hook), thay đổi góc quay, đổi thumbnail hoặc rà soát giá bán để giảm tỷ lệ hủy.
- [x] **Bảng "Phương án đề xuất cho Quảng cáo" ở cuối trang:**
  - Tổng hợp nhóm video cần vít ngân sách, nhóm cần chỉnh sửa creative/nội dung, nhóm cần cắt lỗ/tạm dừng.
- [x] **Loại bỏ 100% Mock Data trong Video:**
  - Xóa bỏ dữ liệu video mukbang giả lập và công thức tính nhảm (`calcSpend / 80`, `crc32 % 30`).
  - Đối với các chỉ số không được TikTok Shop API cung cấp (như tỷ lệ giữ chân 2s/6s của video organic), hệ thống hiển thị rõ ràng ký hiệu `—` kèm chú thích minh bạch, tuyệt đối không bịa số.
- [x] **Auto-probe resilient phiên bản API TikTok Video:**
  - Tự động dò và tương thích các phiên bản API TikTok Shop (`202605`, `202509`, `202409`, `202406`, `202309`), khắc phục triệt để lỗi mã `36009004: Invalid API version`.
  - Tự động mở rộng cửa sổ ngày (30 ngày gần nhất) khi đồng bộ, ngăn ngừa lỗi đảo ngày khi chọn xem "Hôm nay".

### 3.2. Chuẩn Hóa Dữ Liệu Affiliate & Loại Bỏ Tỷ Lệ Ảo (P0-01)
- [x] Tích hợp API chính thức: `/affiliate_seller/202410/orders/search`.
- [x] Loại bỏ toàn bộ tỷ lệ hoa hồng cố định (10%, 9%, 1%) và tỷ lệ chia sẻ tùy tiện (70/30).
- [x] Báo cáo Affiliate tính toán 100% từ bảng `commerce_affiliate_orders` trong cơ sở dữ liệu.
- [x] Xóa modal upload file Excel/CSV theo chính sách bảo mật API-Only.

### 3.3. Tách Bạch Chỉ Số LIVE GMV Max (P0-03)
- [x] Phân định rõ ràng giữa **Ads ROAS** (chỉ tính chi phí & doanh thu từ chiến dịch Ads LIVE GMV Max) và **Blended LIVE ROAS** (toàn bộ doanh thu phòng live / chi phí Ads).
- [x] Bổ sung nhãn xuất xứ nguồn dữ liệu (`source_attribution`) và dấu thời gian tươi mới (`data_freshness`).

### 3.4. Điểm Hòa Vốn & Giá Vốn Từng Sản Phẩm (Product-specific Break-even ROI - P0-04)
- [x] Quản trị chi phí sản phẩm theo từng mã SPU / SKU trong bảng `commerce_product_costs`.
- [x] Tính toán chuẩn xác Contribution Margin và Điểm hòa vốn:
  $$\text{Break-even ROAS} = \frac{\text{Giá bán}}{\text{Lợi nhuận gộp biên}}$$
- [x] Loại bỏ 100% giá trị mặc định 2.5 ảo. Khi thiếu dữ liệu giá vốn hoặc margin âm, hệ thống trả về `INSUFFICIENT_DATA` hoặc `NEGATIVE_MARGIN`, không tính toán sai lệch.
- [x] Giao diện cho phép nhập và cập nhật giá vốn, chi phí đóng gói, thuế sàn ngay trên web.

### 3.5. Webhook Ingestion Engine & Sổ Cái Hủy Đơn / Lỗ (P0-W2)
- [x] Xác thực chữ ký HMAC-SHA256 (chuẩn V1 và V2 digest).
- [x] Chống tấn công lặp lại (Replay Attack) với ngưỡng thời gian $|t - \text{now}| \le 300\text{s}$.
- [x] Hộp thư sự kiện `commerce_webhook_events` đảm bảo tính Idempotent, chống xử lý trùng lặp và phản hồi Fast ACK HTTP 200.
- [x] Ma trận thứ bậc trạng thái đơn hàng: Trạng thái tận cùng `CANCELLED` và `REFUND_SUCCESS` không thể bị đảo ngược bởi sự kiện đến trễ.
- [x] Tự động cập nhật sổ cái tổn thất `commerce_loss_ledger` khi có đơn hủy hoặc hoàn hàng.

### 3.6. Background Reconciliation Engine & CLI Worker (P0-W3)
- [x] Cơ chế khóa MySQL `GET_LOCK` chống xung đột khi có nhiều tiến trình đồng bộ đồng thời cho cùng một shop.
- [x] Hỗ trợ cơ chế micro-batching qua HTTP (< 2s/tick) với thanh tiến độ tăng dần mượt mà.
- [x] Script CLI `tools/sync_worker_cli.php` chạy ngầm độc lập phục vụ Cron job, tự động thu hồi tác vụ treo (`recoverStaleJobsAndRuns`).

---

## 4. NHỮNG VẤN ĐỀ HIỆN TẠI & RÀO CẢN KỸ THUẬT

Dưới đây là các vấn đề hiện hữu và rào cản từ phía hạ tầng nền tảng mà quản trị viên cần nắm rõ:

### 4.1. Rào cản Quyền hạn Ứng dụng (OAuth Scope) trên TikTok Shop Partner Center
- **Hiện tượng:** Khi bấm nút "Đồng bộ Video TikTok Shop" hoặc "Đồng bộ Affiliate", nếu tài khoản TikTok Shop chưa được cấp quyền tương ứng, API sẽ trả về lỗi `105001 / Permission Denied`.
- **Nguyên nhân:**
  - API Phân tích Video yêu cầu quyền: `data.shop_analytics.public.read`.
  - API Đơn hàng Affiliate yêu cầu quyền: `seller.affiliate_collaboration.read`.
- **Cách khắc phục:** Quản trị viên cần vào Partner Center, bổ sung 2 quyền này vào App và tiến hành Ủy quyền lại (Re-authorize) gian hàng.

### 4.2. Độ trễ công bố dữ liệu của TikTok Shop Analytics (T-1 Freshness Lag)
- **Hiện tượng:** Khi lọc xem ngày "Hôm nay", số liệu phân tích video của Shop (Views, GPM, CTR) chưa có đầy đủ hoặc hiển thị của ngày hôm trước.
- **Nguyên nhân:** Đây là **đặc tính cố hữu của TikTok Shop Open API**. TikTok không tính toán số liệu phân tích theo thời gian thực (real-time) cho toàn bộ video trong ngày hôm nay, mà hệ thống xử lý dữ liệu lớn (BigData) của TikTok chỉ chốt và công bố dữ liệu vào ngày hôm sau ($T-1$).
- **Giải pháp hệ thống đã làm:** Tự động mở rộng cửa sổ lấy dữ liệu 30 ngày gần nhất tính đến ngày $T-1$, đảm bảo mọi video đã đăng đều có số liệu thực tế được cập nhật mới nhất.

### 4.3. Đặc thù Báo cáo của Chiến dịch TikTok Ads "Product GMV Max"
- **Hiện tượng:** Quảng cáo GMV Max hiển thị theo tên chiến dịch, chi phí tổng và GMV, nhưng không thể bấm xem trực tiếp từng video quảng cáo chạy ngầm bên dưới nếu chiến dịch đó do TikTok tự động sinh sáng tạo từ danh mục sản phẩm (Catalog-based automated creative).
- **Nguyên nhân:** API Báo cáo GMV Max của TikTok Ads (`/gmv_max/report/get/`) chỉ phân phối dữ liệu ở cấp độ `campaign_id` và `product_id`. TikTok không trả về danh sách Video ID chi tiết đối với hình thức này như quảng cáo Custom Video truyền thống.

### 4.4. Cấu hình Cron Job trên Hosting / Server
- Hệ thống cần một Cron job chạy định kỳ (5–10 phút/lần) gọi lệnh `php tools/sync_worker_cli.php --cron` để tự động hóa hoàn toàn việc xử lý hàng đợi Webhook và đồng bộ đơn hàng ngầm. Nếu server chưa kích hoạt Cron, hệ thống phải dựa vào việc kích hoạt thủ công từ giao diện admin.

---

## 5. NHỮNG VIỆC CHƯA LÀM ĐƯỢC

Các tính năng dưới đây hiện **chưa có** hoặc đang nằm trong lộ trình nghiên cứu tiếp theo:

### 5.1. Chưa có tính năng Tự động Bật/Tắt (Automated Action/Execution) Chiến dịch Ads
- **Hiện trạng:** Hệ thống hiện tại chỉ đóng vai trò **Bộ não Phân tích & Đưa ra Khuyến nghị (Recommendation Engine)**. AI phân tích và đưa ra chỉ dẫn rõ ràng cho nhà bán hàng (Ví dụ: *"Nên tăng 15% ngân sách"*, *"Nên tạm dừng video này"*).
- **Chưa làm được:** Chưa có nút bấm tự động gọi API TikTok Ads Manager để tăng/giảm ngân sách hoặc bật/tắt chiến dịch trực tiếp từ màn hình dashboard (yêu cầu tích hợp scope `ads.campaign.write` và cơ chế phê duyệt xác thực hai lớp).

### 5.2. Chưa có Đồ thị Biểu diễn Giữ chân Từng giây (Second-by-second Retention Curve)
- **Hiện trạng:** Hiển thị lượt xem, CTR, GPM, Doanh thu, Đơn hàng, Likes, Comments, Shares.
- **Chưa làm được:** Chưa vẽ được biểu đồ sóng giữ chân người xem từ giây 1 đến giây 30 của video organic. Do TikTok Shop Open API không cung cấp granular watch-time curve cho Seller (chỉ có trong TikTok Creator Marketplace / Business Account Content API chuyên biệt).

### 5.3. Chưa có tính năng Gộp Nhiều Tài Khoản Quảng Cáo (Multi-Ads Account Aggregation)
- **Hiện trạng:** Hệ thống quản lý theo cấu trúc cặp: 1 Shop ID gắn liền với 1 Ads Account ID tương ứng.
- **Chưa làm được:** Chưa hỗ trợ tính năng chọn và gộp chung số liệu của 3–5 tài khoản quảng cáo khác nhau cùng chạy cho 1 gian hàng vào một màn hình duy nhất.

### 5.4. Chưa tích hợp Sàn Shopee (Kênh Shopee trên Menu hiện là Placeholder)
- **Hiện trạng:** Mục "Kênh Shopee (Sàn)" trên thanh Menu bên trái hiện đang ở chế độ xem thông tin định hướng.
- **Chưa làm được:** Chưa kết nối API Shopee Open Platform để đồng bộ đơn hàng và doanh thu từ Shopee.

### 5.5. Chưa có Cảnh báo Tự động qua Telegram / Zalo Bot
- **Chưa làm được:** Chưa có module bot tự động bắn thông báo tức thời khi:
  - Có đơn hàng giá trị cao bị hủy/hoàn.
  - Chiến dịch quảng cáo cắn tiền nhưng ROI tụt xuống dưới mức 15.0x.

---

## 6. HƯỚNG DẪN CÀI ĐẶT, CẤU HÌNH & VẬN HÀNH

### 6.1. Yêu cầu Môi trường
- **Web Server:** Nginx hoặc Apache (hỗ trợ `mod_rewrite`).
- **PHP:** Phiên bản 8.2 trở lên (yêu cầu extensions: `pdo_mysql`, `curl`, `json`, `mbstring`, `hash`, `openssl`).
- **Cơ sở dữ liệu:** MariaDB 10.6+ hoặc MySQL 8.0+.
- **Node.js:** Phiên bản 20+ (nếu cần build lại giao diện frontend).

### 6.2. Cấu trúc Thư mục Triển khai
```text
/home/addp/domains/marketing.addp.vn/
├── .env                                       <- File cấu hình bí mật (bên ngoài webroot)
└── public_html/ (webroot)
    ├── index.html                             <- Frontend UI bundle
    ├── assets/                                <- CSS & JS đóng gói của React
    ├── api/                                   <- Toàn bộ REST API PHP
    │   ├── config.php
    │   ├── db.php
    │   ├── tiktok_client.php
    │   ├── commerce_dashboard.php
    │   ├── commerce_ads_service.php
    │   ├── commerce_analytics_service.php
    │   └── ...
    ├── tools/
    │   └── sync_worker_cli.php                <- Script chạy Cron background
    └── database/migrations/                   <- Các file migration SQL
```

### 6.3. File Cấu hình Môi trường `.env`
Tạo file `.env` tại thư mục gốc domain với nội dung:
```ini
# DATABASE CONFIGURATION
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=marketing_addp
DB_USER=marketing_user
DB_PASS=MatKhauBaoMatCuaBan

# TIKTOK SHOP PARTNER CREDENTIALS
TIKTOK_APP_KEY=6b8xxxxxxxxx
TIKTOK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TIKTOK_TARGET_SHOP_ID=7495657895504611503
TIKTOK_TARGET_ADVERTISER_ID=7387314026558308368

# WEBHOOK & SECURITY
TIKTOK_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
APP_ENVIRONMENT=production

# FEATURE FLAGS
FEATURE_ENABLE_ANALYTICS_V2=true
FEATURE_ENABLE_FINANCE_V2=true
```

### 6.4. Cấu hình Cron Job trên Server
Mở crontab bằng lệnh `crontab -e` và thêm dòng sau:
```bash
# Chạy đồng bộ đơn hàng ngầm và dọn hàng đợi webhook mỗi 5 phút
*/5 * * * * php /home/addp/domains/marketing.addp.vn/public_html/tools/sync_worker_cli.php --cron >> /home/addp/domains/marketing.addp.vn/cron.log 2>&1
```

---

## 7. HƯỚNG DẪN CẤU HÌNH QUYỀN HẠN TIKTOK PARTNER CENTER

Để toàn bộ các tính năng Video Analytics và Affiliate hoạt động trơn tru không gặp lỗi quyền hạn:

1. Đăng nhập vào [TikTok Shop Partner Center](https://partner.tiktokshop.com/).
2. Chọn **App Management** $\rightarrow$ Chọn Ứng dụng của bạn $\rightarrow$ Chuyển đến tab **Permissions**.
3. Đảm bảo các nhóm quyền sau đã được tích chọn:
   - ✅ **TikTok Shop Analytics:** `data.shop_analytics.public.read` (Bắt buộc cho phân tích video ngắn).
   - ✅ **TikTok Shop Affiliate Collaboration:** `seller.affiliate_collaboration.read` (Bắt buộc cho đơn Affiliate).
   - ✅ **Orders & Logistics Management:** `seller.order.read`, `seller.fulfillment.read`.
   - ✅ **Product Management:** `seller.product.read`.
4. Nhấn **Save / Submit**.
5. Vào gian hàng TikTok Shop của bạn thực hiện **Authorize / Re-authorize** lại quyền cho ứng dụng.

---

## 8. MA TRẬN KIỂM THỬ & KIỂM SOÁT CHẤT LƯỢNG (QA)

Toàn bộ hệ thống đã trải qua quy trình kiểm thử nghiêm ngặt trước khi đóng gói phát hành:

| STT | Phân hệ Kiểm thử | Số ca | Kết quả | Chi tiết kiểm thử |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **Affiliate Data Integrity** | 10 | 10/10 PASS | 100% API-Only, xóa bỏ tỷ lệ cố định, không chấp nhận CSV ảo |
| 2 | **Video Affiliate & LIVE GMV Max** | 9 | 9/9 PASS | Xóa bỏ mock video, phân tách Ads ROAS vs Blended ROAS |
| 3 | **Product Break-even ROI** | 10 | 10/10 PASS | Công thức chuẩn xác, xử lý margin âm, không dùng 2.5 mặc định |
| 4 | **Database-First Dashboard** | 20 | 20/20 PASS | Tốc độ < 20ms, xóa `LIVE_FALLBACK`, phân loại nguồn rõ ràng |
| 5 | **Webhook Ingestion Engine** | 10 | 10/10 PASS | HMAC-SHA256, Replay Attack 300s, Khóa trạng thái tận cùng |
| 6 | **Background Reconciliation** | 8 | 8/8 PASS | MySQL `GET_LOCK`, Micro-batching, Tự phục hồi tiến trình treo |
| 7 | **Audit Remediation & Safety** | 22 | 22/22 PASS | Transaction nguyên tử, Rollback an toàn, Không xóa dữ liệu |
| 8 | **PHP Syntax Compile Gate** | 49 | 49/49 PASS | 100% tệp PHP sạch lỗi cú pháp trên chuẩn PHP 8.2 |
| **Σ** | **TỔNG CỘNG** | **138** | **138/138 PASS (100%)** | **Tỷ lệ lỗi phát hành: 0%** |

---
*Bản quyền tài liệu thuộc về ADDP Commerce Team. Cập nhật ngày 23/10/2026.*
