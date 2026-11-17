# MIGRATION GUIDE — P0 COMMERCE INTELLIGENCE
**Áp dụng cho:** Hệ thống cơ sở dữ liệu MySQL / MariaDB của `marketing.addp.vn`  
**Hai migration độc lập cần chạy:**
1. `20261009_021_create_commerce_affiliate_orders.sql`
2. `20261009_022_create_commerce_product_costs.sql`

---

## 1. NGUYÊN TẮC AN TOÀN BẮT BUỘC
- **Không tự động chạy migration:** Quản trị viên cơ sở dữ liệu (DBA) phải trực tiếp kiểm tra và thực thi thủ công.
- **Không phá hủy dữ liệu:** Migration chỉ thêm mới bảng, không sửa đổi hay xóa bỏ dữ liệu của các bảng hiện hữu (`commerce_orders`, `commerce_order_items`, v.v.).
- **Kiểm tra cấu trúc trước khi áp dụng (Pre-flight Validation):**
  - Cả hai file migration đều sử dụng Stored Procedure tự kiểm tra.
  - Nếu bảng chưa tồn tại: Tạo mới bảng hoàn chỉnh.
  - Nếu bảng đã tồn tại: Kiểm tra toàn bộ 18 cột (Affiliate) hoặc 11 cột (Product Costs) cùng Unique Key bắt buộc.
  - **Nếu bảng đã tồn tại nhưng sai cấu trúc:** Báo lỗi `SIGNAL SQLSTATE '45000'` yêu cầu can thiệp thủ công, tuyệt đối không âm thầm bỏ qua.

---

## 2. QUY TRÌNH THỰC THI CHI TIẾT

### Bước 1: Sao lưu database trước khi thao tác
```bash
mysqldump -u [USER] -p[PASSWORD] [DB_NAME] commerce_orders commerce_order_items > backup_pre_p0_$(date +%Y%m%d).sql
```

### Bước 2: Kiểm tra sự tồn tại của 2 bảng mới
```sql
SELECT TABLE_NAME, TABLE_ROWS 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('commerce_affiliate_orders', 'commerce_product_costs');
```

### Bước 3: Áp dụng migration 021 (Affiliate Orders)
```bash
mysql -u [USER] -p[PASSWORD] [DB_NAME] < migrations/20261009_021_create_commerce_affiliate_orders.sql
```

### Bước 4: Áp dụng migration 022 (Product Costs & Break-even ROAS)
```bash
mysql -u [USER] -p[PASSWORD] [DB_NAME] < migrations/20261009_022_create_commerce_product_costs.sql
```

### Bước 5: Xác nhận cấu trúc sau migration
```sql
-- 1. Xác nhận bảng commerce_affiliate_orders
DESCRIBE commerce_affiliate_orders;
SHOW INDEX FROM commerce_affiliate_orders WHERE Key_name = 'uq_shop_aff_order_sku';

-- 2. Xác nhận bảng commerce_product_costs
DESCRIBE commerce_product_costs;
SHOW INDEX FROM commerce_product_costs WHERE Key_name = 'uq_shop_product_cost';
```
