# V2-04.4 RUNBOOK: REPORTING FRESHNESS & PERIOD ALIGNMENT

**Phiên bản:** V2-04.4  
**Phạm vi:** Reporting Freshness, Sub-Period Alignment, Domain Trust Decoupling, Missing != Zero Guarantee  
**Trạng thái cơ sở dữ liệu:** Không yêu cầu migration cơ sở dữ liệu mới (Zero Schema Migration). Tương thích 100% với schema V2-04.3, V2-04.2, V2-04.1.  
**Ngày hoàn tất:** 06/10/2026  

---

## 1. MỤC TIÊU & BỐI CẢNH KỸ THUẬT

Trên phiên bản V2-04.3, hệ thống Async Sync Job Orchestrator đã giải quyết triệt để vấn đề Cloudflare 524 Timeout và phục hồi các job/run bị treo. Tuy nhiên, trong quá trình vận hành thực tế tại chu kỳ ngày 01/10/2026 – 06/10/2026:
- Shop Orders đã hoàn tất ingest đến ngày 06/10/2026 (6/6 ngày = 100% coverage, VERIFIED).
- TikTok Ads Ingestion mới sẵn sàng đến ngày 05/10/2026 do API TikTok Ads chốt dữ liệu theo chu kỳ đóng ngày (T-1) (5/6 ngày = 83.3% coverage, PARTIAL).

**Vấn đề:**
1. **Period Misalignment:** Khi tính toán các chỉ số chéo domain (như Tỷ lệ đóng góp doanh thu Ads = Doanh thu Ads / Doanh số Shop), hệ thống trước đây lấy Doanh thu Ads (kỳ 01–05) chia cho Doanh số Shop (kỳ 01–06), dẫn đến tỷ lệ bị méo mó.
2. **Khái niệm Coverage vs Freshness:** Người dùng cần phân biệt rõ giữa Coverage (tỷ lệ ngày đã ingest trong khoảng requested) và Freshness (dữ liệu có đang mới nhất theo khả năng cung cấp của upstream API hay không).
3. **Data Trust Decoupling:** Trạng thái PARTIAL của TikTok Ads không được làm suy giảm độ tin cậy của Shop Gross hay Realized Sales (vốn đã COMPLETE / VERIFIED).
4. **Missing != Zero:** Thiếu ngày mới nhất của Ads không bao giờ được tổng hợp thành doanh thu 0 hay chi phí 0, và không được coi là FAILED.

---

## 2. NGUYÊN TẮC THIẾT KẾ & KIẾN TRÚC V2-04.4

### A. DB-First Reporting
Báo cáo luôn đọc từ Database MariaDB (`commerce_orders`, `commerce_ads_campaign_daily`, `commerce_loss_ledger`, `commerce_sync_runs`).
**Tuyệt đối không gọi TikTok API trực tiếp khi người dùng chuyển đổi khoảng ngày (Date Range).**

### B. Sub-Period Alignment Engine
Khi tính toán các chỉ số so sánh chéo giữa TikTok Ads và Shop:
- Kỳ so sánh khả dụng:
  $$\text{comp\_start} = \max(\text{orders.effective\_start}, \text{ads.effective\_start})$$
  $$\text{comp\_end} = \min(\text{orders.effective\_end}, \text{ads.effective\_end})$$
- Nếu $\text{comp\_start} \le \text{comp\_end}$ (có giao thoa `has_overlap = true`):
  - Hệ thống thực hiện sub-query tính riêng `aligned_shop_gross` từ `commerce_orders` theo khoảng nửa mở (half-open interval) $[\text{comp\_start}\text{ 00:00:00}, \text{comp\_end} + 1\text{ ngày 00:00:00})$:
    ```sql
    SELECT 
        COUNT(DISTINCT platform_order_id) as aligned_orders,
        COALESCE(SUM(order_gross_amount), 0) as aligned_gross_sales
    FROM `commerce_orders`
    WHERE platform = 'tiktok_shop' AND shop_id = :shop_id
      AND platform_created_at >= :c_start AND platform_created_at < :c_end
    ```
    với `:c_start = $compStart . ' 00:00:00'` và `:c_end = date('Y-m-d 00:00:00', strtotime($compEnd . ' +1 day'))`.
  - Doanh thu đóng góp Ads:
    $$\text{ads\_revenue\_contribution\_pct} = \frac{\text{aligned\_ads\_gross\_rev}}{\text{aligned\_shop\_gross}} \times 100$$
  - Tỷ lệ chi phí Ads:
    $$\text{ads\_spend\_rate\_pct} = \frac{\text{aligned\_ads\_cost}}{\text{aligned\_shop\_gross}} \times 100$$
- Nếu không có giao thoa (`has_overlap = false`):
  - Các tỷ lệ chéo domain được gán `null`.
  - Không bao giờ chia cho 0.
  - Cung cấp lý do rõ ràng trong `report_meta.comparison_periods.ads_vs_shop.reason`.

### C. Độc lập Domain & Bất biến kế toán
1. **Chỉ số thuần Shop (Shop Gross, Realized Sales, Loss):** Sử dụng toàn bộ khoảng thời gian requested của Shop (ví dụ 01–06/10), giữ nguyên trạng thái xác minh `COMPLETE` / `VERIFIED`.
2. **Chỉ số thuần Ads (Chi phí Ads, Doanh thu Ads, Đơn Ads, ROI Ads):** Sử dụng toàn bộ khoảng thời gian khả dụng của Ads (ví dụ 01–05/10).
3. **Bất biến kế toán (Strict Accounting Invariant):**
   $$\text{Gross Sales} - \text{Total Loss} = \text{Realized Sales}$$
   Luôn luôn được bảo toàn độc lập với trạng thái Ads.
   - Authoritative September Baseline:
     $$409,171,911 - 86,200,839 = 322,971,072\text{ VND}$$
     (Cancellation: 84,394,802 + Refund: 1,806,037 = 86,200,839 VND).

### D. Chuẩn hóa `report_meta`
API `commerce_report.php` bổ sung khối `report_meta` chứa đầy đủ 6 domain (`orders`, `rma`, `loss`, `ads`, `finance`, `analytics`), mỗi domain cung cấp đủ 12 thuộc tính:
- `status`: COMPLETE | PARTIAL | EMPTY | DISABLED | NOT_YET_AVAILABLE
- `coverage_status`: COMPLETE | PARTIAL | EMPTY
- `freshness_status`: FRESH | STALE | NOT_YET_AVAILABLE | UNKNOWN
- `requested_start`, `requested_end`
- `effective_start`, `effective_end`
- `latest_available_date`, `latest_synced_at`
- `coverage_days`, `requested_days`, `coverage_pct`

Và khối `comparison_periods.ads_vs_shop` gồm:
- `start_date`, `end_date`
- `is_aligned`, `has_overlap`, `constrained_by`, `reason`

### E. Loại bỏ Fallback ngầm định khi Sub-Query đối soát thất bại (Case O)
Trong `commerce_reporting_service.php`:
- Khi sub-query tính `aligned_shop_gross` hoặc `aligned_ads_cost` / `aligned_ads_revenue` cho kỳ so sánh con (sub-period) gặp lỗi (timeout, lock, exception), hệ thống **tuyệt đối không fallback ngầm định sang số liệu cả kỳ requested**.
- Biến được gán rõ ràng `= null`.
- Các tỷ lệ so sánh chéo tương ứng (`ads_revenue_contribution_pct`, `ads_spend_rate_pct`) được gán `= null`.
- Trạng thái metadata:
  ```json
  "calculation_status": "UNAVAILABLE",
  "reason": "ALIGNED_PERIOD_QUERY_FAILED: ..."
  ```
- Tối ưu hóa kỳ giống nhau (Identical Period Optimization) vẫn được duy trì: Nếu `comp_start === requested_start` và `comp_end === requested_end`, hệ thống gán trực tiếp `aligned_shop_gross = gross_sales` mà không cần query lại.

### F. Bộ lọc Hậu Mãi và Xuất File Excel/CSV Đơn Hàng (Zero PII)
1. **Bộ lọc Trả hàng / Hoàn tiền (`RETURN_REFUND`):**
   - Được định nghĩa là một chiều hậu mãi (aftersales dimension), **KHÔNG** phải một trạng thái đơn hàng (`order_status`) mới.
   - Một đơn hàng có trạng thái `order_status = 'COMPLETED'` và có bản ghi hậu mãi `aftersales_status = 'SUCCESS'` hoặc hao hụt `loss_type = 'REFUND'` sẽ khớp chính xác với bộ lọc `RETURN_REFUND`.
   - Mệnh đề SQL canonical:
     ```sql
     (
       EXISTS (SELECT 1 FROM `commerce_aftersales` a 
               WHERE a.platform = o.platform AND a.shop_id = o.shop_id AND a.platform_order_id = o.platform_order_id 
                 AND a.aftersales_status IN ('SUCCESS', 'REQUESTED', 'APPROVED', 'RETURNING', 'RECEIVED', 'REFUND_PENDING'))
       OR EXISTS (SELECT 1 FROM `commerce_loss_ledger` l 
                  WHERE l.platform = o.platform AND l.shop_id = o.shop_id AND l.platform_order_id = o.platform_order_id 
                    AND l.loss_type IN ('REFUND', 'PARTIAL_REFUND', 'RETURN_REFUND'))
     )
     ```
2. **Chia sẻ logic bộ lọc Canonical (`buildCommerceOrdersWhere`):**
   - Dùng chung giữa `get_orders`, đếm số lượng (`COUNT(DISTINCT o.platform_order_id)`), và `export_orders`.
3. **Làm giàu dữ liệu hậu mãi (Aftersales Enrichment):**
   - Bổ sung cột "Hậu Mãi" trong bảng Đơn hàng hiển thị tóm tắt hậu mãi (ví dụ: `Trả hàng: Thành công (180,000 ₫)`).
4. **Nút "Xuất Excel" (`export_orders`):**
   - Xuất **toàn bộ** các dòng khớp bộ lọc mà không bị giới hạn phân trang (unbounded export).
   - Thêm tiền tố UTF-8 BOM (`\xEF\xBB\xBF`) để Microsoft Excel trên Windows hiển thị tiếng Việt không bị lỗi font (mojibake).
   - **Tuân thủ nghiêm ngặt Zero PII:** Không xuất bất kỳ thông tin tên khách hàng, số điện thoại, email, địa chỉ.

---

## 3. DANH SÁCH FILE THAY ĐỔI

| File | Loại thay đổi | Mô tả |
| :--- | :--- | :--- |
| `public/api/commerce_reporting_service.php` | Backend Logic | Period Alignment Engine, sub-query Shop Gross theo sub-period, loại bỏ silent fallback khi query sub-period lỗi (Case O), `report_meta` chuẩn 6 domain và `comparison_periods.ads_vs_shop`. |
| `public/api/commerce_dashboard.php` | Backend API | Logic canonical filter `buildCommerceOrdersWhere`, chiều hậu mãi `RETURN_REFUND`, enrichment hậu mãi trong `get_orders`, action `export_orders` không PII kèm UTF-8 BOM. |
| `src/CommerceReportView.jsx` | Frontend UI | Freshness badges tại header, badge kỳ so sánh & tooltip minh bạch tại Card 2 & Card 3, bảng Period Alignment Audit & domain freshness tại Mục VI. |
| `src/CommerceDashboardView.jsx` | Frontend UI | Thêm tùy chọn "Trả hàng / Hoàn tiền" vào dropdown trạng thái, nút "Xuất Excel", thêm cột "Hậu Mãi" vào bảng Đơn hàng. |
| `dist/index.html`, `dist/assets/*` | Production Bundle | Bundle biên dịch Vite mới nhất (`npm run build`). |
| `tools/test_v2_04_4_reporting_freshness_and_period_alignment.cjs` | Test Suite | 17 bài kiểm tra tự động bao phủ toàn diện Cases A–O (gồm Cases O, O.2, O.3). |
| `tools/test_v2_04_4_schema_compatibility.cjs` | Test Suite | 14 bài kiểm tra tương thích schema migration và review cú pháp SQL khoảng nửa mở. |
| `tools/test_v2_04_4_order_list_and_export.cjs` | Test Suite | 6 bài kiểm tra chiều hậu mãi, COMPLETED + RMA match, và xuất file CSV không PII. |

---

## 4. KẾT QUẢ KIỂM THỬ & CHỨNG THỰC BASELINE

### A. Kiểm thử Sprint V2-04.4
- **Reporting Freshness & Period Alignment (`test_v2_04_4_reporting_freshness_and_period_alignment.cjs`):** 17/17 PASS (100%)
  - Cases A–N: Period alignment, metadata, accounting invariants, September baseline.
  - Case O: Query Shop sub-period lỗi -> `alignedShopGross = null`, ratios = `null`, `calculation_status = UNAVAILABLE`, không fallback ngầm định sang cả kỳ.
  - Case O.2: Query Ads sub-period lỗi -> `alignedAdsCost/Rev = null`, ratios = `null`, `calculation_status = UNAVAILABLE`.
  - Case O.3: Tối ưu hóa khi `comp_period === requested_period` được duy trì.
- **Schema Compatibility (`test_v2_04_4_schema_compatibility.cjs`):** 14/14 PASS (100%)
- **Order List & Non-PII Export (`test_v2_04_4_order_list_and_export.cjs`):** 6/6 PASS (100%)

### B. Kiểm thử hồi quy toàn diện
- `test_v2_04_3_async_sync_jobs_and_recovery.cjs`: 15/15 PASS (100%)
- `test_v2_04_2_orders_auto_sync_and_coverage.cjs`: 11/11 PASS (100%)
- `test_v2_04_2_report_sync_button_hotfix.cjs`: 10/10 PASS (100%)
- `test_v2_04_1_production_acceptance_fix.cjs`: 9/9 PASS (100%)
- `test_v2_04_sync_orchestrator_and_compact_ui.cjs`: 17/17 PASS (100%)
- `verify_php_syntax.cjs`: 35/35 file PHP hợp lệ (0 lỗi cú pháp)
- Frontend Vite Build: Biên dịch thành công 0 lỗi (`npm run build`).

---

## 5. HƯỚNG DẪN TRIỂN KHAI PRODUCTION (NGƯỜI DÙNG TỰ THỰC HIỆN)

> [!IMPORTANT]
> Toàn bộ quá trình nâng cấp không chạm vào cấu hình DB hay chạy script migration mới.

1. **Sao lưu trước khi triển khai (Khuyến nghị):**
   ```bash
   tar -czf backup_pre_v2044_$(date +%Y%m%d_%H%M%S).tar.gz public/ src/ dist/
   ```

2. **Giải nén bản release:**
   ```bash
   unzip -o release/task_v2_04_4_reporting_freshness_and_period_alignment_release_<TIMESTAMP>.zip -d /path/to/webroot/
   ```

3. **Xác thực sau triển khai:**
   - Mở giao diện Báo cáo TikTok Shop tại trình duyệt.
   - Chọn khoảng ngày `2026-09-01` đến `2026-09-30`:
     - Kiểm tra header: `Shop: đến 30/09 • Ads: đến 30/09 • Kỳ so sánh: 01/09 - 30/09 (Khớp hoàn toàn)`.
     - Kiểm tra Gross: 409,171,911 đ, Loss: 86,200,839 đ, Realized: 322,971,072 đ, Chi phí Ads: 34,182,003 đ, Doanh thu Ads: 383,251,049 đ, ROI: 11.21.
   - Chọn khoảng ngày `2026-10-01` đến `2026-10-06`:
     - Kiểm tra header: `Shop: đến 06/10 • Ads: đến 05/10 • Kỳ so sánh: 01/10 - 05/10`.
     - Kiểm tra Card 2 & Card 3: Hiển thị badge `Kỳ so sánh 01/10 - 05/10` cho Tỷ lệ đóng góp doanh thu & Tỷ lệ chi phí.
     - Kiểm tra Realized Sales: Trạng thái vẫn là `COMPLETE` và `ĐÃ XÁC THỰC` (xanh lá).
   - Kiểm tra Tab Đơn Hàng:
     - Thử lọc `Trả hàng / Hoàn tiền`: Danh sách đơn hiển thị các đơn có yêu cầu hoặc hoàn tiền thành công.
     - Nhấn nút "Xuất Excel": Trình duyệt tải file CSV chứa đúng số lượng đơn, mở bằng Microsoft Excel hiển thị đầy đủ tiếng Việt và không chứa thông tin PII.

---

## 6. HƯỚNG DẪN ROLLBACK

Nếu cần quay lại phiên bản V2-04.3:
1. Giải nén lại bản release V2-04.3:
   ```bash
   unzip -o release/task_v2_04_3_async_sync_jobs_and_recovery_release_*.zip -d /path/to/webroot/
   ```
2. Không cần can thiệp database MariaDB.
