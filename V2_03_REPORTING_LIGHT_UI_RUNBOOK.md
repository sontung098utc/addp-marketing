# SPRINT V2-03: TIKTOK SHOP DATE RANGE REPORTING + LIGHT UI RUNBOOK

## 1. Mục Tiêu & Tổng Quan
Bản phát hành V2-03 tập trung vào ưu tiên số 1 của hệ thống **ADDP Commerce Intelligence** (`marketing.addp.vn`):
- **Báo Cáo TikTok Shop Theo Khoảng Thời Gian (P0):** Cho phép người quản lý chọn bất kỳ khoảng thời gian nào (`start_date` → `end_date`) và ngay lập tức xem đầy đủ, chuẩn xác các chỉ số Doanh số kinh doanh và Hiệu quả quảng cáo GMV Max.
- **Light Business Analytics UI:** Chuyển đổi toàn diện giao diện từ phong cách dark/cyberpunk sang giao diện sáng chuyên nghiệp, chuẩn mực quản trị kinh doanh hằng ngày.

---

## 2. Kiến Trúc & Source of Truth Của Từng KPI

| KPI | Ý nghĩa nghiệp vụ | Nguồn Authoritative (Source of Truth) | Công thức / Quy tắc tính toán |
| :--- | :--- | :--- | :--- |
| **Doanh số (Shop Gross Sales)** | Tổng giá trị đơn hàng phát sinh trong khoảng thời gian được chọn | `commerce_orders` (cấp đơn hàng) | `SUM(order_gross_amount)` với `platform_created_at >= start_dt AND platform_created_at <= end_dt` |
| **Doanh số thực (Realized Sales)** | Doanh số còn lại sau hủy và hoàn | `commerce_orders` & `commerce_loss_ledger` | `Doanh số - Hủy - Hoàn` (Luật kiểm toán `MATURED_LIFECYCLE`) |
| **Hủy + Hoàn (Loss Value)** | Tổng giá trị thất thoát | `commerce_loss_ledger` | `SUM(loss_amount)` cho `CANCELLATION` + `RETURN_REFUND` |
| **Tỷ lệ Hủy + Hoàn** | Tỷ lệ thất thoát trên doanh số | Calculation Engine | `(Hủy + Hoàn) / Doanh số × 100` |
| **Product GMV Max Cost** | Chi phí quảng cáo GMV Max sản phẩm | `commerce_ads_campaign_daily` | `SUM(spend)` với `promotion_type = 'PRODUCT'` |
| **Product GMV Max Revenue** | Doanh số từ GMV Max sản phẩm | `commerce_ads_campaign_daily` | `SUM(gross_revenue)` với `promotion_type = 'PRODUCT'` |
| **Product GMV Max ROI** | Hiệu quả quảng cáo sản phẩm | Calculation Engine | `Product Gross Revenue / Product Cost` |
| **LIVE GMV Max Cost** | Chi phí quảng cáo LIVE GMV Max | `commerce_ads_campaign_daily` | `SUM(spend)` với `promotion_type = 'LIVE'` |
| **LIVE GMV Max Revenue** | Doanh số từ LIVE GMV Max | `commerce_ads_campaign_daily` | `SUM(gross_revenue)` với `promotion_type = 'LIVE'` |
| **LIVE GMV Max ROI** | Hiệu quả quảng cáo LIVE | Calculation Engine | `LIVE Gross Revenue / LIVE Cost` |
| **Tổng Chi Phí Ads** | Tổng tiền quảng cáo toàn kỳ | `commerce_ads_campaign_daily` | `Product Cost + LIVE Cost` (Tuyệt đối không cộng hạ tầng Creative/Product fact) |
| **Tổng Doanh Số Ads** | Doanh số phân bổ từ quảng cáo | `commerce_ads_campaign_daily` | `Product Ads Revenue + LIVE Ads Revenue` |
| **ROI Ads Tổng** | Tỷ suất hoàn vốn quảng cáo | Calculation Engine | `Tổng Ads Revenue / Tổng Ads Cost` |
| **Độ phủ dữ liệu (Coverage)** | Mức độ đầy đủ của kỳ báo cáo | Daily Distinct Dates Audit | `requested_days`, `available_days`, `missing_days`, `coverage_pct`, `status` (`COMPLETE` / `PARTIAL` / `NOT_AVAILABLE`) |

> **Nguyên tắc bảo toàn dữ liệu:**
> - **Missing != Zero:** Dữ liệu thiếu trong kỳ không được gán bằng 0 và không tự tiện ngoại suy. Nếu kỳ chỉ có 17/20 ngày, hệ thống gắn cờ `PARTIAL (85%)` và thông báo rõ ràng cho người quản trị.
> - **Zero Double Count:** Không cộng gộp số liệu từ `commerce_ads_product_daily` hay `commerce_ads_creative_daily` vào KPI tổng của chiến dịch.

---

## 3. Dataset Chuẩn Kỳ Acceptance (01/09/2026 → 20/09/2026)
Kết quả tính toán thực tế qua `CommerceReportingService`:
- **Doanh số Shop:** `272.135.230 đ` (3.800 đơn)
- **Doanh số thực:** `217.848.038 đ` (Tỷ lệ thực nhận: ~80.05%)
- **Hủy + Hoàn:** `54.287.192 đ` (Tỷ lệ thất thoát: ~19.95%)
  - Hủy đơn: `45.000.000 đ`
  - Hoàn tiền/Hoàn hàng: `9.287.192 đ`
- **Product GMV Max:** 62 chiến dịch | Chi phí: `14.567.279 đ` | Doanh số Ads: `173.726.913 đ` | Đơn Ads: `2.583` | ROI: `11.93x`
- **LIVE GMV Max:** 280 chiến dịch | Chi phí: `6.931.324 đ` | Doanh số Ads: `78.901.865 đ` | Đơn Ads: `1.064` | ROI: `11.38x`
- **Tổng Quảng Cáo:** 342 chiến dịch | Chi phí: `21.498.603 đ` | Doanh số Ads: `252.628.778 đ` | Đơn Ads: `3.647` | ROI: `11.75x`
- **Độ phủ dữ liệu Ads:** `20/20 ngày` ● `COMPLETE` (100%)

---

## 4. Các Tệp Tin Thay Đổi (Files Changed)
1. `public/api/commerce_reporting_service.php` (Mới) — Lớp service hợp nhất tính toán báo cáo kinh doanh và quảng cáo theo kỳ.
2. `public/api/commerce_report.php` (Mới) — REST Endpoint GET độc lập xác thực JWT trả dữ liệu báo cáo chuẩn kỳ.
3. `public/api/commerce_dashboard.php` — Đăng ký Action 20 (`get_commerce_report` / `get_period_report`) và hỗ trợ linh hoạt tham số `campaign_type` / `type`.
4. `src/CommerceReportView.jsx` (Mới) — Màn hình báo cáo khoảng thời gian chuyên dụng chuẩn Light UI (Sections I - VI).
5. `src/CommerceDashboardView.jsx` — Tái cấu trúc navigation phân cấp theo Section XI, mount `CommerceReportView` làm tab ưu tiên P0 (`subTab === 'report'`), chuẩn hóa phân loại chiến dịch `PRODUCT` / `LIVE`, nullish coalescing cho các bảng SPU / Creative.
6. `src/index.css` — Chuyển đổi toàn bộ biến giao diện sang Light Business Analytics Theme (`#f8fafc`, `#ffffff`, `#0f172a`, `#e2e8f0`).
7. `src/App.css` — Tinh chỉnh các thành phần bảng biểu, card, modal, status indicators theo Light UI.
8. `dist/` — Bundle frontend production đã được biên dịch hoàn chỉnh qua `npm run build` (máy chủ production không cần chạy build).
9. `tools/test_v2_03_reporting_and_light_ui.cjs` (Mới) — Bộ kiểm thử tự động 19 kịch bản kiểm tra toàn diện 18 yêu cầu trong Section XVIII.

---

## 5. Hướng Dẫn Triển Khai (Deployment Commands)
> **LƯU Ý:** Không yêu cầu cài đặt Node.js, npm hay chạy `npm run build` trên máy chủ production. Gói phát hành đã chứa sẵn thư mục `dist/` hoàn chỉnh.

### Bước 1: Sao lưu trước khi cập nhật
```bash
BACKUP_DIR="/var/backups/addp_pre_v2_03_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r /var/www/marketing.addp.vn/public/api "$BACKUP_DIR/api"
cp -r /var/www/marketing.addp.vn/dist "$BACKUP_DIR/dist"
```

### Bước 2: Giải nén gói phát hành
```bash
unzip -o task_v2_03_reporting_light_ui_release_<timestamp>.zip -d /var/www/marketing.addp.vn/
```

### Bước 3: Phân quyền tệp tin
```bash
chown -R www-data:www-data /var/www/marketing.addp.vn/public/api /var/www/marketing.addp.vn/dist
chmod -R 755 /var/www/marketing.addp.vn/public/api /var/www/marketing.addp.vn/dist
```

### Bước 4: Kiểm tra cú pháp PHP & kiểm thử
```bash
php -l /var/www/marketing.addp.vn/public/api/commerce_reporting_service.php
php -l /var/www/marketing.addp.vn/public/api/commerce_report.php
php -l /var/www/marketing.addp.vn/public/api/commerce_dashboard.php
```

---

## 6. Hướng Dẫn Rollback (Rollback Commands)
Nếu cần khôi phục lại trạng thái phiên bản trước:
```bash
# Khôi phục từ thư mục backup
cp -r "$BACKUP_DIR/api/"* /var/www/marketing.addp.vn/public/api/
cp -r "$BACKUP_DIR/dist/"* /var/www/marketing.addp.vn/dist/
chown -R www-data:www-data /var/www/marketing.addp.vn/public/api /var/www/marketing.addp.vn/dist
```
Kế hoạch rollback hoàn toàn an toàn và không gây mất mát dữ liệu cơ sở dữ liệu.
