# HƯỚNG DẪN THIẾT LẬP TIKTOK SHOP PARTNER CENTER WEBHOOK
(TIKTOK SHOP PARTNER CENTER WEBHOOK SETUP GUIDE)

**Hệ thống mục tiêu:** `https://marketing.addp.vn`  
**Endpoint nhận Webhook:** `https://marketing.addp.vn/api/webhook.php`  
**Kiến trúc:** TikTok Shop Webhook → `CommerceWebhookService` → MariaDB Inbox & Core Tables → Dashboard  
**Phiên bản:** `2.1.0-p0-webhook-dbfirst`  

---

## 1. Tổng quan kiến trúc Webhook Ingestion

Trước bản phát hành này, hệ thống phụ thuộc hoàn toàn vào việc người dùng bấm nút đồng bộ thủ công để kéo toàn bộ đơn hàng từ TikTok Shop API (mất 15+ phút và gây nghẽn gateway).

Kiến trúc Webhook mới chuyển đổi toàn bộ mô hình sang **Event-Driven**:
1. TikTok Shop gửi thông báo sự kiện ngay khi đơn hàng phát sinh hoặc thay đổi trạng thái.
2. Webhook endpoint xác thực chữ ký HMAC-SHA256 và tem thời gian chống replay.
3. Sự kiện được ghi nhận an toàn vào hộp thư `commerce_webhook_events` (chống trùng lặp bằng `event_id`).
4. Hệ thống phản hồi **HTTP 200 OK Fast ACK** trong vòng vài chục mili-giây.
5. Cập nhật tức thời vào `commerce_orders`, `commerce_order_items`, `commerce_aftersales`.
6. Kích hoạt động cơ tính thất thoát `CommerceLossEngine` và đánh dấu hàng đợi `commerce_daily_aggregate_queue`.

---

## 2. Thông số cấu hình Endpoint trên TikTok Partner Center

Khi quản trị viên đăng nhập vào **TikTok Shop Partner Center** (hoặc TikTok Shop Open Platform Console):

| Thuộc tính | Giá trị cấu hình | Ghi chú |
| :--- | :--- | :--- |
| **Webhook URL** | `https://marketing.addp.vn/api/webhook.php` | Phải sử dụng giao thức HTTPS hợp lệ có chứng chỉ SSL. |
| **HTTP Method** | `POST` | TikTok gửi sự kiện qua phương thức POST với raw JSON payload. |
| **Content-Type** | `application/json` | Định dạng body sự kiện là UTF-8 JSON. |
| **App Key** | `[TIKTOK_APP_KEY]` | Khóa công khai của ứng dụng trong Partner Center. |
| **App Secret** | `[TIKTOK_APP_SECRET]` | Khóa bí mật dùng để tạo chữ ký HMAC-SHA256. |

---

## 3. Các loại sự kiện bắt buộc kích hoạt (Webhook Subscriptions)

Trong bảng quản lý Webhook Subscriptions của TikTok Partner Center, cần kích hoạt các sự kiện sau:

### A. Sự kiện Đơn hàng (Order Events - Event Type 1)
- **`ORDER_STATUS_CHANGE` (hoặc `ORDER_STATUS_UPDATE`)**:
  - **Mục đích:** Đồng bộ trạng thái đơn hàng theo thời gian thực (`UNPAID`, `AWAITING_SHIPMENT`, `AWAITING_COLLECTION`, `IN_TRANSIT`, `DELIVERED`, `COMPLETED`, `CANCELLED`).
  - **Cơ chế an toàn:** Hệ thống áp dụng **Status Precedence Matrix** đơn điệu. Một sự kiện đến trễ (out-of-order) có trạng thái cũ hơn (ví dụ: `AWAITING_SHIPMENT` đến sau khi đơn đã `DELIVERED`) sẽ bị từ chối cập nhật đè trạng thái, bảo toàn tính toàn vẹn dữ liệu.

### B. Sự kiện Trả hàng / Khiếu nại / Thất thoát (Aftersales & Return Events)
- **`AFTERSALES_STATUS_CHANGE`** (hoặc `RETURN_STATUS_CHANGE`):
  - **Mục đích:** Cập nhật yêu cầu hoàn tiền, trả hàng, huỷ đơn sau khi giao.
  - **Cơ chế an toàn:** Tự động ghi nhận vào `commerce_aftersales`, liên kết với `order_id` gốc, và kích hoạt `CommerceLossEngine` để trừ vào doanh thu thực nhận (`realized_revenue = gross_revenue - return_loss`), ngăn ngừa tình trạng báo cáo sai lệch GMV.

### C. Sự kiện Huỷ quyền ứng dụng (Authorization Events - Event Type 2)
- **`DEAUTHORIZE` (hoặc `SELLER_DEAUTHORIZE`)**:
  - **Mục đích:** Ghi nhận sự kiện người bán ngắt kết nối shop để hệ thống thu hồi token một cách an toàn.

---

## 4. Cấu hình App Secret trên máy chủ Production

Khóa bí mật `App Secret` của TikTok Partner Center được quản lý trong tệp cấu hình bí mật của máy chủ:

**Đường dẫn tệp:** `/home/[user]/public_html/api/config.php`  
*(Lưu ý: Tệp này nằm trong danh mục bảo vệ nghiêm ngặt, không bao giờ bị đóng gói hoặc ghi đè khi cập nhật).*

Đảm bảo trong `api/config.php` có định nghĩa hằng số hoặc mảng cấu hình:
```php
<?php
// /home/[user]/public_html/api/config.php

// Khóa bí mật ứng dụng TikTok Shop Partner Center
define('TIKTOK_APP_SECRET', 'your_actual_tiktok_partner_center_app_secret_here');

// Hoặc nếu hệ thống sử dụng mảng cấu hình config array:
$config['tiktok_app_secret'] = 'your_actual_tiktok_partner_center_app_secret_here';
```

`CommerceWebhookService` tự động đọc bí mật theo thứ tự:
1. `$_ENV['TIKTOK_APP_SECRET']`
2. `constant('TIKTOK_APP_SECRET')`
3. `$config['tiktok_app_secret']`

---

## 5. Cơ chế Bảo mật & Xác thực Chữ ký (Signature Verification)

Endpoint `public/api/webhook.php` được bảo vệ bởi 3 lớp phòng vệ:

1. **Giới hạn kích thước tải (Payload Size Limit):**
   - Giới hạn tối đa **1 MB** (`1048576 bytes`). Bất kỳ yêu cầu nào vượt quá ngưỡng này sẽ bị ngắt và trả về `HTTP 413 Payload Too Large`.

2. **Chống tấn công phát lại (Anti-Replay Timestamp Tolerance):**
   - Đọc header `timestamp` hoặc `x-tts-timestamp`.
   - Dung sai tối đa: **$\pm 300$ giây (5 phút)**:
     $$|t_{\text{request}} - t_{\text{server}}| \le 300\text{s}$$
   - Nếu chênh lệch vượt quá 300s, yêu cầu bị từ chối với `HTTP 400 TIMESTAMP_OUT_OF_TOLERANCE`.

3. **Chữ ký mã hóa HMAC-SHA256:**
   - TikTok gửi chữ ký trong header `authorization` (hoặc `x-tts-signature`).
   - Thuật toán xác thực:
     $$\text{Signature} = \text{hash\_hmac}('sha256', \text{app\_secret} + \text{raw\_body}, \text{app\_secret})$$
     *(Hỗ trợ cả chuẩn V2 Digest: `hash_hmac('sha256', raw_body, app_secret)`)*
   - Sử dụng so sánh an toàn thời gian `hash_equals()` để ngăn chặn tấn công Timing Attack.
   - Nếu chữ ký không khớp: trả về `HTTP 401 INVALID_SIGNATURE`.

---

## 6. Quy trình Kiểm thử & Nghiệm thu Kết nối (Verification & Testing)

### Bước 1: Kiểm tra tính sẵn sàng của Endpoint (Health Probe)
Dùng trình duyệt hoặc `curl` gửi yêu cầu GET:
```bash
curl -i https://marketing.addp.vn/api/webhook.php
```
**Kết quả phản hồi hợp lệ:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{
  "success": true,
  "message": "TikTok Shop Webhook Endpoint Ready (POST only)",
  "timestamp": 1728528000
}
```

### Bước 2: Gửi sự kiện kiểm thử từ TikTok Partner Center
1. Trên giao diện TikTok Shop Partner Center, chọn Webhook Subscription đã tạo.
2. Bấm nút **"Test"** hoặc **"Send Test Event"** cho sự kiện `ORDER_STATUS_CHANGE`.
3. Kiểm tra kết quả phản hồi trên console của TikTok: phải nhận được mã `HTTP 200 OK`.

### Bước 3: Kiểm tra sự kiện trong Cơ sở dữ liệu MariaDB
Đăng nhập phpMyAdmin hoặc MySQL CLI trên máy chủ và truy vấn:
```sql
SELECT 
    event_id, 
    event_type, 
    shop_id, 
    status, 
    http_code, 
    created_at, 
    processed_at 
FROM commerce_webhook_events 
ORDER BY id DESC 
LIMIT 5;
```
**Dấu hiệu thành công:**
- Cột `status` mang giá trị `'PROCESSED'`.
- Cột `http_code` mang giá trị `200`.
- Thời gian `processed_at` ghi nhận thời điểm xử lý thành công.

---

## 7. Xử lý sự cố thường gặp (Troubleshooting)

| Mã lỗi / Triệu chứng | Nguyên nhân khả dĩ | Biện pháp xử lý |
| :--- | :--- | :--- |
| **HTTP 401 INVALID_SIGNATURE** | `TIKTOK_APP_SECRET` trong `api/config.php` không khớp với App Secret trên Partner Center. | Kiểm tra lại App Secret trên Partner Center và cập nhật chính xác vào `api/config.php`. |
| **HTTP 400 TIMESTAMP_OUT_OF_TOLERANCE** | Giờ đồng hồ trên máy chủ web lệch quá 5 phút so với giờ chuẩn quốc tế (NTP). | Đồng bộ thời gian trên máy chủ Linux bằng `chronyd` hoặc `ntpdate pool.ntp.org`. |
| **HTTP 413 Payload Too Large** | Tải trọng vượt quá 1MB. | Kiểm tra định dạng webhook gửi từ TikTok (thường sự kiện đơn lẻ chỉ vài KB). |
| **Duplicate Event (HTTP 200 ALREADY_PROCESSED)** | TikTok gửi lại sự kiện cùng `event_id` do mạng trễ. | Đây là tính năng Idempotency bình thường của hệ thống, không phải lỗi. |
