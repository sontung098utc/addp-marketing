# DEPLOYMENT GUIDE — P0 FINAL CONSOLIDATED RELEASE
**Hệ thống:** `marketing.addp.vn`  
**Mã gói phát hành:** `marketing_addp_p0_final_release.zip`  
**Thời gian triển khai khuyến nghị:** Ngoài giờ cao điểm (Low-traffic window)  
**Yêu cầu quyền hạn:** Quản trị viên hệ thống (Webmaster / DevOps) & DBA  

---

## 1. PHÂN LOẠI FILE THAY ĐỔI TRONG GÓI

### A. Tệp thêm mới hoàn toàn (New Files):
1. `api/commerce_product_cost_service.php` (Dịch vụ tính toán Unit Economics & Break-even ROAS)
2. `migrations/20261009_021_create_commerce_affiliate_orders.sql`
3. `migrations/20261009_021_rollback_commerce_affiliate_orders.sql`
4. `migrations/20261009_022_create_commerce_product_costs.sql`
5. `migrations/20261009_022_rollback_commerce_product_costs.sql`
6. `VERSION.json`

### B. Tệp ghi đè (Modified Files):
1. `api/commerce_affiliate_service.php` (Bỏ hoa hồng cứng, thêm API ingestion)
2. `api/tiktok_client.php` (Endpoint `/affiliate_seller/202410/orders/search`)
3. `api/commerce_sync_orchestrator.php` (Điều phối `DOMAIN_AFFILIATE`)
4. `api/creatives_data.php` (Bỏ 370 dòng mock, kết nối hoàn hủy xác thực)
5. `api/campaigns.php` (Bỏ công thức fake clicks/impressions)
6. `api/commerce_dashboard.php` (Tách Ads ROAS vs Blended LIVE ROAS, endpoints giá vốn)
7. `api/commerce_ads_service.php` (Nhúng giá vốn SPU, tính toán Break-even ROI)
8. `index.html` (Giao diện React biên dịch mới nhất)
9. `assets/*` (CSS và JS bundle sản xuất mới nhất)

### C. Tệp được giữ nguyên tuyệt đối:
- `api/db.php`
- `api/config.php`
- Các file log, session, certs

---

## 2. QUY TRÌNH TRIỂN KHAI 5 BƯỚC AN TOÀN

### Bước 1: Sao lưu thư mục webroot hiện tại
```bash
cd /path/to/public_html
tar -czvf /path/to/backup/public_html_backup_$(date +%Y%m%d_%H%i%s).tar.gz . --exclude="*.log"
```

### Bước 2: Chạy các migration cơ sở dữ liệu
Thực hiện theo hướng dẫn tại [MIGRATION_GUIDE.md](file:///c:/AdsTiktok/release/MIGRATION_GUIDE.md).

### Bước 3: Cập nhật mã nguồn webroot
Giải nén trực tiếp `marketing_addp_p0_final_release.zip` vào thư mục `public_html/`:
```bash
unzip -o marketing_addp_p0_final_release.zip -d /path/to/public_html/
```
*(Do trong ZIP không có `api/db.php` và `api/config.php`, cấu hình kết nối database sản xuất hoàn toàn không bị ảnh hưởng).*

### Bước 4: Phân quyền tệp tin
```bash
find /path/to/public_html -type f -exec chmod 644 {} \;
find /path/to/public_html -type d -exec chmod 755 {} \;
chmod 400 /path/to/public_html/api/config.php /path/to/public_html/api/db.php
```

### Bước 5: Kiểm tra xác nhận sau triển khai (Smoke Tests)
1. **Kiểm tra Tab Affiliate:** Truy cập tab Affiliate, xác nhận không còn nút upload CSV; bấm **Đồng bộ Affiliate API**, nếu chưa cấp quyền trên TikTok Partner Center hệ thống sẽ hiển thị badge cảnh báo `PERMISSION_REQUIRED` an toàn.
2. **Kiểm tra Tab Video:** Xác nhận danh sách video không còn truyện cười mukbang giả lập hay tỷ lệ hủy random.
3. **Kiểm tra Tab LIVE Analytics:** Xác nhận thẻ KPI 12 hiển thị song song `Ads ROAS (Attributed)` và `Blended LIVE ROAS`.
4. **Kiểm tra Tab Product GMV Max:** Xác nhận cột `ROI Hòa Vốn (BEP)`, bấm `+ Thiết lập` mở modal nhập COGS và xem bảng tính live.
