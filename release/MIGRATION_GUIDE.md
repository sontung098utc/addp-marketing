# HƯỚNG DẪN MIGRATION CƠ SỞ DỮ LIỆU: P0 FINAL RELEASE

**Hệ thống đích:** MariaDB 10.5+ / MySQL 8.0+  
**Website:** `https://marketing.addp.vn`  
**Database:** Production Database của hệ thống  

---

## 1. Nguyên tắc an toàn Migration (Strict Safety Guarantees)

1. **Không tự động chạy**: Migration chỉ được thực hiện thủ công bởi Database Administrator hoặc kỹ sư phụ trách hạ tầng khi có sự phê duyệt của Product Owner.
2. **Không phá hủy dữ liệu (Additive Only)**: Toàn bộ lệnh DDL sử dụng cú pháp `CREATE TABLE IF NOT EXISTS` và kiểm tra tồn tại của index qua `information_schema.STATISTICS`.
3. **Không dùng DROP TABLE**: Tuyệt đối không xóa bất kỳ bảng dữ liệu đơn hàng hay tài chính hiện có.
4. **Không downtime**: Việc tạo bảng và index diễn ra trực tuyến, không khóa bảng sản xuất.

---

## 2. Thứ tự thực thi Migration (Execution Order)

Để đảm bảo toàn vẹn khóa ngoại và quan hệ dữ liệu, thực thi 4 tệp migration theo thứ tự nghiêm ngặt sau:

### Bước 1: Tạo bảng quản lý tiến trình đồng bộ nền
**Tệp:** `database/migrations/20261005_016_create_commerce_sync_jobs.sql`  
- **Mục đích:** Tạo bảng `commerce_sync_jobs` phục vụ lưu trữ trạng thái tác vụ đồng bộ không đồng bộ, điểm kiểm soát (checkpoint token) và tiến độ phần trăm.
- **Lệnh chạy CLI:**
```bash
mysql -u [DB_USER] -p[DB_PASS] [DB_NAME] < database/migrations/20261005_016_create_commerce_sync_jobs.sql
```

### Bước 2: Tạo bảng lưu trữ đơn hàng Affiliate
**Tệp:** `database/migrations/20261009_021_create_commerce_affiliate_orders.sql`  
- **Mục đích:** Tạo bảng `commerce_affiliate_orders` lưu trữ chi tiết đơn hàng tiếp thị liên kết từ TikTok Open API (loại bỏ tỷ lệ hoa hồng ảo).
- **Lệnh chạy CLI:**
```bash
mysql -u [DB_USER] -p[DB_PASS] [DB_NAME] < database/migrations/20261009_021_create_commerce_affiliate_orders.sql
```

### Bước 3: Tạo bảng cấu hình giá vốn & chi phí sản phẩm
**Tệp:** `database/migrations/20261009_022_create_commerce_product_costs.sql`  
- **Mục đích:** Tạo bảng `commerce_product_costs` lưu trữ COGS, phí sàn, chi phí vận hành cho từng SPU/SKU để tính điểm hòa vốn Break-even ROAS chuẩn xác.
- **Lệnh chạy CLI:**
```bash
mysql -u [DB_USER] -p[DB_PASS] [DB_NAME] < database/migrations/20261009_022_create_commerce_product_costs.sql
```

### Bước 4: Tạo hộp thư sự kiện Webhook & Index tăng tốc truy vấn
**Tệp:** `database/migrations/20261010_023_create_commerce_webhook_events_and_indexes.sql`  
- **Mục đích:**
  - Tạo bảng `commerce_webhook_events` (Durable Inbox) ghi nhận toàn bộ sự kiện webhook từ TikTok, hỗ trợ chống trùng (deduplication) và kiểm toán.
  - Tạo composite index tăng tốc độ truy vấn báo cáo theo ngày và giảm tải CPU cho MariaDB:
    - `idx_loss_plat_shop_persp_eff` trên `commerce_loss_ledger`
    - `idx_items_plat_shop_prod` trên `commerce_order_items`
    - `idx_orders_plat_shop_updated` trên `commerce_orders`
- **Lệnh chạy CLI:**
```bash
mysql -u [DB_USER] -p[DB_PASS] [DB_NAME] < database/migrations/20261010_023_create_commerce_webhook_events_and_indexes.sql
```

---

## 3. Xác thực sau khi chạy Migration (Verification Queries)

Sau khi hoàn tất 4 bước trên, Database Administrator chạy các câu truy vấn kiểm tra sau:

```sql
-- 1. Kiểm tra sự tồn tại của 4 bảng mới
SELECT table_name, engine, table_rows 
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name IN (
    'commerce_sync_jobs',
    'commerce_affiliate_orders',
    'commerce_product_costs',
    'commerce_webhook_events'
  );

-- 2. Kiểm tra các index hiệu năng mới được thêm
SHOW INDEX FROM commerce_loss_ledger WHERE Key_name = 'idx_loss_plat_shop_persp_eff';
SHOW INDEX FROM commerce_order_items WHERE Key_name = 'idx_items_plat_shop_prod';
SHOW INDEX FROM commerce_orders WHERE Key_name = 'idx_orders_plat_shop_updated';
SHOW INDEX FROM commerce_webhook_events WHERE Key_name = 'uq_plat_shop_event';
```

**Kết quả kỳ vọng:** Cả 4 bảng đều xuất hiện với Engine `InnoDB`, và tất cả các index đều ở trạng thái sẵn sàng.
