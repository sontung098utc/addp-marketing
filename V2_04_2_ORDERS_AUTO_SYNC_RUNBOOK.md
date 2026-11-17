# V2-04.2 RUNBOOK: ORDERS AUTO SYNC & COVERAGE INTEGRITY

**Module:** ADDP Commerce Intelligence V2  
**Production Host:** `marketing.addp.vn`  
**Webroot:** `/home/addp/domains/marketing.addp.vn/public_html`  
**Date:** 2026-10-05  
**Version:** V2-04.2  
**Sprint Target:** Orders Auto Sync & Coverage Integrity Incident Resolution  

---

## 1. SỰ CỐ DỮ LIỆU SẢN XUẤT (PRODUCTION INCIDENT CONTEXT)

### 1.1. Hiện tượng & Bằng chứng thực tế
- **Khoảng thời gian báo cáo:** `2026-09-01 → 2026-09-30`
- **TikTok Shop Seller Center:** **4,207** đơn hàng
- **Cơ sở dữ liệu gốc tại ADDP:** **3,884** đơn hàng
- **Nguyên nhân cốt lõi phát hiện qua điều tra:**
  - Đồng bộ đơn hàng bị dừng lại tại thời điểm `2026-09-29 11:22:16`.
  - Phiên đồng bộ gốc dừng quanh thời điểm `2026-09-29 11:28:58`.
  - Hàm `syncOrdersDomain()` trước đây tính toán `$runStartDate` và `$runEndDate`, nhưng sau đó lại gọi `incrementalSync($shopId, $overlapSeconds, 100, $maxPages)`, dẫn đến việc khoảng thời gian yêu cầu bị bỏ qua, không được thực thi một cách chuẩn xác (`not authoritative`).
  - Khi giới hạn an toàn `max_pages` đạt tới trong khi `next_page_token` vẫn tồn tại, hệ thống vô tình ghi nhận hoặc coi phiên chạy là kết thúc, cho phép báo cáo kỳ `2026-09-01 → 2026-09-30` vượt ra ngoài phạm vi dữ liệu thực tế đã đồng bộ.
  - Khi thực hiện backfill có giới hạn từ `2026-09-29 11:28:59 → 2026-10-01 00:00:00`, hệ thống thu hồi chính xác **323 đơn hàng** (389 items), đưa tổng số đơn hàng lên đúng **4,207 đơn hàng**, khớp 100% với TikTok Seller Center.

---

## 2. GIẢI PHÁP KIẾN TRÚC V2-04.2 (ARCHITECTURAL FIXES)

### P0 — Tái thiết kế `syncOrdersDomain()` và `syncOrdersWindow()`
- **Đồng bộ theo cửa sổ thẩm quyền:**
  - Bổ sung phương thức `syncOrdersWindow(string $shopId, int $startTimestamp, int $endTimestamp, int $pageSize = 100, int $maxPagesSafetyGuard = 100, ?string $resumeToken = null, string $syncType = 'COVERAGE_WINDOW', string $timeFilterType = 'create_time'): array` trong `CommerceSyncService`.
  - `syncOrdersDomain()` giải quyết cửa sổ thực tế (`$startDate` đến `$endDate`), chuyển đổi sang `create_time_ge` và `create_time_lt`, sau đó thực thi phân trang cho đến khi cạn kiệt (`exhausted pagination`).
  - Tuyệt đối không đánh dấu cửa sổ yêu cầu là `COMPLETE` trừ khi phân trang cho cửa sổ đó đã được hoàn tất trọn vẹn.

### P0 — Bằng chứng Cửa sổ Đồng bộ (`Sync Window Evidence`)
- Lưu trữ chuẩn xác trong bảng `commerce_sync_runs`:
  - `start_date` và `end_date` chính xác của kỳ yêu cầu.
  - `records_read` và `records_written` phản ánh đúng số bản ghi.
  - `latest_available_date` chỉ được ghi nhận khi phiên chạy đạt trạng thái `COMPLETED`.
  - Nếu `max_pages` đạt tới trong khi `next_page_token` vẫn còn: trạng thái chuyển thành `PARTIAL` (không bao giờ âm thầm cắt ngắn hoặc đánh dấu `COMPLETED`).

### P0 — Động cơ Đánh giá Độ phủ (`Coverage Engine`)
- Độ phủ đơn hàng (`Orders coverage`) được suy luận trực tiếp từ bằng chứng các phiên chạy thành công cạn kiệt trong `commerce_sync_runs`.
- Tuyệt đối không suy diễn tính đầy đủ từ `COUNT(days containing orders)`, `MAX(platform_created_at)`, hay sự tồn tại ngẫu nhiên của các dòng dữ liệu.
- Hỗ trợ gộp khoảng thời gian (`interval merging` với dung sai 1 giờ):
  - Ví dụ: Chạy đợt 1 (01/09 → 20/09) `COMPLETED` + Chạy đợt 2 (21/09 → 30/09) `COMPLETED` => Kỳ yêu cầu 01/09 → 30/09 = `COMPLETE` (30/30 ngày).
  - Ngược lại: Chạy đợt 1 (01/09 → 29/09 11:28) nhưng kỳ yêu cầu là 01/09 → 30/09 => Báo cáo đánh dấu `PARTIAL` (28 ngày khả dụng, 2 ngày thiếu). Doanh số thực (`Realized Sales`) không được chứng nhận (`realized_sales_trust_verified = false`).

### P0 — Hợp đồng Kích hoạt Thủ công & Biến cờ Môi trường
- Endpoint API `/api/commerce_sync.php`: Trả về `success = false` khi trạng thái là `DISABLED` hoặc `PARTIAL`.
- Giao diện người dùng:
  - `AVAILABLE`, `COMPLETE`, `COMPLETED`: Hiển thị thông báo thành công (xanh lá).
  - `PARTIAL`: Hiển thị cảnh báo vàng (đồng bộ một phần).
  - `DISABLED`: Hiển thị cảnh báo/lỗi màu vàng/đỏ (tính năng đang tắt). Tuyệt đối không hiện thông báo xanh giả lập.
- Biến cờ môi trường `FEATURE_ENABLE_COMMERCE_V2` được điều khiển linh hoạt qua `.env`, không hardcode `true`.

### P1 — Tách biệt Watermark Độ phủ và Hot Rolling Refresh
- **Coverage watermark:** Quét từ mốc hoàn thành cuối cùng theo `create_time` đến thời điểm đích.
- **Mutation refresh:** Quét cửa sổ HOT (3 ngày gần nhất) theo `update_time` để nắm bắt sự biến đổi trạng thái của các đơn hàng có vòng đời động.

### P1 — Tự động Tái tính toán Hao hụt khi Nạp Đơn hàng
- Khi đơn hàng mới/được khôi phục nạp vào `commerce_orders`, hệ thống tự động kiểm tra và tái tính toán ngay lập tức các ledger hao hụt (`MATURED_LIFECYCLE`) cho các RMA mồ côi liên quan.

### P1 — Cải thiện Kiểu chữ & Độ trực quan KPI (Typography & Visual Emphasis)
- Nâng cấp typography toàn hệ thống thêm ~1 cấp kích thước thị giác mà không làm vỡ bố cục:
  - Text phụ/ghi chú: 11-12px → 12-13px
  - Text nội dung bảng/thân trang: 12-13px → 13-14px
  - Tiêu đề mục: 14-15px → 16-17px
  - Tiêu đề trang: 18-20px → 21px
  - Giá trị KPI chính: 22-24px → 26px đậm
- Màu sắc ngữ nghĩa trực quan cho KPI:
  - Gross Sales (Doanh số): Xanh dương đậm (`#1d4ed8`)
  - Realized Sales (Doanh số thực): Xanh lục (`#047857`) CHỈ KHI `trust_verified = true`. Khi `realized_sales_trust_verified = false`: tuyệt đối không mang sắc xanh chứng nhận, mà hiển thị màu hổ phách cảnh báo (`#b45309`) nếu `PARTIAL` hoặc màu xám trung tính (`#475569`) nếu `UNKNOWN`.
  - Loss Value (Hủy + Hoàn): Đỏ cảnh báo (`#b91c1c`)
  - Ads Cost (Chi phí quảng cáo): Cam / hổ phách (`#c2410c`)
  - Attributed Gross Revenue (Doanh số từ quảng cáo): Xanh dương đậm (`#1d4ed8`)
  - ROI quảng cáo: Tuyệt đối không hardcode ngưỡng tùy tiện (`>= 4.0`, `2.0 - 4.0`, `< 2.0`). Trạng thái thị giác dựa trên quy tắc cấu hình kinh doanh / ROI hòa vốn (`break-even ROI` / `target_roi`):
    - Khi CÓ ngưỡng hòa vốn / mục tiêu được xác thực: đánh giá tương đối theo ngưỡng (≥ target: xanh lá `#15803d`, ≥ target * 0.8: hổ phách `#b45309`, < target * 0.8: đỏ `#b91c1c`).
    - Khi CHƯA có cấu hình mục tiêu: hiển thị số ROI nổi bật (26px bold), sử dụng kiểu dáng trung tính (`#0f172a`, viền `#64748b`), KHÔNG phân loại tốt / cảnh báo / xấu.

---

## 3. DANH MỤC FILE THAY ĐỔI & BÀN GIAO (CHANGED FILES MANIFEST)

| STT | File | Thay đổi chính |
|:---:|---|---|
| 1 | `public/api/commerce_sync_service.php` | Thêm `syncOrdersWindow()`, phân trang cạn kiệt, xử lý `PARTIAL` an toàn khi chạm `max_pages_safety_guard`, ghi nhận đầy đủ metadata `start_date`, `end_date`, `latest_available_date`. |
| 2 | `public/api/commerce_sync_orchestrator.php` | Tái cấu trúc `syncOrdersDomain()` thực thi cửa sổ thẩm quyền, tách biệt coverage watermark và HOT mutation refresh, tự động reconciliate RMA orphan, hỗ trợ inject sync service. |
| 3 | `public/api/commerce_reporting_service.php` | Động cơ phân tích độ phủ gộp khoảng thời gian (`interval merging`), kiểm tra mốc bắt đầu kỳ, xuất các chỉ số độ phủ `available_days`, `missing_days`, `coverage_pct`. Thêm hàm `evaluateCoverage()`. |
| 4 | `public/api/commerce_sync.php` | Hợp đồng API chuẩn: trả về `success = false` khi `status = 'DISABLED'`, chỉ trả về `success = true` cho trạng thái thành công thực sự. Tách biệt `orders_status` và cờ `is_global_all_complete`. |
| 5 | `public/api/commerce_sync_orchestrator.php` | Tái cấu trúc `syncOrdersDomain()` và `syncAll()`: Orders là miền bắt buộc, kiểm soát tính toàn vẹn đa miền, không biến việc miền tùy chọn bị tắt thành false global success. |
| 6 | `public/api/commerce_dashboard.php` | Đồng bộ hợp đồng API tại action `trigger_sync` và `sync_all` cho `domain=all`. |
| 7 | `src/index.css` | Bổ sung các token kiểu chữ và class CSS ngữ nghĩa: `.kpi-card-title`, `.kpi-value-gross`, `.kpi-value-realized`, `.kpi-value-loss`, `.kpi-value-spend`, `.kpi-value-ads-rev`, `.badge-disabled`. |
| 8 | `src/App.css` | Tăng kích thước phông chữ toàn cục thêm 1 cấp (14px thân bảng, 13px header bảng, 26px thẻ KPI). |
| 9 | `src/CommerceReportView.jsx` | Kết nối nút `[↻ Đồng bộ]` góc trên bên phải với Auto Sync V2-04.2 (`commerce_sync.php`), tuần tự await sync → evaluate result → refresh report, vô hiệu hóa nút chống double-click, hiển thị banner thông báo chuẩn xác. |
| 10 | `src/CommerceSyncManagementView.jsx` | Sửa thông báo toast khi kích hoạt thủ công: hiển thị warning/error khi `DISABLED` hoặc `PARTIAL`. |
| 11 | `src/CommerceDashboardView.jsx` | Chuyển tiếp props `targetRoi`, `targetRoas` và đồng bộ hợp đồng phản hồi. |
| 12 | `dist/index.html`, `dist/assets/*` | Gói bản dựng Vite Production mới nhất. |
| 13 | `tools/test_v2_04_2_orders_auto_sync_and_coverage.cjs` | Bộ 11 bài kiểm tra tự động bao phủ toàn bộ các yêu cầu của sự cố và logic ROI/Trust. |
| 14 | `tools/test_v2_04_2_report_sync_button_hotfix.cjs` | Bộ 10 bài kiểm tra tự động bao phủ luồng kết nối nút Đồng bộ Báo cáo với Auto Sync. |
| 15 | `tools/package_v2_04_2_release.cjs` | Kịch bản đóng gói release ZIP POSIX chuẩn và tính toán SHA-256. |

---

## 4. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST VERIFICATION)

Tất cả 7 bộ test tự động với **106 bài kiểm tra chức năng** và kiểm tra cú pháp PHP toàn diện đều đạt kết quả 100% thành công:

| Bộ kiểm thử | File kịch bản | Số test | Kết quả | Trọng tâm kiểm tra |
|---|---|:---:|:---:|---|
| **V2-04.2 Orders Auto Sync & Coverage** | `tools/test_v2_04_2_orders_auto_sync_and_coverage.cjs` | 11 | **11/11 PASS** (100%) | Bounded window execution, Partial on max_pages, Interval merge, Baseline 4,207 orders, Configurable ROI logic, Realized sales trust gate |
| **V2-04.2 Hotfix: Report Sync Button** | `tools/test_v2_04_2_report_sync_button_hotfix.cjs` | 10 | **10/10 PASS** (100%) | Nút Báo cáo gọi `commerce_sync.php`, truyền đúng khoảng ngày, await sync trước khi refresh, DISABLED/PARTIAL/ERROR contract, chống double-click, không biến optional disabled thành false global success, tự động refresh Data Quality |
| **V2-04.1 Production Acceptance Fix** | `tools/test_v2_04_1_production_acceptance_fix.cjs` | 9 | **9/9 PASS** (100%) | Orphan RMA recovery, Realized sales trust rule, Migration 015 |
| **V2-04 Sync Orchestrator & Compact UI** | `tools/test_v2_04_sync_orchestrator_and_compact_ui.cjs` | 17 | **17/17 PASS** (100%) | Orchestrator, Hot/Warm/Matured, Compact UI <= 80px |
| **V2-03.1 Data Trust & Coverage** | `tools/test_v2_03_1_data_trust_and_coverage.cjs` | 12 | **12/12 PASS** (100%) | Unproven coverage UNKNOWN, Historical baselines, Zero extrapolation |
| **V2-03 Reporting & Light UI** | `tools/test_v2_03_reporting_and_light_ui.cjs` | 19 | **19/19 PASS** (100%) | Date presets, Product vs Live GMV Max, Divide-by-zero safety |
| **V2-02.1 GMV Max Hardening** | `tools/test_v2_02_1_production_hardening.cjs` | 28 | **28/28 PASS** (100%) | Official GMV Max API, API chunking <= 100, Delivery status normalization |
| **PHP Syntax Compilation** | `tools/verify_php_syntax.cjs` | 34 | **34/34 PASS** (100%) | Biên dịch cú pháp PHP hợp lệ tuyệt đối trên toàn bộ file |
| **TỔNG CỘNG** | | **140** | **140/140 PASS** | **ZERO REGRESSION** |

### Số liệu nghiệm thu kỳ tháng 09/2026 (Preserved Baseline):
- **Đơn hàng:** `4,207`
- **Gross Sales:** `409,171,911 VND`
- **Matured Lifecycle Loss:** `84,727,422 VND`
  - Cancellation: `83,038,602 VND` (715 đơn)
  - Refund: `1,688,820 VND` (9 đơn)
- **Realized Sales:** `324,444,489 VND`
- **Chi phí QC (Ads Cost):** `34,182,003 VND`
- **Doanh thu QC (Ads Revenue):** `383,251,049 VND`
- **ROI:** `11.21`

---

## 5. HƯỚNG DẪN TRIỂN KHAI PRODUCTION (DEPLOYMENT RUNBOOK FOR OPS)

> [!IMPORTANT]
> **Quy định triển khai nghiêm ngặt:**
> 1. KHÔNG tự động deploy trực tiếp từ terminal của agent.
> 2. KHÔNG restart dịch vụ web server (LiteSpeed / Nginx / Apache / PHP-FPM / MariaDB).
> 3. KHÔNG chạy lệnh `npm run build` trên máy chủ production (sử dụng thư mục `dist/` đã đóng gói sẵn trong file ZIP).
> 4. Gói release hoàn toàn độc lập, an toàn và có thể rollback tức thì.

### Các bước thực hiện:

#### Bước 1: Sao lưu trước triển khai
```bash
cp -r /home/addp/domains/marketing.addp.vn/public_html /home/addp/backup_addp_v2042_$(date +%Y%m%d_%H%M%S)
```

#### Bước 2: Kiểm tra biến môi trường `.env` trên Production
Đảm bảo biến môi trường trong file `.env` tại máy chủ production đã bật tính năng:
```ini
FEATURE_ENABLE_COMMERCE_V2=true
```
*(Nếu biến này đang là false hoặc chưa có, cập nhật thành `true` để kích hoạt đồng bộ tự động).*

#### Bước 3: Giải nén gói release ZIP
```bash
unzip -o release/task_v2_04_2_orders_auto_sync_release_<timestamp>.zip -d /home/addp/domains/marketing.addp.vn/public_html
```

#### Bước 4: Kiểm tra xác nhận sau triển khai (Post-Deployment Verification)
1. **Truy cập ứng dụng:** `https://marketing.addp.vn/`
2. **Kiểm tra Báo cáo Doanh thu & Quảng cáo:**
   - Chọn khoảng ngày `01/09/2026 → 30/09/2026`.
   - Xác nhận số liệu:
     - Đơn hàng: **4,207**
     - Doanh số gộp: **409.171.911 đ**
     - Thất thoát & Hủy hoàn: **84.727.422 đ**
     - Doanh số thực: **324.444.489 đ** (Huy hiệu [ĐÃ ĐỐI SOÁT] hiển thị xanh).
     - Chi phí QC: **34.182.003 đ**
     - Doanh thu QC: **383.251.049 đ**
     - ROI: **11.21**
3. **Kiểm tra giao diện Typography & KPI:**
   - Xác nhận cỡ chữ rõ ràng, dễ đọc, không bị bé.
   - Các chỉ số KPI lớn hiển thị 26px đậm và mang màu sắc ngữ nghĩa chuẩn xác.
4. **Kiểm tra Đồng bộ Dữ liệu (`HỆ THỐNG → Đồng bộ dữ liệu`):**
   - 6 miền dữ liệu hiển thị độc lập: `Orders`, `RMA`, `Loss`, `Ads`, `Finance`, `Analytics`.
   - Thử bấm `[Đồng bộ ngay]` cho miền Đơn hàng: Xác nhận toast hiển thị thông báo chính xác theo trạng thái (xanh nếu thành công, vàng cảnh báo nếu đồng bộ một phần hoặc đang tắt).
