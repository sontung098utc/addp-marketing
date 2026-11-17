# RUNBOOK SPRINT V2-05: UNIFIED BUSINESS UI + CUSTOMER 360 INGESTION

## 1. Tổng Quan Mục Tiêu
Sprint V2-05 chuẩn hóa trải nghiệm giao diện người dùng theo phong cách **Light Business Analytics**, kiến trúc lại toàn bộ hệ thống màu sắc có ngữ nghĩa (Semantic Tokens), hoàn thiện luồng nạp và quản trị dữ liệu khách hàng đa chiều **Customer 360** với cam kết bảo mật tuyệt đối (Zero Plaintext PII Leakage), đồng thời bảo vệ 100% các nguyên lý hạch toán và số liệu chuẩn mực (September Authoritative Baseline).

---

## 2. Các Trụ Cột Thay Đổi Kỹ Thuật

### 2.1. Global UI Design System & Semantic Color Tokens
- **Bãi bỏ hoàn toàn phong cách Cyberpunk / Dark / Neon Dashboard**:
  - Giao diện chuyển đổi sang **Light Business Analytics**: sạch sẽ, chuyên nghiệp, độ tương phản cao (WCAG-compliant), tỷ lệ mật độ thông tin tối ưu trên Desktop.
- **Centralized Design Tokens (`src/index.css` & `src/App.css`)**:
  - `--color-primary` (`#2563eb`): Điều hướng, trạng thái chọn, hành động chính, liên kết.
  - `--color-success` (`#16a34a`): COMPLETE, VERIFIED, FRESH, trạng thái kiểm chứng hợp lệ.
  - `--color-warning` (`#d97706`): PARTIAL, NOT_YET_AVAILABLE, cảnh báo cần chú ý.
  - `--color-danger` (`#dc2626`): FAILED, hủy đơn, thất thoát, thao tác hủy.
  - `--color-neutral` (`#475569`, `#0f172a`, `#64748b`): Nhãn chữ, viền, UNKNOWN, thông tin trung tính.
- **Chuẩn hóa Executive AI Summary**:
  - Nền thẻ sáng thanh lịch (`#ffffff`), viền tinh tế (`#e2e8f0`).
  - Tiêu đề tối rõ nét (`#0f172a`), takeaway nổi bật trong khung xám dịu (`#f8fafc`).
  - Bullet điểm phân tích có icon ngữ nghĩa (xanh lá/vàng/đỏ), triệt tiêu các gradient lòe loẹt gây lóa mắt.
- **Chuẩn hóa nhãn nghiệp vụ trên Tab Đơn hàng**:
  - Nút xuất file: **"Xuất CSV"** (thay vì "Xuất Excel" gây hiểu lầm định dạng).
  - Tiêu đề bảng đối soát: **"Hạch Toán Hao Hụt"** (thay vì "Sổ Cái Hao Hụt").

### 2.2. Requested Period Semantics (01-06/10 vs 01-05/10)
- **Bảo toàn khoảng thời gian người dùng yêu cầu**:
  - Khi người dùng chọn kỳ `01/10 → 06/10`, date picker và trạng thái kỳ được giữ nguyên vẹn `01/10 → 06/10` sau khi đồng bộ hoặc nạp báo cáo.
  - Hệ thống **không tự ý rút ngắn** date picker về `01/10 → 05/10` chỉ vì TikTok Ads mới có số liệu đến ngày 05/10.
- **Sub-header hiển thị minh bạch 3 sự thật**:
  1. `Dữ liệu Shop: đến 06/10/2026`
  2. `Dữ liệu Ads: đến 05/10/2026`
  3. `Kỳ so sánh khả dụng: 01/10/2026 → 05/10/2026` (kèm tooltip giải thích nguyên nhân do TikTok Ads chưa chốt ngày 06).
- **Backend API Reporting Payload**:
  - Cung cấp tường minh cả `requested_start_date` và `requested_end_date` trong metadata `period` và `report_meta`.

### 2.3. Customer 360 Ingestion & Privacy Model
- **Cơ sở dữ liệu (Additive Migration 017)**:
  - Bảng `commerce_order_recipients`: bổ sung `customer_identifier_hash` (VARCHAR 64), `identity_method` (VARCHAR 32).
  - Bảng `commerce_customer_profiles`: bổ sung `return_refund_count` (INT), `identity_method` (VARCHAR 32), `latest_order_status` (VARCHAR 50).
  - Đi kèm file rollback `20261006_017_rollback_add_customer_identity_columns.sql`.
- **Mô hình bảo vệ dữ liệu cá nhân (Zero Plaintext PII Leakage)**:
  - Tuyệt đối không lưu trữ hay hiển thị số điện thoại hoặc địa chỉ thô ở dạng văn bản thuần.
  - Băm số điện thoại chuẩn hóa bằng hàm băm một chiều xác định `hash_hmac('sha256', 'phone:' . $normalizedPhone, $salt)`.
  - Quy chuẩn che mờ (Masking Standard):
    - Điện thoại: `09******12`
    - Tên người nhận: `Ng*** A**`
    - Địa chỉ: bảo lưu cấp Tỉnh/Thành phố và Quận/Huyện, che mờ số nhà tên đường.
- **Thứ bậc nhận diện danh tính (Identity Resolution Hierarchy)**:
  1. `buyer_uid` (Tài khoản người mua TikTok cung cấp).
  2. `recipient_id` (Định danh người nhận ổn định).
  3. `phone_hmac` (Băm HMAC của số điện thoại chuẩn hóa).
  4. `UNMATCHED` (Không tự ý gộp nếu thiếu định danh).
- **Phân tách rành mạch chỉ số Trọn đời vs Chỉ số trong kỳ**:
  - `lifetime`: Tổng chi tiêu tích lũy, tổng đơn tích lũy, lần mua đầu, lần mua cuối.
  - `period`: Chi tiêu phát sinh trong kỳ, đơn hàng trong kỳ.
  - Phân loại khách hàng: `NEW` (đơn đầu tiên nằm trong kỳ chọn) vs `RETURNING` (đã có đơn trước kỳ chọn).
- **Tính toán phi phong tỏa (Non-Fatal Ingestion)**:
  - Luồng nạp thông tin khách hàng được tách biệt và thực thi an toàn sau khi commit đơn hàng. Bất kỳ lỗi trích xuất thông tin khách hàng nào cũng không bao giờ làm gián đoạn hay thất bại phiên đồng bộ đơn hàng.
- **Data Trust: Thiếu dữ liệu != Bằng 0**:
  - Khi chưa đồng bộ khách hàng, trả về rõ ràng `CUSTOMER_DATA_NOT_INGESTED`, không hiển thị 0 khách hay 0 đơn ảo.

---

## 3. Quy Trình Kiểm Thử & Nghiệm Thu Local

Tất cả các lệnh kiểm thử được chạy cục bộ:
```bash
# 1. Kiểm tra cú pháp PHP toàn bộ dự án (35 file)
node tools/verify_php_syntax.cjs

# 2. Kiểm tra nghiệp vụ Customer 360 Ingestion & Privacy (9/9 pass)
node tools/test_v2_05_customer_ingestion_and_privacy.cjs

# 3. Kiểm tra Requested Period Semantics & UI Tokens (4/4 pass)
node tools/test_v2_05_requested_period_and_ui_tokens.cjs

# 4. Kiểm tra hồi quy V2-04.4 Reporting Freshness & Alignment (17/17 pass)
node tools/test_v2_04_4_reporting_freshness_and_period_alignment.cjs

# 5. Kiểm tra hồi quy V2-04.4 Order List & Export (6/6 pass)
node tools/test_v2_04_4_order_list_and_export.cjs

# 6. Kiểm tra hồi quy V2-04.3 Async Sync Jobs & Recovery (15/15 pass)
node tools/test_v2_04_3_async_sync_jobs_and_recovery.cjs

# 7. Đóng gói bản phát hành POSIX
node tools/package_v2_05_release.cjs
```

---

## 4. Hướng Dẫn Triển Khai Thủ Công Khi Sẵn Sàng

> **LƯU Ý:** Không tự động deploy lên server production. Người quản trị thực hiện các bước sau khi triển khai:

1. **Sao lưu cơ sở dữ liệu hiện tại**:
   ```bash
   mysqldump -u <user> -p <dbname> > backup_pre_v205.sql
   ```
2. **Chạy Migration 017**:
   ```bash
   mysql -u <user> -p <dbname> < database/migrations/20261006_017_add_customer_identity_columns.sql
   ```
3. **Giải nén bản release vào thư mục web**:
   - Sao chép các tệp PHP vào `public/api/`
   - Sao chép các tệp frontend từ `dist/` vào webroot
4. **Xác minh số liệu September Authoritative Baseline**:
   - Orders: `4,207`
   - Gross: `409,171,911`
   - Cancellation Loss: `84,394,802` (731 đơn)
   - Refund Loss: `1,806,037` (10 đơn)
   - Total Loss: `86,200,839`
   - Realized Sales: `322,971,072` (409,171,911 - 86,200,839 = 322,971,072)
   - Ads Spend: `34,182,003`
   - Attributed Gross: `383,251,049`
   - Ads Orders: `5,165`
   - ROI: `11.21`
