# QUY TRÌNH ROLLBACK AN TOÀN (ROLLBACK GUIDE)

**Áp dụng:** Khi có sự cố bất khả kháng cần đưa hệ thống trở về trạng thái ổn định trước đó.  
**Nguyên tắc:** An toàn dữ liệu tuyệt đối, không làm mất đơn hàng và số liệu kế toán thực tế.

---

## 1. Rollback Frontend & Mã nguồn PHP

Sử dụng bản sao lưu tar.gz đã tạo ở Bước 1.B của quy trình triển khai:

```bash
# 1. Di chuyển mã nguồn hiện tại vào thư mục sự cố để phân tích sau
mv /home/[user]/public_html /home/[user]/public_html_failed_$(date +%Y%m%d_%H%M%S)

# 2. Tạo lại thư mục public_html trống
mkdir -p /home/[user]/public_html

# 3. Phục hồi từ bản sao lưu
tar -xzf /backup/marketing_addp_webroot_backup_[TIMESTAMP].tar.gz -C /home/[user]/public_html/

# 4. Phân quyền lại thư mục
find /home/[user]/public_html -type f -exec chmod 644 {} \;
find /home/[user]/public_html -type d -exec chmod 755 {} \;
```

---

## 2. Rollback Cơ sở dữ liệu (Database Rollback)

Nếu sự cố liên quan đến cơ sở dữ liệu, chạy 4 tệp rollback SQL theo thứ tự ngược lại (từ mới nhất về cũ nhất):

```bash
# 1. Rollback Webhook Events & Indexes
mysql -u [DB_USER] -p[DB_PASS] [DB_NAME] < database/migrations/20261010_023_rollback_create_commerce_webhook_events_and_indexes.sql

# 2. Rollback Product Costs
mysql -u [DB_USER] -p[DB_PASS] [DB_NAME] < database/migrations/20261009_022_rollback_commerce_product_costs.sql

# 3. Rollback Affiliate Orders
mysql -u [DB_USER] -p[DB_PASS] [DB_NAME] < database/migrations/20261009_021_rollback_commerce_affiliate_orders.sql

# 4. Rollback Sync Jobs
mysql -u [DB_USER] -p[DB_PASS] [DB_NAME] < database/migrations/20261005_016_rollback_create_commerce_sync_jobs.sql
```

### Bảo đảm an toàn của Rollback SQL:
- Các tệp rollback **KHÔNG** chứa lệnh `DROP TABLE` đối với các bảng nghiệp vụ cốt lõi (`commerce_orders`, `commerce_order_items`, `commerce_aftersales`, `commerce_loss_ledger`, `tiktok_campaigns`).
- Dữ liệu đơn hàng lịch sử và tài chính được bảo toàn nguyên vẹn 100%.

---

## 3. Kiểm tra xác nhận sau Rollback

1. Truy cập `https://marketing.addp.vn/api/health.php` kiểm tra kết nối CSDL.
2. Đăng nhập hệ thống và kiểm tra khả năng xem lại các báo cáo trước đợt nâng cấp.
