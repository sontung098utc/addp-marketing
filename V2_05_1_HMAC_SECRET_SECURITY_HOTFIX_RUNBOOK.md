# V2-05.1 HMAC SECRET SECURITY HOTFIX RUNBOOK

## 1. Mục Tiêu & Bối Cảnh Hotfix
Sprint V2-05.1 xử lý dứt điểm rủi ro bảo mật PII/HMAC phát hiện trong đợt Pre-Deployment Audit:
- **Dedicated Application Secret**: Loại bỏ hoàn toàn fallback `addp_customer_salt_2026`, `TIKTOK_APP_SECRET`, `AUTH_SIGNING_KEY`. Định danh khách hàng sử dụng độc quyền biến môi trường `CUSTOMER_IDENTITY_HMAC_KEY`.
- **Fail-Closed Principle**: Khi key thiếu, rỗng, khoảng trắng hoặc không đạt chuẩn bảo mật (độ dài < 32 ký tự, placeholder), hệ thống từ chối tính toán hash, trả về trạng thái `CONFIGURATION_ERROR` (`CUSTOMER_IDENTITY_HMAC_KEY_MISSING` hoặc `CUSTOMER_IDENTITY_HMAC_KEY_INVALID`), tuyệt đối không dùng key giả và không ghi plaintext PII.
- **Non-Fatal Decoupling**: Lỗi cấu hình Customer 360 được cô lập, **hoàn toàn không làm ảnh hưởng hay làm FAILED tiến trình đồng bộ Đơn hàng (Orders Sync)**.
- **Key Stability**: Document ràng buộc `CUSTOMER_IDENTITY_HMAC_KEY` là persistent application secret. Do tính chất hash tất định (deterministic), không rotate key tùy tiện sau khi dữ liệu khách hàng production đã được ingest.

---

## 2. Yêu Cầu Cấu Hình Trước Khi Triển Khai (Pre-Deployment Configuration)

> [!IMPORTANT]
> Máy chủ production bắt buộc phải có biến môi trường `CUSTOMER_IDENTITY_HMAC_KEY` trong file `.env` trước khi thực hiện đồng bộ hồ sơ khách hàng.

### Cấu hình file `.env`
Khai báo trong file `.env` (nằm ngoài webroot, ví dụ `/home/addp/domains/marketing.addp.vn/.env`):
```bash
# Dedicated Customer Identity HMAC Secret (>= 32 bytes entropy, cố định lâu dài)
CUSTOMER_IDENTITY_HMAC_KEY=<random_32_bytes_hex_or_alphanumeric_secret>
```

> [!CAUTION]
> - KHÔNG chia sẻ hoặc commit secret vào Git/source code.
> - Key phải có độ dài tối thiểu **32 ký tự**.
> - KHÔNG sử dụng các tiền tố mẫu như `YOUR_...`, `changeme`, `placeholder`.

---

## 3. Công Cụ Xác Minh Cấu Hình Dành Cho Vận Hành (Operator Verification Tool)

Quản trị viên / Operator có thể kiểm tra biến môi trường đã nhận diện thành công hay chưa bằng CLI tool chuyên dụng mà **TUYỆT ĐỐI KHÔNG để lộ giá trị secret**:

```bash
php tools/verify_customer_config_cli.php
```

### Kết quả trả về chuẩn:
1. **Nếu cấu hình thành công và hợp lệ**:
   ```text
   CUSTOMER_IDENTITY_HMAC_KEY=CONFIGURED
   ```
   *(Exit code: 0)*

2. **Nếu chưa khai báo hoặc rỗng**:
   ```text
   CUSTOMER_IDENTITY_HMAC_KEY=MISSING
   ```
   *(Exit code: 1)*

3. **Nếu key ngắn hơn 32 ký tự hoặc chứa placeholder**:
   ```text
   CUSTOMER_IDENTITY_HMAC_KEY=INVALID
   ```
   *(Exit code: 1)*

---

## 4. An Toàn Dữ Liệu Lịch Sử & Migration 017
- Migration 017 (`20261006_017_add_customer_identity_columns.sql`) **chưa từng được chạy trên production**.
- Dữ liệu production hiện tại chưa hề sinh bất kỳ customer identifier hash nào phụ thuộc vào salt cũ.
- Sau khi deploy V2-05.1 và cấu hình `CUSTOMER_IDENTITY_HMAC_KEY`, tiến trình backfill / sync sẽ tạo hash mới hoàn toàn chuẩn xác và tất định theo secret duy nhất này.

---

## 5. Quy Trình Triển Khai Chuẩn (Deployment Steps)

> [!WARNING]
> KHÔNG DEPLOY KHI CHƯA ĐƯỢC PHÊ DUYỆT. Thực hiện theo thứ tự sau khi có chỉ đạo:

1. **Bước 1 — Cập nhật file `.env`**:
   Thêm `CUSTOMER_IDENTITY_HMAC_KEY=<secret>` vào file `.env` máy chủ.
2. **Bước 2 — Kiểm tra cấu hình**:
   Chạy lệnh `php tools/verify_customer_config_cli.php`. Đảm bảo kết quả là `CUSTOMER_IDENTITY_HMAC_KEY=CONFIGURED` (exit code 0).
3. **Bước 3 — Giải nén Release Archive**:
   Giải nén gói `task_v2_05_1_hmac_secret_security_hotfix_release_<timestamp>.zip` đè vào thư mục mã nguồn production.
4. **Bước 4 — Chạy Database Migration 017**:
   ```bash
   mysql -u <user> -p <dbname> < database/migrations/20261006_017_add_customer_identity_columns.sql
   ```
5. **Bước 5 — Kiểm tra giao diện & Đồng bộ**:
   - Truy cập tab **Khách hàng** trên Dashboard.
   - Kiểm tra Chip trạng thái hiển thị `DỮ LIỆU SẴN SÀNG (PII PROTECTED)` hoặc `CUSTOMER_DATA_NOT_INGESTED`.
   - Nhấn **Đồng bộ hồ sơ** để trích xuất 4,207 đơn hàng tháng 09 sang Customer 360.

---

## 6. Quy Trình Rollback (Rollback Instructions)
Nếu có bất kỳ sự cố ngoài ý muốn:
1. **Rollback Database Migration 017**:
   ```bash
   mysql -u <user> -p <dbname> < database/migrations/20261006_017_rollback_add_customer_identity_columns.sql
   ```
2. **Khôi phục mã nguồn**:
   Giải nén lại gói phát hành ổn định trước đó:
   `release/task_v2_04_4_reporting_freshness_and_period_alignment_release_20261006_160111.zip`.
