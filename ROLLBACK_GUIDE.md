# ROLLBACK GUIDE — P0 COMMERCE INTELLIGENCE
**Mục tiêu:** Khôi phục hệ thống về trạng thái trước khi triển khai nếu phát sinh sự cố nghiêm trọng.  
**Nguyên tắc cốt lõi:** **STRICTLY ZERO DROP TABLE TRÊN CƠ SỞ DỮ LIỆU SẢN XUẤT**.  

---

## 1. QUY TRÌNH ROLLBACK CƠ SỞ DỮ LIỆU (KHÔNG PHÁ HỦY DỮ LIỆU)

Cả hai kịch bản rollback:
- `migrations/20261009_021_rollback_commerce_affiliate_orders.sql`
- `migrations/20261009_022_rollback_commerce_product_costs.sql`
được thiết kế bằng Stored Procedure an toàn:
- **Tuyệt đối không sử dụng `DROP TABLE`**.
- Nếu bảng tồn tại, hệ thống thực hiện lệnh `RENAME TABLE` đổi tên bảng thành:
  - `commerce_affiliate_orders_arch_YYYYMMDD_HHMMSS`
  - `commerce_product_costs_arch_YYYYMMDD_HHMMSS`
- Toàn bộ dữ liệu thu thập được lưu trữ cô lập an toàn, sẵn sàng đối soát khi cần thiết.

### Thực thi rollback database:
```bash
mysql -u [USER] -p[PASSWORD] [DB_NAME] < migrations/20261009_021_rollback_commerce_affiliate_orders.sql
mysql -u [USER] -p[PASSWORD] [DB_NAME] < migrations/20261009_022_rollback_commerce_product_costs.sql
```

---

## 2. QUY TRÌNH ROLLBACK MÃ NGUỒN WEBROOT

Khôi phục lại mã nguồn từ bản sao lưu được tạo ở Bước 1 của [DEPLOYMENT_GUIDE.md](file:///c:/AdsTiktok/release/DEPLOYMENT_GUIDE.md):

```bash
cd /path/to/public_html
# Xóa các asset mới biên dịch
rm -rf assets/
# Giải nén lại bản sao lưu
tar -xzvf /path/to/backup/public_html_backup_[TIMESTAMP].tar.gz -C .
```

---

## 3. XÁC NHẬN SAU ROLLBACK
1. Kiểm tra website `marketing.addp.vn` tải bình thường.
2. Kiểm tra các bảng đã được đổi tên thành `_arch_*` an toàn:
```sql
SHOW TABLES LIKE '%commerce_%_arch_%';
```
