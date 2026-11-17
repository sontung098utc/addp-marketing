# QUY TRÌNH TRIỂN KHAI PRODUCTION (DEPLOYMENT GUIDE)

**Tên gói phát hành:** `marketing_addp_p0_webhook_database_first_final_release.zip`  
**Hệ thống:** `https://marketing.addp.vn`  
**Thư mục Webroot trên máy chủ:** `/home/[user]/public_html/` (hoặc tương đương)  

---

## 1. Kiểm tra trước khi triển khai (Pre-Flight Checks)

### A. Xác thực tính toàn vẹn của tệp ZIP
Trước khi tải lên máy chủ, kiểm tra mã băm SHA-256 đối chiếu với `SHA256SUMS.txt`:
```bash
sha256sum marketing_addp_p0_webhook_database_first_final_release.zip
# Mã băm kỳ vọng:
# 4d52f5734021a8ca3967c75560b2b89704020699c49fcb13a3a17151d370bd46
```

### B. Sao lưu (Backup) thư mục Webroot và Database hiện tại
```bash
# 1. Sao lưu webroot
tar -czf /backup/marketing_addp_webroot_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /home/[user]/public_html .

# 2. Sao lưu database
mysqldump -u [DB_USER] -p[DB_PASS] [DB_NAME] > /backup/marketing_addp_db_backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 2. Các bước triển khai chi tiết (Deployment Steps)

### Bước 1: Áp dụng Migration Cơ sở dữ liệu
Thực hiện chạy 4 migration theo đúng thứ tự trong `MIGRATION_GUIDE.md`:
1. `20261005_016_create_commerce_sync_jobs.sql`
2. `20261009_021_create_commerce_affiliate_orders.sql`
3. `20261009_022_create_commerce_product_costs.sql`
4. `20261010_023_create_commerce_webhook_events_and_indexes.sql`

### Bước 2: Tải lên và giải nén gói ZIP vào Webroot
Tải tệp `marketing_addp_p0_webhook_database_first_final_release.zip` lên máy chủ và giải nén trực tiếp vào thư mục webroot:
```bash
unzip -o marketing_addp_p0_webhook_database_first_final_release.zip -d /home/[user]/public_html/
```
*Lưu ý: Gói ZIP đã được cấu trúc phẳng tương đối với webroot. Tệp `api/db.php` và `api/config.php` trên máy chủ sẽ được bảo toàn tuyệt đối không bị ghi đè.*

### Bước 3: Phân quyền tệp (File Permissions)
```bash
find /home/[user]/public_html -type f -exec chmod 644 {} \;
find /home/[user]/public_html -type d -exec chmod 755 {} \;
chmod +x /home/[user]/public_html/tools/sync_worker_cli.php
```

---

## 3. Nghiệm thu & Kiểm tra chức năng sau triển khai (Post-Deployment Verification)

1. **Kiểm tra Health Endpoint:**
   Truy cập `https://marketing.addp.vn/api/health.php`  
   Kết quả kỳ vọng: HTTP 200 `{"status":"HEALTHY","db":"CONNECTED"}`.

2. **Kiểm tra Schema Endpoint:**
   Truy cập `https://marketing.addp.vn/api/verify_v2_schema.php`  
   Kết quả kỳ vọng: Tất cả các bảng Commerce V2 và Webhook Inbox đều đạt trạng thái `READY`.

3. **Kiểm tra Webhook Receiver:**
   Gửi yêu cầu GET thử nghiệm đến `https://marketing.addp.vn/api/webhook.php`  
   Kết quả kỳ vọng: HTTP 200 `{"success":true,"message":"TikTok Shop Webhook Endpoint Ready (POST only)"}`.

4. **Kiểm tra Giao diện Dashboard (Database-First):**
   - Đăng nhập vào dashboard.
   - Thay đổi bộ lọc khoảng ngày (ví dụ: "7 ngày qua", "30 ngày qua", "Tháng này").
   - **Xác nhận tốc độ:** Dữ liệu hiển thị ngay lập tức trong < 200ms từ MariaDB. Không còn vòng xoay chờ đợi 15 phút.
   - **Xác nhận nhãn nguồn:** Huy hiệu hiển thị `✅ NGUỒN: TỔNG HỢP NGÀY (DATABASE)` hoặc `⚡ NGUỒN: TẠM TÍNH HÔM NAY (T-0)`. Tuyệt đối không còn hiển thị `⚠️ LIVE FALLBACK`.
