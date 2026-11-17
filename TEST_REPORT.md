# TEST REPORT — P0 COMMERCE INTELLIGENCE FINAL CONSOLIDATED RELEASE
**Thời điểm kiểm thử:** 2026-10-09T20:45:00+07:00  
**Môi trường kiểm thử:** Local Verification Sandbox  
**Tổng số bài kiểm thử:** 29/29 ĐỘC LẬP PASS (100%)  
**Trạng thái SSR Component:** 12/12 Views Render Cleanly (100%)  
**Undeclared Variables:** 0 (Clean)  
**PHP 8.2 Syntax Gate:** 46/46 Files Pass (100%)  

---

## 1. BẢNG TỔNG HỢP KIỂM THỬ THEO MODULE

| Nhóm Kiểm Thử | Suite Tệp Tin | Số Bài Test | Đạt (PASS) | Hỏng (FAIL) | Trạng Thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P0-01 Affiliate Integrity** | `tools/test_p0_01_affiliate_integrity.cjs` | 10 | 10 | 0 | **PASS (100%)** |
| **P0-02 Video Affiliate Intelligence** | `tools/test_p0_02_video_and_live_roi.cjs` | 5 | 5 | 0 | **PASS (100%)** |
| **P0-03 LIVE GMV Max Metric** | `tools/test_p0_02_video_and_live_roi.cjs` | 4 | 4 | 0 | **PASS (100%)** |
| **P0-04 Product Break-even ROI** | `tools/test_p0_03_breakeven_roi.cjs` | 10 | 10 | 0 | **PASS (100%)** |
| **SSR Runtime Render Gate** | `tools/test_runtime_render.mjs` | 12 | 12 | 0 | **PASS (100%)** |
| **Frontend Variable Audit** | `tools/audit_frontend_undef.cjs` | N/A | 0 undef | 0 | **PASS (100%)** |
| **PHP CLI Syntax Compile Gate** | `tools/verify_php_syntax.cjs` | 46 | 46 | 0 | **PASS (100%)** |

---

## 2. CHI TIẾT KẾT QUẢ TỪNG BÀI TEST CHUYÊN SÂU

### A. P0-01 Affiliate Data Integrity (10/10 PASS)
- ✔ **P0-01.1:** Không còn bất kỳ tỷ lệ hoa hồng cố định nào (`0.10`, `0.09`, `0.01`) hay tỷ lệ phân bổ tùy tiện (`0.7`, `0.3`).
- ✔ **P0-01.2:** Migration `20261009_021_create_commerce_affiliate_orders.sql` và rollback tồn tại, an toàn, có pre-flight validation.
- ✔ **P0-01.3:** `TikTokShopClient::searchAffiliateOrders` gọi chính xác endpoint `/affiliate_seller/202410/orders/search`.
- ✔ **P0-01.4:** `CommerceAffiliateService` xử lý thiếu quyền bằng trạng thái có cấu trúc `PERMISSION_REQUIRED`.
- ✔ **P0-01.5:** `CommerceAffiliateService` từ chối import CSV bằng mã chính sách `API_ONLY_POLICY`.
- ✔ **P0-01.6:** Ingestion nạp đơn Affiliate idempotent dựa trên `uq_shop_aff_order_sku`.
- ✔ **P0-01.7:** Báo cáo Affiliate tính toán số liệu trung thực từ bảng `commerce_affiliate_orders`.
- ✔ **P0-01.8:** `CommerceAffiliateView.jsx` đã gỡ bỏ modal upload CSV và thêm nút đồng bộ API.
- ✔ **P0-01.9:** `CommerceSyncOrchestrator` hỗ trợ điều phối miền `DOMAIN_AFFILIATE`.
- ✔ **P0-01.10:** 0 lỗi cú pháp PHP trong toàn bộ các tệp liên quan.

### B. P0-02 Video Affiliate Intelligence (5/5 PASS)
- ✔ **P0-02.1:** Loại bỏ 370 dòng mock templates trong `creatives_data.php`.
- ✔ **P0-02.2:** Loại bỏ hoàn toàn công thức modulo `crc32` sinh tỷ lệ hủy đơn giả.
- ✔ **P0-02.3:** Loại bỏ công thức `spend / 80` và `spend / 10` trong `campaigns.php`.
- ✔ **P0-02.4:** Loại bỏ mảng fallback mock mukbang trong `App.jsx`.
- ✔ **P0-02.5:** Quy kết hoàn hủy video dựa trên `content_id` liên kết với đơn hàng xác thực.

### C. P0-03 LIVE GMV Max Metric Correction (4/4 PASS)
- ✔ **P0-03.1:** `commerce_dashboard.php` tách bạch rõ ràng `ads_roas` (Attributed) và `blended_live_roas`.
- ✔ **P0-03.2:** `get_live_analytics` cung cấp metadata `source_attribution` và `data_freshness`.
- ✔ **P0-03.3:** `CommerceLiveAnalyticsView` hiển thị rõ ràng cả 2 chỉ số ROAS trong thẻ KPI 12.
- ✔ **P0-02/P0-03.4:** 0 lỗi cú pháp PHP trên các file chỉnh sửa.

### D. P0-04 Product Break-even ROI (10/10 PASS)
- ✔ **P0-04.1:** Migration `20261009_022_create_commerce_product_costs.sql` và rollback tồn tại, an toàn, có pre-flight validation.
- ✔ **P0-04.2:** `calculateBreakEven` tính toán chính xác lợi nhuận gộp đơn vị và Break-even ROAS ($1 / 	ext{Margin Ratio}$).
- ✔ **P0-04.3:** `calculateBreakEven` tính toán chính xác Target ROAS khi có biên mục tiêu.
- ✔ **P0-04.4:** Biên lợi nhuận âm trả về `NEGATIVE_MARGIN` và ROAS = null (tránh chia cho số âm).
- ✔ **P0-04.5:** Thiếu dữ liệu (giá bán = 0 hoặc COGS = 0) trả về `INSUFFICIENT_DATA` và ROAS = null.
- ✔ **P0-04.6:** Không có giá trị fallback cứng (6.00x hay 15.00x) trong mã thực thi.
- ✔ **P0-04.7:** `CommerceAdsService::getProductIntelligence` nhúng giá vốn SPU, xác định `ABOVE_BREAKEVEN` / `BELOW_BREAKEVEN`.
- ✔ **P0-04.8:** `commerce_dashboard.php` mở 2 endpoints `get_product_costs` và `save_product_cost`.
- ✔ **P0-04.9:** `CommerceDashboardView.jsx` hiển thị cột ROI hòa vốn, badge đánh giá và modal Unit Economics.
- ✔ **P0-04.10:** 0 lỗi cú pháp PHP trong toàn bộ hệ thống.
