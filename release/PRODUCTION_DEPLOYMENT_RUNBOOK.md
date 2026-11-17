# ADDP COMMERCE INTELLIGENCE
# CẨM NANG TRIỂN KHAI SẢN XUẤT (PRODUCTION DEPLOYMENT RUNBOOK)
## PHIÊN BẢN: COMMERCE INTELLIGENCE V2 (HF1.2 → HF1.5 CONSOLIDATED)

====================================================================
MÔI TRƯỜNG MỤC TIÊU:   Server Sản Xuất Hostinger Linux (`marketing.addp.vn`)
NGƯỜI THỰC HIỆN:       Product Owner (Triển khai thủ công / Zero-Risk)
CƠ CHẾ AN TOÀN:        Dark Launch (Tất cả cờ tính năng mặc định = false)
NGUYÊN TẮC:            Audit Schema trước khi chạy migration (Không chạy lại migration đã có)
====================================================================

---

## MỤC LỤC 18 BƯỚC TRIỂN KHAI

- **STEP 0 — Preflight Inspection**
- **STEP 1 — Application Backup**
- **STEP 2 — Database Backup**
- **STEP 3 — Release Integrity Verification**
- **STEP 4 — Production Schema Audit (READ-ONLY)**
- **STEP 5 — Required Migration Selection**
- **STEP 6 — Database Migration Execution**
- **STEP 7 — Application & Frontend Deployment**
- **STEP 8 — PHP Syntax & Smoke Test**
- **STEP 9 — HF1.2 Orders API Validation**
- **STEP 10 — HF1.3 RMA & Return/Refund Shadow Validation**
- **STEP 11 — HF1.4 Finance Statements Validation**
- **STEP 12 — HF1.5 Analytics & Livestream Validation**
- **STEP 13 — Dashboard & UI Acceptance**
- **STEP 14 — 5-Way Canonical Metric Reconciliation**
- **STEP 15 — Phased Feature Flag Activation**
- **STEP 16 — Final Production Acceptance**
- **STEP 17 — Rollback Procedure (Zero-Downtime)**

---

### STEP 0 — PREFLIGHT INSPECTION

Đăng nhập SSH vào server production bằng tài khoản người dùng:
```bash
ssh u229648939@marketing.addp.vn
cd /home/u229648939/domains/marketing.addp.vn
```

Kiểm tra dung lượng đĩa và tiến trình web server:
```bash
df -h .
php -v
mysql --version
```
> Yêu cầu: Dung lượng đĩa còn trống $\ge 2$ GB, PHP $\ge 8.1$, MySQL / MariaDB hoạt động bình thường.

---

### STEP 1 — APPLICATION BACKUP

Sao lưu toàn bộ mã nguồn ứng dụng hiện tại trước khi can thiệp:
```bash
mkdir -p /home/u229648939/backups
BACKUP_TS=$(date +%Y%m%d_%H%M%S)

# Sao lưu thư mục API
zip -r /home/u229648939/backups/api_backup_pre_deploy_${BACKUP_TS}.zip public_html/api/

# Sao lưu tài sản giao diện
zip -r /home/u229648939/backups/ui_backup_pre_deploy_${BACKUP_TS}.zip public_html/assets/ public_html/index.html
```

---

### STEP 2 — DATABASE BACKUP

Sao lưu toàn bộ cơ sở dữ liệu production bằng `mysqldump`:
```bash
# Nạp thông tin DB từ file .env
source <(grep -E '^(DB_HOST|DB_USER|DB_PASS|DB_NAME)=' /home/u229648939/domains/marketing.addp.vn/public_html/api/.env | sed 's/^/export /')

# Xuất bản sao lưu DB nén
mysqldump -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME | gzip > /home/u229648939/backups/db_backup_pre_deploy_${BACKUP_TS}.sql.gz

# Xác nhận dung lượng bản backup
ls -lh /home/u229648939/backups/db_backup_pre_deploy_${BACKUP_TS}.sql.gz
```

---

### STEP 3 — RELEASE INTEGRITY VERIFICATION

Tải gói phát hành `task_commerce_v2_consolidated_release_*.zip` lên thư mục root của domain:
```bash
cd /home/u229648939/domains/marketing.addp.vn

# Kiểm tra mã băm SHA-256 đối chiếu với Release Manifest
sha256sum task_commerce_v2_consolidated_release_*.zip
```
> Đối chiếu chuỗi SHA-256 thu được với biên bản phát hành `TASK_COMMERCE_V2_RELEASE_MANIFEST.md`. Nếu không khớp, DỪNG LẠI NGAY.

---

### STEP 4 — PRODUCTION SCHEMA AUDIT (READ-ONLY)

> **CỰC KỲ QUAN TRỌNG:** Migration 005 từng được chạy trên production trong các đợt thử nghiệm trước. Không bao giờ chạy lại mù quáng các file migration!

Giải nén script audit và chạy chế độ kiểm tra chỉ đọc:
```bash
unzip -o task_commerce_v2_consolidated_release_*.zip tools/preflight_schema_audit.php

# Thực thi audit chỉ đọc (100% READ-ONLY)
php tools/preflight_schema_audit.php
```

Xem kết quả hiển thị trên terminal:
- `APPLIED`: Migration đã tồn tại đầy đủ, **BỎ QUA KHÔNG CHẠY LẠI**.
- `NOT_APPLIED`: Migration chưa có, **CẦN CHẠY**.
- `PARTIAL` hoặc `SCHEMA_DRIFT`: Bảng đã tạo một phần hoặc thiếu cột, đối chiếu kỹ chi tiết trước khi áp dụng.

---

### STEP 5 — REQUIRED MIGRATION SELECTION

Dựa trên kết quả Step 4, xác định danh sách các file SQL cần chạy:

1. Nếu `005_aftersales_loss` là `NOT_APPLIED`:
   $\to$ Cần chạy `database/migrations/20261001_005_create_commerce_aftersales_and_events.sql`.
   *(Nếu là `APPLIED`, bỏ qua file này)*.

2. Nếu `006_sync_runs_upgrade` là `NOT_APPLIED`:
   $\to$ Cần chạy `database/migrations/20261001_006_upgrade_commerce_sync_runs.sql`.
   *(Bổ sung cột `source_domain`, mở rộng token `VARCHAR(1024)`)*.

3. Nếu `007_finance_engine` là `NOT_APPLIED`:
   $\to$ Cần chạy `database/migrations/20261001_007_create_commerce_finance_tables.sql`.

4. Nếu `008_analytics_engine` là `NOT_APPLIED`:
   $\to$ Cần chạy `database/migrations/20261001_008_create_commerce_analytics_tables.sql`.

---

### STEP 6 — DATABASE MIGRATION EXECUTION

Giải nén thư mục migrations và chạy các file đã chọn ở Step 5:
```bash
cd /home/u229648939/domains/marketing.addp.vn
unzip -o task_commerce_v2_consolidated_release_*.zip "database/migrations/*"

# Chạy Migration 005 (chỉ khi Step 4 báo NOT_APPLIED)
# mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < database/migrations/20261001_005_create_commerce_aftersales_and_events.sql

# Chạy Migration 006 (nâng cấp commerce_sync_runs)
mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < database/migrations/20261001_006_upgrade_commerce_sync_runs.sql

# Chạy Migration 007 (bảng tài chính & quyết toán)
mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < database/migrations/20261001_007_create_commerce_finance_tables.sql

# Chạy Migration 008 (bảng phân tích shop, live & video)
mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < database/migrations/20261001_008_create_commerce_analytics_tables.sql

# Chạy lại schema audit để xác nhận 100% bảng đã APPLIED
php tools/preflight_schema_audit.php
```

---

### STEP 7 — APPLICATION & FRONTEND DEPLOYMENT

Giải nén toàn bộ mã nguồn backend và bản build frontend:
```bash
cd /home/u229648939/domains/marketing.addp.vn/public_html

# Giải nén mã nguồn release đè lên thư mục web root
unzip -o ../task_commerce_v2_consolidated_release_*.zip

# Sao chép các tệp dist frontend ra web root
cp -rf dist/* .
rm -rf dist

# Đặt quyền tệp an toàn
find api/ -type f -exec chmod 644 {} +
find assets/ -type f -exec chmod 644 {} +
chmod 644 index.html
```

---

### STEP 8 — PHP SYNTAX & SMOKE TEST

Kiểm tra cú pháp PHP ngay trên server production:
```bash
php -l api/config.php
php -l api/tiktok_client.php
php -l api/commerce_sync_service.php
php -l api/commerce_aftersales_service.php
php -l api/commerce_loss_engine.php
php -l api/commerce_finance_service.php
php -l api/commerce_analytics_service.php
php -l api/commerce_dashboard.php
php -l ../tools/runtime_validation_toolkit.php
```
> Tất cả các tệp phải trả về `No syntax errors detected in <file>`.

Kiểm tra Health Endpoint và Auth Guard:
```bash
curl -I https://marketing.addp.vn/api/auth_guard.php
```

---

### STEP 9 — HF1.2 ORDERS API VALIDATION

Chạy kiểm tra dữ liệu đơn hàng bằng Runtime Toolkit [READ-ONLY]:
```bash
cd /home/u229648939/domains/marketing.addp.vn
php tools/runtime_validation_toolkit.php --check=orders --start=2026-09-01 --end=2026-09-20
```
> **Kỳ vọng:** Xác nhận 2,777 đơn hàng và 272,135,230 VND khớp chuẩn 100% với dữ liệu đơn hàng gốc.

---

### STEP 10 — HF1.3 RMA & RETURN/REFUND SHADOW VALIDATION

Chạy kiểm tra dữ liệu Hoàn tiền / Trả hàng [READ-ONLY]:
```bash
php tools/runtime_validation_toolkit.php --check=rma --start=2026-09-01 --end=2026-09-20
```
> **Kỳ vọng:** Xác nhận 4 đơn hoàn tiền chính thức với tổng số tiền 364,800 VND từ RMA Search API.

---

### STEP 11 — HF1.4 FINANCE STATEMENTS VALIDATION

Chạy kiểm tra số liệu bảng kê quyết toán [READ-ONLY]:
```bash
php tools/runtime_validation_toolkit.php --check=finance
```
> **Kỳ vọng:** Xác nhận cấu trúc các cột phí (Platform Commission, Affiliate, Payment Fee, Shipping Subsidy) và kiểm tra phương trình quyết toán.

---

### STEP 12 — HF1.5 ANALYTICS & LIVESTREAM VALIDATION

Chạy kiểm tra dữ liệu phân tích và livestream [READ-ONLY]:
```bash
php tools/runtime_validation_toolkit.php --check=analytics
```
> **Kỳ vọng:** Các chỉ số có giá trị thực hoặc `null` (UNAVAILABLE), tuyệt đối không xuất hiện số liệu giả lập/mock constants.

---

### STEP 13 — DASHBOARD & UI ACCEPTANCE

1. Đăng nhập hệ thống quản trị tại: `https://marketing.addp.vn`
2. Bấm vào mục điều hướng mới trên thanh Sidebar: **"Commerce Intelligence [API V2]"**.
3. Kiểm tra hiển thị đầy đủ 8 Sub-tabs:
   - 📊 **Tổng Quan & Cách Ly 5 Chỉ Số**
   - 💸 **Sổ Cái Hao Hụt & Hoàn/Hủy**
   - 📦 **Quản Lý Đơn Hàng Ingestion (Non-PII)**
   - 🏦 **Tài Chính & Quyết Toán**
   - 🏷️ **Hiệu Suất Sản Phẩm**
   - 🎬 **Báo Cáo Video Bán Hàng**
   - 🎙️ **Bàn Làm Việc Livestream**
   - ⚙️ **Đồng Bộ & Đường Ống API**
4. Thử nghiệm bộ lọc thời gian: chọn preset **"Hadaplus Benchmark (01-20/09)"** và kiểm tra tốc độ phản hồi trang (< 300ms).

---

### STEP 14 — 5-WAY CANONICAL METRIC RECONCILIATION

Chạy đối soát toàn diện 5 nguồn chỉ số:
```bash
php tools/runtime_validation_toolkit.php --check=reconciliation --start=2026-09-01 --end=2026-09-20
```
> **Kỳ vọng:**
> - Invariant check: `Order Gross Value >= Realized Order Value` $\to$ **PASS**
> - Cơ cấu hao hụt thể hiện rõ ràng: Hủy đơn, Boom hàng, Hoàn tiền.

---

### STEP 15 — PHASED FEATURE FLAG ACTIVATION

Sau khi toàn bộ kiểm tra Step 9 đến Step 14 đều PASS, mở lần lượt các cờ tính năng trong `public_html/api/.env`:
```env
# 1. Bật Core Orders Ingestion V2
FEATURE_ENABLE_COMMERCE_V2=true

# 2. Bật Aftersales RMA & Fulfillment Events
FEATURE_ENABLE_AFTERSALES_V2=true
FEATURE_ENABLE_FULFILLMENT_EVENTS_V2=true
FEATURE_ENABLE_LOSS_ENGINE_V2=true

# 3. Bật Finance Statements V2
FEATURE_ENABLE_FINANCE_V2=true

# 4. Bật Shop Analytics & Livestream V2
FEATURE_ENABLE_ANALYTICS_V2=true
```

---

### STEP 16 — FINAL PRODUCTION ACCEPTANCE

1. Chạy kiểm tra PII tổng thể:
   ```bash
   php tools/runtime_validation_toolkit.php --check=pii
   ```
   > Đảm bảo: `Forbidden PII Cols: 0 found`, `Raw Observations Scrubbing: ALL SCRUBBED`.

2. Kiểm tra log lỗi web server xem có bất kỳ exception nào phát sinh:
   ```bash
   tail -n 50 /home/u229648939/logs/error.log
   ```

---

### STEP 17 — ROLLBACK PROCEDURE (ZERO-DOWNTIME)

Nếu phát sinh bất kỳ sự cố kỹ thuật nào ngoài dự kiến:

#### 1. Soft Rollback Tức Thời (< 15 giây, Không gián đoạn dịch vụ):
Sửa file `public_html/api/.env` hoặc tắt ngay trong `api/config.php`:
```env
FEATURE_ENABLE_COMMERCE_V2=false
FEATURE_ENABLE_AFTERSALES_V2=false
FEATURE_ENABLE_FULFILLMENT_EVENTS_V2=false
FEATURE_ENABLE_LOSS_ENGINE_V2=false
FEATURE_ENABLE_FINANCE_V2=false
FEATURE_ENABLE_ANALYTICS_V2=false
```
> Hệ thống ngay lập tức trở về chế độ ban đầu an toàn.

#### 2. Khôi phục Mã Nguồn:
```bash
cd /home/u229648939/domains/marketing.addp.vn/public_html
unzip -o /home/u229648939/backups/api_backup_pre_deploy_${BACKUP_TS}.zip
unzip -o /home/u229648939/backups/ui_backup_pre_deploy_${BACKUP_TS}.zip
```

#### 3. Khôi phục Database (Nếu cần hoàn nguyên bảng):
```bash
cd /home/u229648939/domains/marketing.addp.vn
mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < database/migrations/20261001_008_rollback_commerce_analytics_tables.sql
mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < database/migrations/20261001_007_rollback_commerce_finance_tables.sql
mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME < database/migrations/20261001_006_rollback_commerce_sync_runs.sql
# Lưu ý: Chỉ rollback migration 005 nếu thực sự cần thiết
```
