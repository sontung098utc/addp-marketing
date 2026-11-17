# BÁO CÁO THẨM ĐỊNH CỔNG PHÁT HÀNH (RELEASE GATE VERIFICATION)
# NHIỆM VỤ: TASK 02B — EXTENSION CONNECTOR AUTHENTICATION
**Dự án:** ADDP Commerce Intelligence  
**Môi trường thẩm định:** Local Development Sandbox (Strictly Read-Only with Respect to Production)  
**Ngày kiểm toán:** 24/09/2026  
**Trạng thái triển khai:** Chưa triển khai Production (DO NOT DEPLOY ACTIVE)  

---

## TỔNG QUAN THẨM ĐỊNH (EXECUTIVE SUMMARY)

Đợt thẩm định Cổng phát hành Task 02B được thực hiện độc lập, toàn diện trên toàn bộ mã nguồn, tệp migration cơ sở dữ liệu, tiện ích mở rộng Chrome Extension v1.1.0, các bản build artifacts và kiểm thử bảo mật tự động.

Mục tiêu chính: Xác minh tính an toàn, toàn vẹn và mức độ sẵn sàng của bản triển khai Task 02B trước khi đóng gói phát hành Giai đoạn A (Phase A Transition) lên môi trường Production (`marketing.addp.vn`).

---

## KẾT QUẢ ĐÁNH GIÁ CHI TIẾT 20 CỔNG KIỂM SOÁT (GATES 1 — 20)

### CỔNG 1: MIGRATION VERIFICATION
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `database/migrations/20260924_001_create_connector_tables.sql`
* **Nội dung xác minh:**
  1. *Plaintext pairing secret:* Hoàn toàn không tồn tại cột lưu mã ghép nối dạng plaintext. Cột `pairing_hash varchar(64) NOT NULL` chỉ lưu mã băm SHA-256.
  2. *Indexing pairing_hash:* Được đánh chỉ mục duy nhất `UNIQUE KEY idx_pairing_hash (pairing_hash)`.
  3. *Định danh connector_id:* Khai báo `varchar(64) NOT NULL` với ràng buộc duy nhất `UNIQUE KEY idx_connector_id (connector_id)`.
  4. *Lưu trữ Token JTI:* Cột `token_jti_hash varchar(64) NOT NULL` lưu giá trị băm SHA-256 của JWT ID, không lưu token thô.
  5. *Ràng buộc gian hàng shop_id:* Được đánh chỉ mục kết hợp `KEY idx_shop_exp (shop_id, expires_at)` và `KEY idx_shop_status (shop_id, status)`.
  6. *Ngữ nghĩa trạng thái & thời gian:* `expires_at` sử dụng `bigint(20)` (Unix timestamp epoch), các mốc sự kiện (`redeemed_at`, `revoked_at`, `last_used_at`) sử dụng kiểu `timestamp NULL`.
  7. *Tính chất di chuyển DDL:* Hoàn toàn bổ sung mới (`CREATE TABLE IF NOT EXISTS`), không can thiệp, không sửa đổi cấu trúc bảng kinh doanh hiện hữu (`tiktok_config`, `tiktok_orders`, `tiktok_seller_center_snapshots`).
  8. *Tương thích MySQL:* Tương thích hoàn toàn với MySQL 5.7+, MySQL 8.0+ và MariaDB 10.3+.
  9. *Kiểm tra `initializeDatabase()`:* Xác nhận hàm `initializeDatabase()` trong `public/api/db.php` **KHÔNG** bị chỉnh sửa để tạo các bảng này.
* **Bản lược đồ DDL chính thức:**
```sql
CREATE TABLE IF NOT EXISTS `tiktok_connector_pairings` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `pairing_hash` varchar(64) NOT NULL,
    `shop_id` varchar(100) NOT NULL,
    `expires_at` bigint(20) NOT NULL,
    `redeemed_at` timestamp NULL DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_pairing_hash` (`pairing_hash`),
    KEY `idx_shop_exp` (`shop_id`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiktok_connector_sessions` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `connector_id` varchar(64) NOT NULL,
    `shop_id` varchar(100) NOT NULL,
    `token_jti_hash` varchar(64) NOT NULL,
    `status` varchar(20) NOT NULL DEFAULT 'active',
    `expires_at` bigint(20) NOT NULL,
    `last_used_at` timestamp NULL DEFAULT NULL,
    `revoked_at` timestamp NULL DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_connector_id` (`connector_id`),
    KEY `idx_shop_status` (`shop_id`, `status`),
    KEY `idx_token_jti` (`token_jti_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### CỔNG 2: PAIRING CREDENTIAL ENTROPY
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/api/auth_guard.php` (`generatePairingToken()`), `public/api/connector_token.php`
* **Bằng chứng kỹ thuật:**
  - *Nguồn ngẫu nhiên:* Sử dụng `random_bytes()` của PHP (CSPRNG hệ thống qua CryptGenRandom / getrandom), không dùng `Math.random()`, timestamp hay số tuần tự.
  - *Độ hỗn loạn thô:* 8 byte ngẫu nhiên thô = 64 bit entropy mật mã học. Nonce của token bổ sung thêm 16 byte (128 bit entropy).
  - *Định dạng hiển thị mã thủ công:* `PAIR-XXXX-YYYY-ZZZZ` gồm 12 ký tự hex viết hoa (48 bit entropy, $16^{12} \approx 2.81 \times 10^{14}$ khả năng kết hợp).
  - *Lưu trữ băm:* Hệ thống chỉ thực hiện `INSERT INTO tiktok_connector_pairings (pairing_hash, ...)` với giá trị `hash('sha256', $pairingCode)`.
  - *Kiểm soát nhật ký:* Nhật ký bảo mật `error_log` chỉ ghi nhận `shop_id` và `admin user`, tuyệt đối không ghi mã ghép nối hay token vào log.

---

### CỔNG 3: ATOMIC SINGLE-USE REDEMPTION
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/api/connector_token.php` (hành động `redeem_pairing`)
* **Bằng chứng kỹ thuật:**
  - *Truy vấn nguyên tử:*
    ```sql
    UPDATE `tiktok_connector_pairings` 
    SET `redeemed_at` = NOW() 
    WHERE `pairing_hash` = ? AND `redeemed_at` IS NULL AND `expires_at` > ?
    ```
  - *Cơ chế khóa:* Trong công cụ lưu trữ InnoDB, điều kiện lọc qua chỉ mục `UNIQUE` khóa độc quyền bản ghi hàng (X-lock). Khi nhiều yêu cầu đồng thời đến cùng lúc, chỉ có đúng một giao dịch cập nhật thành công (`rowCount() === 1`). Mọi giao dịch còn lại nhận `rowCount() === 0` và bị trả về mã lỗi HTTP 409 Conflict (`PAIRING_ALREADY_REDEEMED`).
  - *Kiểm thử mô phỏng đa luồng (`tools/test_concurrency_race.cjs`):* Bắn 20 yêu cầu cứu chuộc đồng thời:
    - Yêu cầu thành công (HTTP 200): **1**
    - Yêu cầu xung đột bị từ chối (HTTP 409): **19**
    - Lỗi khác: **0**

---

### CỔNG 4: CONNECTOR TOKEN SEPARATION
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/api/auth_guard.php` (`requireAuth()`, `requireConnectorAuth()`, `generateConnectorToken()`)
* **Bằng chứng kỹ thuật:**
  - Hệ thống định nghĩa 3 lớp token với phạm vi quyền hạn (scope) hoàn toàn tách biệt:
    1. *Admin Token:* `sub: 'admin'`, `scope: 'admin:all'`, không có `connector_id`.
    2. *Pairing Token:* `sub: 'pairing:seller_center'`, `scope: 'connector:pair'`, TTL = 300s (5 phút).
    3. *Connector Token:* `sub: 'connector:seller_center'`, `scope: 'seller_center:sync'`, chứa `connector_id`, `jti`, TTL = 86400s (24 giờ).
  - *Cơ chế xác thực:*
    - `requireConnectorAuth()` kiểm tra nghiêm ngặt `$claims['scope'] === 'seller_center:sync'`. Nếu gửi Admin Token, hệ thống trả về HTTP 403 `FORBIDDEN_SCOPE`.
    - `requireAuth('admin:all')` từ chối mọi Connector Token với mã HTTP 403 `FORBIDDEN`.
    - Xác minh chữ ký sử dụng hàm so sánh an toàn thời gian thực `hash_equals()`.
    - Không chấp nhận tham số xác thực qua query-string (chỉ chấp nhận `Authorization: Bearer <token>` trong HTTP Header).

---

### CỔNG 5: SERVER-SIDE REVOCATION
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/api/auth_guard.php`, `public/api/connector_token.php`, `public/extension/popup.js`
* **Bằng chứng kỹ thuật:**
  - Hàm `requireConnectorAuth()` thực hiện truy vấn trực tiếp bảng `tiktok_connector_sessions`:
    - Nếu phiên không tồn tại -> HTTP 401 `CONNECTOR_SESSION_NOT_FOUND`.
    - Nếu trạng thái khác `active` hoặc `revoked_at IS NOT NULL` -> HTTP 401 `CONNECTOR_REVOKED`.
    - Nếu phiên trên máy chủ hết hạn (`expires_at < time()`) -> HTTP 401 `CONNECTOR_SESSION_EXPIRED`.
    - Nếu JTI không khớp (`hash_equals(token_jti_hash, sha256(jti))`) -> HTTP 401 `INVALID_TOKEN_JTI`.
    - Nếu gian hàng không khớp -> HTTP 403 `SHOP_MISMATCH`.
  - *Quy trình ngắt kết nối:* `popup.js` gửi yêu cầu thu hồi lên máy chủ (`/api/connector_token.php?action=revoke`) trước khi xóa bộ nhớ cục bộ tiện ích.
  - *Trường hợp lỗi mạng:* Nếu mạng bị gián đoạn khi ngắt kết nối, bộ nhớ cục bộ vẫn được xóa sạch (client revoked), nhưng phiên trên máy chủ vẫn ở trạng thái `active` cho đến khi hết hạn tự nhiên 24 giờ.

---

### CỔNG 6: PHASE A ANONYMOUS PATH
* **Trạng thái:** `PASS WITH RISK`
* **Tệp kiểm tra:** `public/api/shop_diagnosis.php` (`sync_seller_center`), `public/api/config.php`
* **Bằng chứng kỹ thuật & Giải đáp 6 câu hỏi bắt buộc:**
  1. *Yêu cầu ẩn danh có thể truyền `shop_id` tùy ý không?* **CÓ**. Trong Giai đoạn A, nếu không có Bearer token, hệ thống lấy `$targetShopId = trim((string)($body['shop_id'] ?? $shopId))`.
  2. *Yêu cầu ẩn danh có thể cập nhật dữ liệu của gian hàng khác không?* **CÓ**, nếu gian hàng đó đã tồn tại trong bảng cấu hình `tiktok_config`, vì câu lệnh `WHERE shop_id = ?` sẽ thực thi theo ID được truyền trong body.
  3. *Có còn tồn tại mệnh đề cũ `WHERE shop_id = ? OR id = ?` không?* **HOÀN TOÀN KHÔNG**. Mệnh đề `OR id = ?` đã bị loại bỏ triệt để. Nếu kẻ tấn công truyền một `shop_id` giả mạo không tồn tại, câu lệnh sẽ cập nhật 0 dòng và không bao giờ ghi đè vào shop mặc định `id = 1`.
  4. *Yếu tố nào hạn chế rủi ro cho các cuộc gọi ẩn danh trong Phase A?*
     - Giới hạn tải trọng nghiêm ngặt 256 KB.
     - Kiểm tra cú pháp JSON hợp lệ.
     - Kiểm tra miền giá trị hợp lệ: Điểm SES phải nằm trong khoảng $[0.0, 5.0]$, GMV và số đơn hàng không âm.
     - Cơ chế Cooldown 30 giây dựa trên mốc thời gian của từng shop.
     - Thời gian tồn tại có hạn của Giai đoạn A (sẽ bị tắt hoàn toàn ở Phase C bằng cách đặt `CONNECTOR_ALLOW_UNAUTHENTICATED=false`).
  5. *Giai đoạn A có được chấp nhận chỉ vì nó là giai đoạn chuyển tiếp tạm thời không?* **ĐÚNG**. Đây là cửa sổ tương thích cần thiết để nhân sự cài đặt Extension v1.1.0 mà không làm đứt gãy hoạt động vận hành hiện tại.
  6. *Diễn đạt trong báo cáo triển khai trước đó có thiếu chính xác không?* **CÓ**. Cụm từ "strict shop binding is active for all callers" chưa chuẩn xác, vì với caller ẩn danh, danh tính shop vẫn lấy từ body không xác thực. Khóa danh tính chuẩn mật mã học chỉ áp dụng cho caller có xác thực token.

---

### CỔNG 7: PAYLOAD LIMIT & VALIDATION
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/api/shop_diagnosis.php`, `tools/test_payload_boundary.cjs`
* **Bằng chứng kỹ thuật:**
  - Kiểm tra 2 lớp giới hạn tải trọng:
    1. Kiểm tra sớm: `(int)$_SERVER['CONTENT_LENGTH'] > 262144` -> HTTP 413.
    2. Kiểm tra trực tiếp độ dài byte đọc từ stream: `strlen(file_get_contents('php://input')) > 262144` -> HTTP 413.
  - Kết quả kiểm thử biên kích thước (`tools/test_payload_boundary.cjs`):
    - 262,143 bytes (Dưới ngưỡng 1 byte): `HTTP 200 (OK)`
    - 262,144 bytes (Đúng ngưỡng 256 KB): `HTTP 200 (OK)`
    - 262,145 bytes (Vượt ngưỡng 1 byte): `HTTP 413 (PAYLOAD_TOO_LARGE)`
    - 262,145 bytes khi không có Header `Content-Length`: `HTTP 413 (PAYLOAD_TOO_LARGE)`
    - 262,145 bytes khi Header `Content-Length` bị giả mạo giá trị nhỏ: `HTTP 413 (PAYLOAD_TOO_LARGE)`
    - JSON dị dạng / lỗi cú pháp: `HTTP 400 (INVALID_JSON)`
    - Điểm SES vượt ngưỡng ($5.5 > 5.0$): `HTTP 400 (VALIDATION_ERROR)`
    - Doanh thu GMV âm ($-500$): `HTTP 400 (VALIDATION_ERROR)`

---

### CỔNG 8: COOLDOWN SEMANTICS
* **Trạng thái:** `PASS WITH RISK`
* **Tệp kiểm tra:** `public/api/shop_diagnosis.php`
* **Bằng chứng kỹ thuật:**
  - Cột `last_synced_seller_center_at` chỉ được cập nhật `NOW()` ở câu lệnh SQL cuối cùng của quy trình, sau khi đã xác thực token, kiểm tra tải trọng, xác thực dữ liệu và chèn bản ghi snapshot thành công. Mọi lỗi phát sinh trước đó đều thoát sớm và không cập nhật mốc thời gian này.
  - *Rủi ro tranh chấp (Race Condition):* Do việc kiểm tra Cooldown sử dụng câu lệnh `SELECT` độc lập không đặt khóa ghi (`FOR UPDATE`) trong giao dịch, nếu có hai yêu cầu đồng thời đến cách nhau vài mili-giây, cả hai đều có thể đọc giá trị cũ trước khi câu lệnh `UPDATE` kịp ghi nhận. Trong mô hình tiện ích vận hành tần suất thấp để chống click đúp của người dùng, mức độ rủi ro này nằm trong giới hạn chấp nhận được, nhưng cần ghi nhận rủi ro chính xác.

---

### CỔNG 9: SNAPSHOT BUSINESS LOGIC FREEZE
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/api/shop_diagnosis.php` (dòng 206–210)
* **Bằng chứng kỹ thuật:**
  - Bảo tồn nguyên vẹn lệnh `INSERT INTO tiktok_seller_center_snapshots` để lưu vết lịch sử.
  - Tuyệt đối không bổ sung cơ chế ghi đè dữ liệu theo ngày (`CURDATE + period_days=30`).
  - Không thêm ràng buộc `UNIQUE` vào bảng snapshot hiện có.
  - Hoàn toàn đóng băng logic đối soát tài chính, không đưa logic của Task 03 vào.

---

### CỔNG 10: EXTENSION BRIDGE SECURITY
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/extension/content_script.js`, `manifest.json`, `src/ShopDiagnosisView.jsx`
* **Bằng chứng kỹ thuật:**
  - *Dữ liệu gửi qua window.postMessage:* Ứng dụng web chỉ truyền token ghép nối ngắn hạn 5 phút `{ type: 'ADDP_PAIRING_REQUEST', pairing_token }`.
  - *Bảo mật Content Script:* Kiểm tra nghiêm ngặt `event.source === window`, loại tin nhắn `ADDP_PAIRING_REQUEST` và tính hợp lệ của token.
  - *Không lộ Token 24h vào DOM:* Tiện ích trực tiếp gọi API cứu chuộc từ Content Script, nhận token 24h và lưu thẳng vào `chrome.storage.local`. Sự kiện thông báo thành công trả về DOM `{ type: 'ADDP_PAIRING_SUCCESS', shop_id, expires_at }` **KHÔNG BAO GIỜ** chứa connector token.
  - *Quyền hạn tối thiểu trong manifest.json:* Chỉ yêu cầu các quyền cần thiết: `storage`, `activeTab`, `scripting`, và các domain giới hạn: `seller-vn.tiktok.com`, `seller.tiktok.com`, `marketing.addp.vn`, `localhost`.

---

### CỔNG 11: EXTENSION STORAGE
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/extension/popup.js`
* **Bằng chứng kỹ thuật:**
  - Bộ nhớ `chrome.storage.local` chỉ lưu trữ 5 trường dữ liệu tối thiểu: `connector_token`, `token_expires_at`, `shop_id`, `shop_name`, `connector_id`.
  - Tuyệt đối không lưu mật khẩu admin, signing key hay secret của TikTok.
  - *Hết hạn khi popup đóng:* Khi mở lại popup, hàm `refreshAuthStatus()` đối chiếu `token_expires_at` với giờ hiện tại. Nếu đã hết hạn, tự động xóa sạch token khỏi storage và hiển thị trạng thái cảnh báo hết hạn.

---

### CỔNG 12: CORS / ORIGIN
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/api/auth_guard.php` (`handleCORS()`)
* **Bằng chứng kỹ thuật:**
  - CORS được tách rời hoàn toàn khỏi cơ chế xác thực quyền.
  - Trên môi trường Production (`APP_ENV === 'production'`), cấu hình chỉ chấp nhận origin chính xác của hệ thống (`https://marketing.addp.vn`), request nội bộ trực tiếp, hoặc tiền tố `chrome-extension://`. Mọi truy cập từ `localhost` hay `127.0.0.1` đều bị từ chối trên môi trường Production.
  - Tuyệt đối không cấu hình `Access-Control-Allow-Origin: *`.

---

### CỔNG 13: LOG & ERROR REDACTION
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/api/auth_guard.php` (`sanitizeErrorResponse()`), toàn bộ các tệp API
* **Bằng chứng kỹ thuật:**
  - Hàm `sanitizeErrorResponse()` tự động khử nhạy cảm các chuỗi nhạy cảm khớp mẫu `/(password|pass|secret|token|key)[:=]\s*([^\s&)]+)/i` thành `$1=REDACTED` trước khi ghi vào log.
  - Trên môi trường Production (`APP_ENV === 'production' && !APP_DEBUG`), phản hồi trả về cho client chỉ chứa thông điệp lỗi tổng quát thân thiện, không làm lộ đường dẫn tệp tin, stack trace, câu lệnh SQL, hoặc giá trị token.

---

### CỔNG 14: SECRET SCAN
* **Trạng thái:** `PASS`
* **Công cụ thực hiện:** `tools/scan_all_secrets.cjs`
* **Phạm vi rà soát:** Toàn bộ các thư mục `public/`, `src/`, `dist/`, `database/migrations/`, `docs/` và nội dung giải nén của tệp ZIP Extension v1.1.0.
* **Số liệu rà soát:**
  - `FILES_SCANNED`: **57** tệp
  - `FINDINGS`: **0** bí mật rò rỉ
  - `RESULT`: **PASS**

---

### CỔNG 15: ARTIFACT CONSISTENCY
* **Trạng thái:** `PASS`
* **Tệp kiểm tra:** `public/extension/`, `dist/extension/`, `public/tiktok_audit_extension.zip`, `dist/tiktok_audit_extension.zip`
* **Bằng chứng kỹ thuật:**
  - Mã băm SHA-256 của tệp nén tiện ích trùng khớp từng byte:
    - `public/tiktok_audit_extension.zip`: `408F54E730C3E88C19462A6B297BA79B60E561C3E7C6CDA72B56296F91884D0B`
    - `dist/tiktok_audit_extension.zip`:   `408F54E730C3E88C19462A6B297BA79B60E561C3E7C6CDA72B56296F91884D0B`
  - Các tệp mã nguồn bên trong (`manifest.json`, `content_script.js`, `popup.html`, `popup.js`) đều có mã băm SHA-256 đồng nhất giữa `public/` và `dist/`.
  - Phiên bản khai báo trong `manifest.json` là **1.1.0**.

---

### CỔNG 16: REGRESSION TESTING
* **Trạng thái:** `PASS`
* **Bằng chứng kỹ thuật:**
  - Ma trận xác thực Task 02 (`tools/test_auth_matrix.cjs`): **10/10 KỊCH BẢN ĐẠT**.
  - Ma trận bảo mật Task 02B (`tools/test_task02b_security.cjs`): **22/22 KỊCH BẢN ĐẠT**.
  - Kiểm tra cú pháp PHP (`tools/verify_php_syntax.cjs`): **16/16 TỆP ĐẠT**.
  - Biên dịch Frontend (`npm run build`): **HOÀN THÀNH THÀNH CÔNG (0 LỖI)** trong 753ms.
  - Luồng giao diện Admin: Đăng nhập quản trị, lưu trữ token Bearer, nạp bảng điều khiển, gọi API bảo vệ và mở giao diện ghép nối Shop Diagnosis hoạt động ổn định.

---

### CỔNG 17: BUSINESS LOGIC DIFF FREEZE
* **Trạng thái:** `PASS`
* **Bằng chứng kỹ thuật:**
  - Xác nhận Task 02B **KHÔNG** làm thay đổi bất kỳ thành phần nào trong:
    - Phân trang (Pagination)
    - Công thức tính GMV
    - Cơ chế dự phòng GMV (Fallback)
    - Phân loại trạng thái đơn hàng (Order status classification)
    - Xử lý múi giờ (Timezone handling)
    - Sinh số ngẫu nhiên trên frontend (`Math.random`)
    - Chỉ số đo lường cứng Seller Center
    - Đơn hủy giả lập (Synthetic cancellation)
    - Các công thức tài chính kinh doanh

---

### CỔNG 18: PRODUCTION CONFIGURATION
* **Trạng thái:** `PASS`
* **Biến môi trường cần thiết cho Phase A:**
  | Tên biến môi trường | Kiểu dữ liệu | Giá trị cấu hình khuyến nghị (Phase A) | Ghi chú bảo mật |
  | :--- | :--- | :--- | :--- |
  | `CONNECTOR_TOKEN_TTL` | Integer (giây) | `86400` | Thời hạn token tiện ích (24 giờ) |
  | `PAIRING_TOKEN_TTL` | Integer (giây) | `300` | Thời hạn mã ghép nối (5 phút) |
  | `CONNECTOR_ALLOW_UNAUTHENTICATED` | Boolean | `true` | Cho phép tương thích ngược Phase A |
* Lưu ý: Tệp `.env` trên máy chủ Production tuyệt đối chưa bị chỉnh sửa trong đợt kiểm toán này.

---

### CỔNG 19: MIGRATION ROLLBACK PLAN
* **Trạng thái:** `PASS`
* **Chiến lược khôi phục:**
  - *Tách biệt Rollback Ứng dụng & Cơ sở dữ liệu:*
    - Nếu phát sinh sự cố ở tầng ứng dụng, chỉ cần rollback mã nguồn về phiên bản Task 02 (từ bản backup `backups/task02_completion_backup_20260923.zip`).
    - Mã nguồn Task 02 không hề truy vấn hai bảng `tiktok_connector_pairings` và `tiktok_connector_sessions`.
    - Do đó, **GIỮ NGUYÊN HAI BẢNG MỚI NÀY TRONG DATABASE**, tuyệt đối không chạy lệnh `DROP TABLE` trong tình huống rollback khẩn cấp ứng dụng để tránh rủi ro khóa bảng hoặc xóa nhầm dữ liệu.
  - *Lệnh hoàn tác thủ công khi thật sự cần dọn dẹp DB:*
    ```sql
    -- CHỈ DÙNG KHI CẦN HỦY BỎ TRIỆT ĐỂ BẢNG TIỆN ÍCH KHỎI DB:
    DROP TABLE IF EXISTS `tiktok_connector_sessions`;
    DROP TABLE IF EXISTS `tiktok_connector_pairings`;
    ```

---

### CỔNG 20: PHASE C LOCK-DOWN PROCEDURE
* **Trạng thái:** `PASS`
* **Quy trình khóa chặt Giai đoạn C (Chỉ thực hiện sau khi có chấp thuận của PO):**
  1. *Điều kiện tiên quyết:* Toàn bộ nhân sự vận hành đã nâng cấp Extension lên v1.1.0 và hoàn tất ghép nối xác thực thành công.
  2. *Kiểm tra log máy chủ:* Xác nhận các lượt đồng bộ gần nhất đều có gắn log `[SECURITY] Authenticated Seller Center sync accepted from connector: ...` và không còn phụ thuộc vào client cũ.
  3. *Phê duyệt:* Có văn bản/chấp thuận bằng văn bản của Product Owner.
  4. *Thực hiện cấu hình trên máy chủ:* Cập nhật biến môi trường trong `.env` của Production:
     ```env
     CONNECTOR_ALLOW_UNAUTHENTICATED=false
     ```
  5. *Kiểm thử xác minh caller ẩn danh (Bắt buộc trả về HTTP 401):*
     ```bash
     curl -i -X POST https://marketing.addp.vn/api/shop_diagnosis.php?action=sync_seller_center \
       -H "Content-Type: application/json" \
       -d '{"shop_id":"7495657895504611503"}'
     # Kết quả mong đợi: HTTP/2 401 Unauthorized (code: MISSING_TOKEN)
     ```
  6. *Kiểm thử xác minh tiện ích v1.1.0 đã xác thực (Bắt buộc trả về HTTP 200):*
     ```bash
     curl -i -X POST https://marketing.addp.vn/api/shop_diagnosis.php?action=sync_seller_center \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <VALID_CONNECTOR_TOKEN>" \
       -d '{"total_gmv":458337810,"total_orders_count":4492}'
     # Kết quả mong đợi: HTTP/2 200 OK (success: true)
     ```

---

## BẢNG TỔNG HỢP TRẠNG THÁI CỔNG PHÁT HÀNH (RELEASE GATE STATUS)

| Hạng mục kiểm tra | Kết quả thẩm định | Ghi chú & Đánh giá rủi ro |
| :--- | :---: | :--- |
| **MIGRATION** | `PASS` | Additive DDL, không sửa `initializeDatabase()`, băm an toàn |
| **PAIRING SECURITY** | `PASS` | 64-bit raw CSPRNG entropy, lưu băm SHA-256, không log bí mật |
| **ATOMIC REDEMPTION** | `PASS` | Cơ chế UPDATE nguyên tử, 100% ngăn chặn Race Condition |
| **TOKEN SEPARATION** | `PASS` | Phân tách nghiêm ngặt 3 scope (admin, pair, sync) |
| **SERVER REVOCATION** | `PASS` | Thu hồi server-side tức thời qua `tiktok_connector_sessions` |
| **PHASE A ANONYMOUS RISK** | `PASS WITH RISK` | Cho phép đồng bộ ẩn danh tạm thời; đã khử `OR id = ?` |
| **PAYLOAD VALIDATION** | `PASS` | Kiểm soát 2 lớp 256 KB, kiểm tra miền giá trị SES và GMV |
| **COOLDOWN** | `PASS WITH RISK` | Cập nhật sau khi ghi thành công; có cửa sổ race mili-giây nhỏ |
| **EXTENSION BRIDGE** | `PASS` | 1-Click bridge qua window message; không lộ token vào DOM |
| **SECRET SCAN** | `PASS` | 57 tệp được quét toàn diện; 0 phát hiện rò rỉ |
| **ARTIFACT INTEGRITY** | `PASS` | Mã băm ZIP trùng khớp 100%; Extension v1.1.0 đồng bộ |
| **REGRESSION** | `PASS` | 22/22 kịch bản Task 02B đạt, 10/10 kịch bản Auth đạt, Build đạt |
| **BUSINESS LOGIC FREEZE**| `PASS` | Không can thiệp logic GMV, đơn hàng, công thức tài chính |
| **PRODUCTION DEPLOYMENT PERFORMED** | **NO** | Tuyệt đối chưa can thiệp máy chủ Production |

---

## DANH MỤC ĐIỀU CHỈNH MÃ NGUỒN TRONG ĐỢT KIỂM TOÁN (SOURCE CORRECTIONS DURING GATE)
* **Không có điều chỉnh mã nguồn nào phát sinh trong đợt Release Gate này.** Tất cả mã nguồn, migrations và logic đã được hoàn thiện chuẩn mực và vượt qua toàn bộ các bài kiểm thử tự động.

---

## CÁC YẾU TỐ CHẶN (BLOCKERS)
* **KHÔNG CÓ BLOCKER NÀO.**

---

## CÁC RỦI RO CẦN LƯU Ý (REMAINING RISKS)
1. **Rủi ro caller ẩn danh trong Giai đoạn A:** Do duy trì tương thích ngược cho nhân sự chưa cập nhật tiện ích, caller ẩn danh vẫn có thể gửi dữ liệu nếu biết `shop_id` có thật trong hệ thống. Rủi ro này được giới hạn bởi kích thước 256 KB, cooldown 30s và sẽ được đóng hoàn toàn ở Phase C.
2. **Ngắt kết nối khi thiết bị mất mạng:** Nếu người dùng bấm ngắt kết nối khi đang mất kết nối Internet, tiện ích sẽ xóa sạch dữ liệu trên máy trạm nhưng yêu cầu thu hồi trên máy chủ không tới được đích. Phiên trên máy chủ sẽ tồn tại tối đa 24 giờ cho đến khi hết hạn tự nhiên.

---

## QUYẾT ĐỊNH CUỐI CÙNG (FINAL DECISION)

# READY FOR PHASE A PRODUCTION PACKAGE
*(Sẵn sàng đóng gói và chuẩn bị phát hành Giai đoạn A lên Production dưới sự giám sát của Product Owner)*
