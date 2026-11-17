# V2-04 RUNBOOK: AUTOMATED DATA SYNCHRONIZATION ENGINE + COMPACT BUSINESS ANALYTICS UI

**Module:** ADDP Commerce Intelligence V2  
**Production Host:** `marketing.addp.vn`  
**Webroot:** `/home/addp/domains/marketing.addp.vn/public_html`  
**Date:** 2026-10-05  
**Version:** V2-04  

---

## 1. MỤC TIÊU & TỔNG QUAN THAY ĐỔI (OVERVIEW)

Sprint V2-04 giải quyết hai bài toán cốt lõi của hệ thống quản trị thương mại:
1. **Automated Incremental Sync Engine (Backend):**
   - Loại bỏ hoàn toàn cơ chế người dùng phải backfill thủ công từng khoảng ngày hoặc bấm chọn ngày trên màn báo cáo rồi hệ thống mới đồng bộ synchronous từ TikTok API.
   - Báo cáo tuân thủ kiến trúc **Database-First**: API TikTok đồng bộ dữ liệu vào MariaDB (`commerce_*`), tất cả các màn báo cáo chỉ đọc từ MariaDB.
   - Động cơ đồng bộ trung tâm `CommerceSyncOrchestrator` quản lý 5 miền dữ liệu cốt lõi (`ORDERS`, `RMA`, `ADS_CAMPAIGN`, `FINANCE`, `ANALYTICS`) cùng các miền mở rộng (`ADS_PRODUCT`, `ADS_CREATIVE`, `ADS_LIVE`, `FULFILLMENT`).
   - Nhận diện an toàn độ trễ xuất bản của TikTok API (`T-1`, `T-2`). Tuyệt đối **không chuyển thiếu dữ liệu thành số 0** (`missing != 0`), không chèn bản ghi 0 nhân tạo, không ngộ nhận dữ liệu hôm nay đã đủ.
   - Cơ chế Rolling Refresh Windows:
     - **HOT (3 ngày gần nhất):** Làm mới định kỳ các đơn hàng và yêu cầu hoàn đang biến động trạng thái vòng đời.
     - **WARM (14 ngày):** Đối soát định kỳ theo chu kỳ thanh toán.
     - **MATURED (quá 14 ngày):** Dữ liệu lịch sử bất biến, bảo toàn chuẩn kỳ.
   - Ghi nhận đầy đủ bằng chứng kiểm toán (Audit Evidence) vào `commerce_sync_runs` qua Migration 014 phụ gia, an toàn.
   - Cung cấp 2 cơ chế kích hoạt: Background/Scheduled Cron CLI và Nút bấm an toàn "Đồng bộ ngay" / "Đồng bộ ngay tất cả miền" trên UI mà không chặn render báo cáo.

2. **Compact Business Analytics UI (Frontend):**
   - **Xóa bỏ thẻ Hero lớn** (chiếm >200px) và **loại bỏ lưới điều hướng 6 cột trùng lặp** trong nội dung trang.
   - Chuẩn hóa **Left Sidebar** thành luồng điều hướng duy nhất tuân thủ Section XI IA:
     - **TỔNG QUAN:** Dashboard (`overview`)
     - **KINH DOANH:** Báo cáo TikTok Shop P0 (`report`), Đơn hàng (`orders`), Khách hàng PII (`customers`), Sản phẩm (`products`), Affiliate (`affiliate`)
     - **QUẢNG CÁO:** GMV Max (`ads`), LIVE GMV Max (`live_ads`), Video Intelligence (`video_intel`)
     - **LIVESTREAM:** Phiên LIVE (`lives`), Phân tích LIVE (`live_analytics`)
     - **TÀI CHÍNH:** Đối soát & Hao hụt (`losses`), Settlement (`finance`)
     - **HỆ THỐNG:** Đồng bộ dữ liệu (`sync`), Data Quality (`quality`), Cấu hình (`config`)
     - **CÔNG CỤ CŨ / LEGACY (Collapsible):** Tổng quan Ads, Quản lý Chiến dịch, Báo cáo Live GMV Max, Tối ưu Tự động, Chẩn Đoán Shop 360°, Trợ lý AI Gemini.
   - Thu gọn Header Báo cáo còn **<= 75px** (2 hàng tinh gọn):
     - Title + Subtitle + Badge P0
     - Chỉ báo đồng bộ nhỏ gọn (`● Dữ liệu đầy đủ (COMPLETE 20/20 ngày)` / `● Dữ liệu mới nhất - Cập nhật...`)
     - Thanh Preset khoảng ngày (`01-20/09 (Chuẩn kỳ)`, `Hôm nay`, `Hôm qua`, `7 ngày`, `30 ngày`, Custom Range)
     - Nút `[↻ Đồng bộ]` và `[Làm mới]`
   - **Đạt mục tiêu hiển thị Viewport chuẩn 1920x1080:** Cả 2 hàng Thẻ KPI chính (Doanh số Shop, Doanh số thực, Hủy & Hoàn, Tỷ lệ Hủy+Hoàn, Chi phí QC, Doanh số QC, ROI QC, Tỷ trọng Ads/Shop) đều nằm trọn vẹn trong màn hình đầu tiên (above-the-fold) mà người dùng không cần cuộn chuột xuống.

---

## 2. THÀNH PHẦN BÀN GIAO (DELIVERABLES)

| Thành phần | Đường dẫn | Chức năng |
|---|---|---|
| **SQL Migration 014** | `database/migrations/20261005_014_enhance_commerce_sync_runs_metadata.sql` | Thêm trường metadata phụ gia cho `commerce_sync_runs` (`start_date`, `end_date`, `records_read`, `records_written`, `latest_available_date`, `api_endpoint`, index `idx_domain_dates_status`) |
| **SQL Rollback 014** | `database/migrations/20261005_014_rollback_enhance_commerce_sync_runs_metadata.sql` | Kịch bản rollback an toàn khi cần hủy bỏ Migration 014 |
| **Sync Orchestrator** | `public/api/commerce_sync_orchestrator.php` | Động cơ điều phối đồng bộ lũy tiến 5 miền, quản lý cửa sổ HOT/WARM/MATURED, audit evidence |
| **Sync API Endpoint** | `public/api/commerce_sync.php` | Endpoint RESTful độc lập phục vụ `action=status`, `action=sync`, `action=sync_all` |
| **Dashboard API** | `public/api/commerce_dashboard.php` | Tích hợp orchestrator cho action `get_sync_status`, `trigger_sync`, `sync_all` |
| **Reporting Service** | `public/api/commerce_reporting_service.php` | Cập nhật truy vấn audit metadata `start_date`/`end_date` từ `commerce_sync_runs` |
| **Sync Management View** | `src/CommerceSyncManagementView.jsx` | Màn hình quản lý đồng bộ dữ liệu trực quan: ma trận 5 miền, ngày khả dụng, trạng thái, nút kích hoạt |
| **Report View** | `src/CommerceReportView.jsx` | Header 2 hàng siêu gọn (<=75px), KPI cards hiển thị ngay màn hình đầu tiên |
| **Dashboard Container** | `src/CommerceDashboardView.jsx` | Loại bỏ thẻ Hero lớn và lưới điều hướng 6 cột trùng lặp, nhúng màn quản lý sync |
| **Main App Shell** | `src/App.jsx` | Reorganize Left Sidebar chuẩn hóa Section XI IA, đồng bộ state ngày toàn cục |
| **Prebuilt Dist** | `dist/index.html`, `dist/assets/*` | Bản build Vite sẵn sàng cho production (KHÔNG cần chạy `npm build` trên server) |
| **Test Suites** | `tools/test_v2_04_sync_orchestrator_and_compact_ui.cjs`, `tools/mock_pdo_helper.php` | Bộ kiểm thử tự động 17 tiêu chí V2-04 |

---

## 3. QUY TRÌNH TRIỂN KHAI PRODUCTION (DEPLOYMENT PROCEDURE)

> [!IMPORTANT]
> - **KHÔNG CHẠY `npm build` TRÊN SERVER PRODUCTION.** Bản dựng tĩnh đã được biên dịch tối ưu sẵn trong thư mục `dist/`.
> - Migration 014 là migration phụ gia 100% (`ADD COLUMN IF NOT EXISTS`), không khóa bảng và không ảnh hưởng đến bất kỳ truy vấn nào đang chạy.

### Bước 1: Tải gói Release lên máy chủ Production
Tải tệp ZIP phát hành `task_v2_04_sync_and_compact_ui_release_<timestamp>.zip` lên thư mục gốc của dự án:
```bash
scp release/task_v2_04_sync_and_compact_ui_release_<timestamp>.zip addp@marketing.addp.vn:/home/addp/domains/marketing.addp.vn/
```

### Bước 2: Kiểm tra SHA-256 Checksum
Trên máy chủ production:
```bash
cd /home/addp/domains/marketing.addp.vn/
sha256sum -c task_v2_04_sync_and_compact_ui_release_<timestamp>.zip.sha256
# Kết quả phải trả về: OK
```

### Bước 3: Chạy Migration 014 trên MariaDB
Thực thi migration phụ gia:
```bash
mysql -u [DB_USER] -p[DB_PASSWORD] [DB_NAME] < database/migrations/20261005_014_enhance_commerce_sync_runs_metadata.sql
```
*Xác nhận cấu trúc bảng:*
```sql
SHOW COLUMNS FROM commerce_sync_runs LIKE '%date%';
SHOW INDEX FROM commerce_sync_runs WHERE Key_name = 'idx_domain_dates_status';
```

### Bước 4: Giải nén mã nguồn đè lên webroot
```bash
cd /home/addp/domains/marketing.addp.vn/public_html
unzip -o ../task_v2_04_sync_and_compact_ui_release_<timestamp>.zip
```

### Bước 5: Phân quyền tệp tin và làm mới OPcache
```bash
chmod -R 755 public/api dist
systemctl reload php8.2-fpm || systemctl reload php-fpm || true
```

---

## 4. CẤU HÌNH CRON TỰ ĐỘNG ĐỒNG BỘ ĐỊNH KỲ (SCHEDULED SYNC)

Để hệ thống tự động đồng bộ lũy tiến dữ liệu nền mà người dùng không cần bấm tay, thiết lập Crontab trên máy chủ:

```bash
crontab -e
```

Thêm cấu hình chạy định kỳ (ví dụ mỗi 30 phút hoặc mỗi 1 giờ):
```cron
# [V2-04] Tự động đồng bộ lũy tiến TikTok Shop (Orders, RMA, Ads, Finance, Analytics)
*/30 * * * * php /home/addp/domains/marketing.addp.vn/public_html/api/commerce_sync.php --cli --shop_id=7495657895504611503 >> /home/addp/domains/marketing.addp.vn/storage/logs/commerce_sync.log 2>&1
```

---

## 5. KIỂM TOÁN VÀ NGHIỆM THU SAU TRIỂN KHAI (VERIFICATION)

### 1. Kiểm tra API Endpoint đồng bộ độc lập
```bash
curl -s "https://marketing.addp.vn/api/commerce_sync.php?action=status&shop_id=7495657895504611503" | jq .
```
Xác nhận JSON trả về chứa 5 miền (`order`, `rma`, `ads_campaign`, `finance`, `analytics`) cùng `latest_available_date` và `status`.

### 2. Kiểm tra Màn hình Báo cáo TikTok Shop
Truy cập: `https://marketing.addp.vn`
- Sidebar trái hiển thị đầy đủ cấu trúc Section XI IA.
- Chọn menu **Báo cáo TikTok Shop [P0]**.
- Thẻ Hero lớn cũ (>200px) và lưới 6 cột body navigation cũ đã biến mất hoàn toàn.
- Header chỉ chiếm ~75px, chứa thanh preset ngày và chỉ báo đồng bộ.
- Ngay trong màn hình đầu tiên (1080p), nhìn thấy trọn vẹn:
  - Hàng 1: Doanh số Shop (272.135.230 đ), Doanh số thực (217.848.038 đ), Hủy & Hoàn (54.287.192 đ), Tỷ lệ Hủy+Hoàn (19,95%).
  - Hàng 2: Chi phí quảng cáo, Doanh số quảng cáo, ROI quảng cáo, Tỷ trọng Ads/Shop.

### 3. Kiểm tra Màn hình Quản lý Đồng bộ Dữ liệu
- Chọn menu **HỆ THỐNG -> Đồng bộ dữ liệu** trên sidebar trái.
- Ma trận 5 miền dữ liệu hiển thị rõ ràng: Trạng thái, Ngày dữ liệu mới nhất trong DB, Ngày TikTok công bố, Bản ghi đã nạp, Nút "Đồng bộ ngay".
- Bấm nút **"Đồng bộ ngay tất cả miền"** để kiểm tra hoạt động đồng bộ nền.

### 4. Bảo toàn bộ số chuẩn kỳ lịch sử (Invariants Verification)
- Kỳ **01/09/2026 – 20/09/2026**:
  - Doanh số Shop: `272,135,230 VND`
  - Hủy: `53,734,292 VND`
  - Hoàn: `552,900 VND`
  - Tổng mất: `54,287,192 VND` (~19.95%)
  - Doanh số thực: `217,848,038 VND`
- Kỳ **01/09/2026 – 30/09/2026**:
  - Chi phí QC: `34,182,003 VND`
  - Doanh số QC: `383,251,049 VND`
  - Đơn hàng QC: `5,165`
  - ROI: `~11.21`

---

## 6. KỊCH BẢN HOÀN NGUYÊN (ROLLBACK PROCEDURE)

Nếu phát sinh sự cố bất ngờ:

### Bước 1: Khôi phục mã nguồn và dist/
Giải nén bản sao lưu trước đó hoặc khôi phục các tệp tin từ bản phát hành V2-03.1:
```bash
unzip -o task_v2_03_1_data_trust_release_*.zip
```

### Bước 2: Hoàn nguyên Migration 014 (nếu cần)
```bash
mysql -u [DB_USER] -p[DB_PASSWORD] [DB_NAME] < database/migrations/20261005_014_rollback_enhance_commerce_sync_runs_metadata.sql
```

### Bước 3: Làm mới OPcache
```bash
systemctl reload php8.2-fpm || systemctl reload php-fpm || true
```
Hệ thống sẽ lập tức quay trở lại trạng thái hoạt động của Sprint V2-03.1 mà không có bất kỳ tổn thất dữ liệu nào.
