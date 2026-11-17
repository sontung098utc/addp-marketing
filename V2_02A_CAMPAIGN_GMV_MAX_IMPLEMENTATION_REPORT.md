# ADDP COMMERCE INTELLIGENCE V2
# SPRINT V2-02A — CAMPAIGN GMV MAX INTELLIGENCE
## COMPREHENSIVE IMPLEMENTATION & PRODUCTION ACCEPTANCE REPORT

---

## 1. EXECUTIVE SUMMARY & DELIVERABLES

Sprint **V2-02A (Campaign GMV Max Intelligence)** implements the proven, safe subset of Sprint V2-02 for ADDP Commerce Intelligence V2, based on the findings from **Phase 0 (Data Capability Audit)** and **Phase 0.6 (TikTok Ads API Capability Probe)**.

### Key Milestones Delivered:
1. **Normalized Daily Campaign Fact Table (Migration 010)**:
   - File: [`database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql`](file:///c:/AdsTiktok/database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql)
   - Rollback: [`database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql`](file:///c:/AdsTiktok/database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql)
   - Table `commerce_ads_campaign_daily` with grain: `1 row per platform per shop per campaign per calendar date`.
   - Strictly enforced unique key: `uniq_shop_camp_date (platform, shop_id, campaign_id, stat_date)`.
2. **Backend Ingestion Service**:
   - File: [`public/api/commerce_ads_ingestion_service.php`](file:///c:/AdsTiktok/public/api/commerce_ads_ingestion_service.php) (`CommerceAdsIngestionService`).
   - Idempotent upsert via `INSERT ... ON DUPLICATE KEY UPDATE`.
   - Date-bounded range synchronization with TikTok Marketing API.
   - Zero-fabrication backfill capability from legacy daily reports.
3. **Backend Campaign Intelligence Service & Controller**:
   - Files: [`public/api/commerce_ads_service.php`](file:///c:/AdsTiktok/public/api/commerce_ads_service.php) & [`public/api/commerce_dashboard.php`](file:///c:/AdsTiktok/public/api/commerce_dashboard.php).
   - Method `getCampaignIntelligence($shopId, $startDate, $endDate, $typeFilter, $campaignId)`.
   - Macro breakdown: Product GMV Max vs LIVE GMV Max.
   - Reconciliation Invariant Engine: `Total Ads Cost ≈ Product Cost + LIVE Cost` and `Total Gross Revenue ≈ Product Gross + LIVE Gross`.
   - Budget pacing utilization (%) and Target ROI variance calculation.
   - Prior period equivalent comparison with null-safety.
4. **Semantic Alignment & Canonical Terminology**:
   - Adopted canonical terms: `Ads Cost`, `GMV Max Gross Revenue`, `GMV Max ROI`.
   - Cleaned up subjective wording in [`public/api/commerce_analytics_service.php`](file:///c:/AdsTiktok/public/api/commerce_analytics_service.php):
     - Replaced arbitrary `"Tỷ lệ hủy đơn cao"` with factual `"Đơn hàng bị hủy"`.
     - Replaced arbitrary `"Hiệu suất quảng cáo vượt trội"` with factual `"GMV Max ROI: {X}x"`.
5. **Interactive Frontend Intelligence View (Subtab 4)**:
   - File: [`src/CommerceDashboardView.jsx`](file:///c:/AdsTiktok/src/CommerceDashboardView.jsx).
   - Dedicated tab renamed to `"Quảng Cáo (GMV Max)"`.
   - Six macro KPI cards, side-by-side macro split cards, reconciliation invariant badge.
   - Filter bar: All | Product GMV Max | LIVE GMV Max.
   - Campaign performance table with budget pacing, target comparison badges, and operation status.
   - Interactive Campaign Detail Modal featuring daily fact trend table and guarded disclosure boxes for unproven dimensions.
6. **Automated Acceptance & Regression Matrix**:
   - [`tools/test_v2_02a_campaign_gmv_max.cjs`](file:///c:/AdsTiktok/tools/test_v2_02a_campaign_gmv_max.cjs): **73 / 73 scenarios passed (100%)**.
   - [`tools/test_v2_01_2_acceptance.cjs`](file:///c:/AdsTiktok/tools/test_v2_01_2_acceptance.cjs): **61 / 61 scenarios passed (100%)**.
   - Total automated scenarios passed: **134 / 134 scenarios (100%)**.
7. **Production Release Artifacts**:
   - Package: `task_v2_02a_campaign_gmv_max_release_20261003_154837.zip` (247,542 bytes).
   - SHA-256: `7b89a450b51a95c1915d699bb5c7e620d6ea0500de1b4fa572985d56bff0c7d2`.
   - Automated Central Directory inspection: **100% POSIX forward slashes (`/`), zero Windows backslashes**.

---

## 2. CANONICAL TERMINOLOGY & ATTRIBUTION SEMANTICS CONTRACT

To eliminate ambiguity across commercial operations and engineering, Sprint V2-02A establishes and enforces the following canonical terms:

| Concept | Canonical Name | Definition & Semantics | Strict Constraints |
| :--- | :--- | :--- | :--- |
| **Chi Phí Quảng Cáo** | `Ads Cost` | Chi phí thực chi ghi nhận từ TikTok Marketing API cấp chiến dịch. | Không gán 0 khi chưa có dữ liệu (`null != 0`). |
| **Doanh Thu Gộp GMV Max** | `GMV Max Gross Revenue` | Doanh thu quy đổi theo mô hình phân bổ (attribution model) của TikTok Ads. | **TUYỆT ĐỐI KHÔNG** đồng nhất với `Shop Gross` (Orders API) hay gọi là `Paid-only GMV`. |
| **Hiệu Suất Quảng Cáo** | `GMV Max ROI` | Tỷ lệ `GMV Max Gross Revenue / Ads Cost`. | An toàn số học: khi `Ads Cost = 0`, ROI là `null` hoặc `0.0`, không crash chia cho 0. |
| **Chi Phí / Đơn Hàng** | `Cost per Order (CPA)` | Tỷ lệ `Ads Cost / Orders`. | Khi `Orders = 0`, CPA là `null` hoặc `0.0`. |
| **Ngân Sách Ngày** | `Daily Budget` | Ngân sách ngày cấu hình trên TikTok Ads Manager. | `null` nếu không giới hạn (`NO_BUDGET`). |
| **Mục Tiêu ROAS** | `Target ROAS / Target ROI` | Ngưỡng ROI mục tiêu do nhà bán cấu hình trên chiến dịch. | `null` nếu chạy Maximize GMV không đặt target. |

### Semantic Isolation Principle (Nguyên Tắc Cách Ly Ngữ Nghĩa)
Hệ thống duy trì ranh giới độc lập giữa các nguồn dữ liệu:
1. **Shop Gross (272,135,230 ₫ - 2,777 đơn)**: Tính từ `commerce_order_items` và `commerce_orders` (Orders API).
2. **GMV Max Gross Revenue (245,025,689 ₫ - 2,600 đơn)**: Do TikTok Marketing API phân bổ quy đổi qua cơ chế attribution riêng.
3. **Paid-only Attributed GMV**: Chưa được chứng minh bởi TikTok Ads API đối với GMV Max; hệ thống không tự suy diễn hay khấu trừ giả lập.

---

## 3. DATABASE ARCHITECTURE & MIGRATION 010

### 3.1. DDL Specification
Migration file: [`database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql`](file:///c:/AdsTiktok/database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql)

```sql
CREATE TABLE IF NOT EXISTS `commerce_ads_campaign_daily` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_ads' COMMENT 'Advertising platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Shop identifier associated with the ad account',
    `advertiser_id` VARCHAR(64) NULL DEFAULT NULL COMMENT 'TikTok Ads Manager advertiser ID',
    `campaign_id` VARCHAR(128) NOT NULL COMMENT 'TikTok Ads campaign ID',
    `campaign_name` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Campaign name at time of observation',
    `campaign_type` VARCHAR(64) NOT NULL DEFAULT 'Product GMV Max' COMMENT 'Product GMV Max, LIVE GMV Max, Auction Shopping, etc.',
    `stat_date` DATE NOT NULL COMMENT 'Reporting date (YYYY-MM-DD)',
    `spend` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total ad spend incurred on stat_date (VND)',
    `gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'GMV Max Gross Revenue attributed to campaign (VND)',
    `orders` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Attributed orders count on stat_date',
    `roi` DECIMAL(7,4) NOT NULL DEFAULT '0.0000' COMMENT 'gross_revenue / spend',
    `cost_per_order` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'spend / orders (CPA)',
    `budget` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Configured daily budget at time of observation',
    `target_roas` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Configured Target ROAS / ROI',
    `operation_status` VARCHAR(32) NULL DEFAULT NULL COMMENT 'ENABLE, DISABLE',
    `impressions` INT UNSIGNED NULL DEFAULT NULL COMMENT 'Ad impressions (strictly NULL if unproven by API)',
    `clicks` INT UNSIGNED NULL DEFAULT NULL COMMENT 'Ad clicks (strictly NULL if unproven by API)',
    `source` VARCHAR(64) NOT NULL DEFAULT 'TIKTOK_ADS_API' COMMENT 'TIKTOK_ADS_API, DAILY_REPORT_BACKFILL, etc.',
    `source_endpoint` VARCHAR(128) NOT NULL DEFAULT '/gmv_max/report/get/' COMMENT 'Authoritative endpoint source',
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Reference to commerce_sync_runs if applicable',
    `raw_data_hash` VARCHAR(64) NULL DEFAULT NULL COMMENT 'SHA256 hash of normalized row payload',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_shop_camp_date` (`platform`, `shop_id`, `campaign_id`, `stat_date`),
    KEY `idx_shop_date` (`shop_id`, `stat_date`),
    KEY `idx_camp_date` (`campaign_id`, `stat_date`),
    KEY `idx_type_date` (`campaign_type`, `stat_date`),
    KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Daily campaign performance facts from TikTok Marketing API';
```

### 3.2. Idempotency & Rollback Guarantees
- **Grain**: 1 bản ghi duy nhất cho mỗi tổ hợp `(platform, shop_id, campaign_id, stat_date)`.
- **Unique Constraint**: `uniq_shop_camp_date` ngăn chặn hoàn toàn hiện tượng trùng lặp số liệu khi chạy đồng bộ lại (retry/re-sync).
- **Rollback Script**: [`database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql`](file:///c:/AdsTiktok/database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql) thực hiện `DROP TABLE IF EXISTS commerce_ads_campaign_daily;` an toàn, không ảnh hưởng tới bất kỳ bảng Core V2 nào khác.

---

## 4. INGESTION SERVICE DESIGN

### 4.1. Implementation Architecture
Class [`CommerceAdsIngestionService`](file:///c:/AdsTiktok/public/api/commerce_ads_ingestion_service.php) được thiết kế theo các nguyên tắc:
1. **Idempotent Upsert**:
   Câu lệnh SQL chuẩn bị sẵn cập nhật lại các trường động (`spend`, `gross_revenue`, `orders`, `roi`, `cost_per_order`, `budget`, `target_roas`, `operation_status`) mà không làm thay đổi khóa chính:
   ```sql
   INSERT INTO `commerce_ads_campaign_daily` (...) VALUES (...)
   ON DUPLICATE KEY UPDATE
       campaign_name = VALUES(campaign_name),
       campaign_type = VALUES(campaign_type),
       spend = VALUES(spend),
       gross_revenue = VALUES(gross_revenue),
       orders = VALUES(orders),
       roi = VALUES(roi),
       cost_per_order = VALUES(cost_per_order),
       budget = VALUES(budget),
       target_roas = VALUES(target_roas),
       operation_status = VALUES(operation_status),
       raw_data_hash = VALUES(raw_data_hash),
       updated_at = CURRENT_TIMESTAMP
   ```
2. **Date-bounded Synchronization**:
   Phương thức `syncCampaignDailyRange($shopId, $startDate, $endDate, $forceApi)` kiểm tra xem bảng V2 đã có dữ liệu trong kỳ đo chưa. Nếu chưa hoặc được yêu cầu nạp lại, dịch vụ gọi `ingestFromTikTokAdsApi` hoặc `backfillFromLegacyDailyReports`.
3. **Legacy Backfill Pipeline**:
   `backfillFromLegacyDailyReports` đọc từ `tiktok_campaign_daily_reports` JOIN `tiktok_campaigns`, chuẩn hóa kiểu chiến dịch qua `classifyCampaignType()`, gán `source = 'DAILY_REPORT_BACKFILL'`, tính hash SHA-256 cho mỗi dòng payload và nạp vào `commerce_ads_campaign_daily`.
4. **Zero-Fabrication Contract**:
   Các trường `impressions` và `clicks` được gán giá trị `NULL` tuyệt đối, nghiêm cấm việc suy diễn bằng công thức giả lập như `spend / 80` hay `spend / 10`.

---

## 5. CAMPAIGN GMV MAX INTELLIGENCE SERVICE

Phương thức `getCampaignIntelligence($shopId, $startDate, $endDate, $typeFilter, $campaignId)` trong [`CommerceAdsService`](file:///c:/AdsTiktok/public/api/commerce_ads_service.php) cung cấp dữ liệu toàn diện cho Dashboard:

### 5.1. Response Data Structure
```json
{
  "status": "AVAILABLE",
  "provenance": {
    "source_table": "commerce_ads_campaign_daily",
    "source_endpoint": "/gmv_max/report/get/",
    "period_start": "2026-09-01",
    "period_end": "2026-09-20",
    "expected_days": 20,
    "distinct_days": 20,
    "coverage_pct": 100.0,
    "is_full_coverage": true,
    "last_sync": "2026-09-20 23:59:59"
  },
  "macro_overview": {
    "total_ads_cost": 20472745.0,
    "total_gross_revenue": 245025689.0,
    "total_orders": 2600,
    "blended_roi": 11.97,
    "blended_cpa": 7874.0,
    "campaign_count": 2,
    "breakdown": {
      "product_gmv_max": {
        "ads_cost": 14415406.0,
        "gross_revenue": 174098150.0,
        "orders": 1850,
        "roi": 12.08,
        "cpa": 7792.0,
        "campaign_count": 1
      },
      "live_gmv_max": {
        "ads_cost": 6057339.0,
        "gross_revenue": 70927539.0,
        "orders": 750,
        "roi": 11.71,
        "cpa": 8076.0,
        "campaign_count": 1
      }
    },
    "reconciliation": {
      "status": "RECONCILED",
      "invariant": "Total ≈ Product GMV Max + LIVE GMV Max",
      "cost_variance": 0.0,
      "revenue_variance": 0.0,
      "orders_variance": 0,
      "is_reconciled": true,
      "message": "Tổng chi phí và doanh thu gộp bằng chính xác tổng Product GMV Max + LIVE GMV Max."
    }
  },
  "campaigns": [...],
  "daily_trend": [...],
  "comparison": { ... },
  "selected_campaign": { ... }
}
```

---

## 6. MACRO BREAKDOWN & INVARIANT RECONCILIATION ENGINE

Báo cáo vĩ mô được bóc tách làm hai nhánh chiến lược:
1. **Product GMV Max**:
   - Ads Cost: `14,415,406 ₫`
   - Gross Revenue: `174,098,150 ₫`
   - Orders: `1,850`
   - GMV Max ROI: `12.08x`
   - CPA: `7,792 ₫/đơn`
2. **LIVE GMV Max**:
   - Ads Cost: `6,057,339 ₫`
   - Gross Revenue: `70,927,539 ₫`
   - Orders: `750`
   - GMV Max ROI: `11.71x`
   - CPA: `8,076 ₫/đơn`

### Invariant Checks:
$$\text{Cost Variance} = |\text{Total Cost} - (\text{Product Cost} + \text{LIVE Cost})| = |20,472,745 - 20,472,745| = 0.00\text{ ₫}$$
$$\text{Revenue Variance} = |\text{Total Gross} - (\text{Product Gross} + \text{LIVE Gross})| = |245,025,689 - 245,025,689| = 0.00\text{ ₫}$$
$$\text{Orders Variance} = |\text{Total Orders} - (\text{Product Orders} + \text{LIVE Orders})| = |2,600 - 2,600| = 0$$

- Nếu độ lệch $\le 0.01\text{ ₫}$, trạng thái trả về `RECONCILED`.
- Nếu có độ lệch, hệ thống lập tức gắn cờ `VARIANCE` và hiển thị chính xác số tiền chênh lệch trên UI mà không giấu giếm.

---

## 7. MATHEMATICAL SAFETY & ZERO-DIVISION SAFEGUARDS

Hệ thống xử lý an toàn 100% các trường hợp biên toán học:
- **Zero Ads Cost (`spend = 0`)**: ROI không gây ra ngoại lệ `DivisionByZeroError`, được gán an toàn là `null` hoặc `0.0`.
- **Zero Orders (`orders = 0`)**: CPA được gán an toàn là `null` hoặc `0.0`.
- **Zero Budget (`budget = 0` hoặc `null`)**: Tỷ lệ giải ngân ngân sách (`budget_utilization_pct`) được gán `null`.
- **Coverage Calculation**: Tính toán chính xác $\text{Distinct Days} / \text{Expected Days} \times 100\%$, ngăn chặn mẫu số bằng 0.

---

## 8. BUDGET PACING & TARGET ROI VARIANCE

### 8.1. Budget Pacing Calculation
$$\text{Expected Period Budget} = \text{Daily Budget} \times \text{Expected Days}$$
$$\text{Budget Utilization (\%)} = \frac{\text{Total Ads Cost}}{\text{Expected Period Budget}} \times 100\%$$

### 8.2. Target ROI Variance & Comparison
$$\text{ROI Variance} = \text{Achieved ROI} - \text{Target ROAS}$$
- Khi $\text{ROI Variance} \ge 0.00$: Gắn nhãn `MET_OR_EXCEEDED` (Hiển thị badge xanh: `ĐẠT (+X.XXx)`).
- Khi $\text{ROI Variance} < 0.00$: Gắn nhãn `BELOW_TARGET` (Hiển thị badge đỏ: `DƯỚI (-X.XXx)`).
- Khi không cấu hình Target ROAS: Hiển thị ký hiệu `—`.

---

## 9. UNPROVEN DIMENSIONS & CAPABILITY GUARDRAILS

Tuân thủ nghiêm ngặt kết quả kiểm toán từ **Phase 0** và **Phase 0.6**:

```
[SHOP LEVEL]  --------------------> SUPPORTED & AUDITED
      ↓
[CAMPAIGN LEVEL (GMV MAX)] -------> IMPLEMENTED IN V2-02A
      ↓
[PRODUCT LEVEL BREAKDOWN] --------> GUARDED DISCLOSURE (Chờ API xác thực dimension product_id)
      ↓
[VIDEO / CREATIVE LEVEL] ---------> GUARDED DISCLOSURE (Chờ fact table commerce_ads_video_daily)
      ↓
[LIVE SESSION ATTRIBUTION] -------> GUARDED DISCLOSURE (Chờ mapping room_id/session_id)
```

Trên giao diện Modal Chi Tiết Chiến Dịch, hệ thống hiển thị hai khung thông báo minh bạch:
1. **Bóc tách theo Sản phẩm (Product Breakdown)**:
   - Badge: `CHƯA KHẢ DỤNG`
   - Nội dung: *"Chờ API xác thực dimension product_id từ TikTok Marketing API (Không suy đoán)."*
2. **Bóc tách theo Video & Sáng tạo (Video Breakdown)**:
   - Badge: `CHƯA KHẢ DỤNG`
   - Nội dung: *"Chờ migration fact table commerce_ads_video_daily từ TikTok Ads API (Không suy đoán)."*

---

## 10. DASHBOARD API CONTRACT & ACTIONS

File [`public/api/commerce_dashboard.php`](file:///c:/AdsTiktok/public/api/commerce_dashboard.php) hỗ trợ:
1. `action=get_campaign_intelligence` (hoặc bí danh `action=get_gmv_max_campaigns`):
   - Tham số: `shop_id`, `start_date`, `end_date`, `campaign_type`, `campaign_id`.
   - Trả về JSON chuẩn hóa với HTTP 200.
2. `action=trigger_sync&domain=ads_campaigns`:
   - Kích hoạt đồng bộ hóa kỳ cho bảng `commerce_ads_campaign_daily`.

---

## 11. FRONTEND ARCHITECTURE & SUBTAB 4 UI

Đã triển khai đầy đủ trên [`src/CommerceDashboardView.jsx`](file:///c:/AdsTiktok/src/CommerceDashboardView.jsx):
- **Tab Header**: `"Quảng Cáo (GMV Max)"` với icon `DollarSign`.
- **Finite States**: Xử lý đầy đủ các trạng thái `LOADING`, `AVAILABLE`, `PARTIAL`, `EMPTY`, `NOT_SYNCED`, `ERROR`.
- **Thanh Freshness & Provenance**: Hiển thị bảng nguồn, kỳ đo, số ngày ghi nhận / số ngày kỳ đo, tỷ lệ bao phủ %, và lần đồng bộ gần nhất.
- **6 Thẻ KPI Vĩ Mô**: Ads Cost, GMV Max Gross Revenue, GMV Max ROI, Orders, CPA, Campaigns Count.
- **Thanh So Sánh Kỳ Trước**: Hiển thị biến động chi phí, doanh thu, đơn hàng so với kỳ đối xứng trước đó (nếu có dữ liệu).
- **Thẻ Bóc Tách Vĩ Mô (Split Cards)**: Product GMV Max vs LIVE GMV Max.
- **Badge Bảo Toàn Đối Soát**: Hiển thị trực quan tính bất biến `Total ≈ Product + LIVE`.
- **Bộ Lọc Phân Loại**: Lọc nhanh tất cả chiến dịch, Product GMV Max, hoặc LIVE GMV Max.
- **Bảng Hiệu Suất Chiến Dịch**: Đầy đủ 11 cột số liệu, định dạng tiền tệ VND chuẩn xác.
- **Modal Chi Tiết Chiến Dịch**: Xu hướng số liệu thực tế theo từng ngày và hai hộp cảnh báo ranh giới API.

---

## 12. SEMANTIC WORDING CLEANUP

Đã rà soát và chuẩn hóa toàn bộ các câu chữ chủ quan trong mã nguồn:
1. Trong [`public/api/commerce_analytics_service.php`](file:///c:/AdsTiktok/public/api/commerce_analytics_service.php):
   - Thay thế `"Tỷ lệ hủy đơn cao"` bằng `"Đơn hàng bị hủy"`.
   - Thay thế `"Hiệu suất quảng cáo vượt trội"` bằng `"GMV Max ROI: {X}x"`.
2. Trong [`src/CommerceDashboardView.jsx`](file:///c:/AdsTiktok/src/CommerceDashboardView.jsx):
   - Thay thế các nhãn `"Attributed GMV"` và `"Doanh Thu Quy Đổi (Ads GMV)"` bằng `"GMV Max Gross Revenue"`.
   - Tách bạch rõ ràng số tiền quyết toán theo bảng kê và số tiền thực chuyển ngân hàng.

---

## 13. AUTOMATED TEST SUITE MATRIX

Hai bộ kiểm thử tự động độc lập đã chạy và đạt tỉ lệ thành công tuyệt đối **100%**:

```
====================================================================
FINAL SPRINT V2-02A ACCEPTANCE RESULTS: 73 / 73 SCENARIOS PASSED
====================================================================
[SUCCESS] ALL SPRINT V2-02A CAMPAIGN GMV MAX SCENARIOS PASSED CLEANLY (100%)!

====================================================================
FINAL ACCEPTANCE RESULTS: 61 / 61 SCENARIOS PASSED
====================================================================
[SUCCESS] ALL SPRINT V2-01.2 ACCEPTANCE SCENARIOS PASSED CLEANLY (100%)!
```

### Chi tiết phân bổ kịch bản kiểm thử:
- **Block A (Migration 010 & Rollback)**: 13 scenarios (Cấu trúc bảng, khóa ngoại, unique key, index, precision, rollback script).
- **Block B (Ingestion & Backfill)**: 5 scenarios (Khởi tạo service, phân loại campaign type, backfill số dòng, câu lệnh upsert).
- **Block C (Backend Campaign Intelligence)**: 23 scenarios (Trạng thái, độ phủ, nguồn dữ liệu, tổng số liệu vĩ mô, bóc tách Product/LIVE, đối soát bất biến, target ROAS, pacing).
- **Block D (Arithmetic Safety)**: 6 scenarios (Xử lý chi phí = 0, đơn hàng = 0, ngân sách = 0).
- **Block E (Drilldown & Guardrails)**: 11 scenarios (Dữ liệu xu hướng ngày, thông tin chiến dịch, cảnh báo bóc tách sản phẩm & video).
- **Block F (Dashboard Integration)**: 4 scenarios (Endpoint routing, require statements, domain trigger).
- **Block G (Semantic Wording Cleanup)**: 10 scenarios (Loại bỏ từ ngữ cảm tính, cập nhật tên tab, nhãn canonical).
- **Block H (Production Build)**: 1 scenario (Vite build sạch, không lỗi biên dịch).
- **Regression Suite V2-01.2**: 61 scenarios (Đơn hàng, rủi ro hao hụt, tài chính, kiểm toán POSIX).

---

## 14. PRODUCTION BUILD & VITE ARTIFACTS

Lệnh biên dịch: `npm run build` (Vite v8.1.4):
- Thời gian biên dịch: **1.48 giây**.
- Tập tin tạo ra:
  - `dist/index.html` (1.72 kB)
  - `dist/assets/index-DuDEHqtr.css` (15.48 kB)
  - `dist/assets/index-Dzlf6Eoc.js` (738.79 kB)
- Toàn bộ module (1,776 modules) được biến đổi sạch sẽ, không có lỗi runtime.

---

## 15. RELEASE PACKAGE & POSIX CENTRAL DIRECTORY AUDIT

### 15.1. Thông Tin Gói Phát Hành
- **Tên Gói**: `task_v2_02a_campaign_gmv_max_release_20261003_154837.zip`
- **Đường Dẫn**: [`release/task_v2_02a_campaign_gmv_max_release_20261003_154837.zip`](file:///c:/AdsTiktok/release/task_v2_02a_campaign_gmv_max_release_20261003_154837.zip)
- **Kích Thước**: **247,542 bytes**
- **Mã Băm SHA-256**: `7b89a450b51a95c1915d699bb5c7e620d6ea0500de1b4fa572985d56bff0c7d2`
- **Tập Tin Manifest**: [`release/V2_02A_CAMPAIGN_GMV_MAX_RELEASE_MANIFEST.md`](file:///c:/AdsTiktok/release/V2_02A_CAMPAIGN_GMV_MAX_RELEASE_MANIFEST.md)

### 15.2. Danh Sách Tập Tin Đóng Gói (12 Files) & Checksum
| Đường Dẫn Tập Tin | Kích Thước (B) | Mã Băm SHA-256 |
| :--- | :---: | :--- |
| `database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql` | 3,547 | `c454419bc93ec65807a53e45984a0fd934edd95a93cdad675b159b26135bcd93` |
| `database/migrations/20261003_010_rollback_commerce_ads_campaign_tables.sql` | 474 | `aaa56794b732432c231abb692b4f82f29548545db7cafbb79d980d9c8d067c91` |
| `public/api/commerce_ads_ingestion_service.php` | 15,986 | `4b060662fa801401b2ff044cb9ca3bc89ce05c63b3e0fb40e704485f2439feb1` |
| `public/api/commerce_ads_service.php` | 44,953 | `98fa2fb3b17e13e9b374579ef427fee55c29ac60f1465e3071f567c3543a6445` |
| `public/api/commerce_analytics_service.php` | 54,808 | `cdf80007bc62e4bcc70525091da8e0484701be3fd7c12b944fc78f4d545bc0b3` |
| `public/api/commerce_dashboard.php` | 52,626 | `9b2dd642dfa335b77d830b73ede766eadbaf5f54946b3982213a2b2a81b90364` |
| `src/CommerceDashboardView.jsx` | 218,877 | `f487874916dbd8eae4b51014019d249fee7269773d22ddcf010141c7c408d619` |
| `dist/index.html` | 1,723 | `a1102a0a5a31bc9b8509f3d47824dd4c1abca10c21a87180896701db826b0268` |
| `dist/assets/index-DuDEHqtr.css` | 15,483 | `bf640359c9d328ab7f4786abd496861fcbab5209e126133828f848dce5fa1eec` |
| `dist/assets/index-Dzlf6Eoc.js` | 738,798 | `f522f5458efbd795ce28d91a68ae6236f2e9b346063a52ed13d16086bcb0227a` |
| `tools/test_v2_02a_campaign_gmv_max.cjs` | 25,316 | `934d50c0472c335375db9afc0490e60e84d4d59c52ff63d546e236e74c76020d` |
| `tools/test_v2_01_2_acceptance.cjs` | 20,714 | `20f1a60daab1736e33dc970b6df86db0a03c2c56dd0d78d2e0eafca1bf0f61c6` |

### 15.3. Kiểm Toán Cấu Trúc POSIX Binary
Quy trình đóng gói đã duyệt trực tiếp qua Central Directory headers của file ZIP nhị phân:
- **Tỷ lệ entry sử dụng dấu gạch chéo xuôi (`/`)**: **100.0%**.
- **Số lượng entry chứa dấu gạch chéo ngược Windows (`\`)**: **0 (Zero)**.
- Đảm bảo giải nén chính xác trên hệ điều hành Linux production mà không bị lỗi tạo tên file phẳng dạng `folder\subfolder\file`.

---

## 16. PRODUCTION DEPLOYMENT DELTA & OPERATOR RUNBOOK

> [!IMPORTANT]
> Toàn bộ công tác dưới đây do Product Owner thực thi thủ công trên server production. Antigravity hoạt động ở chế độ Local Development Only.

### Bước 1: Sao chép gói phát hành
```bash
scp release/task_v2_02a_campaign_gmv_max_release_20261003_154837.zip user@production:/home/addp/
```

### Bước 2: Kiểm tra tính toàn vẹn (Checksum Verification)
```bash
sha256sum task_v2_02a_campaign_gmv_max_release_20261003_154837.zip
# Kết quả phải khớp chính xác:
# 7b89a450b51a95c1915d699bb5c7e620d6ea0500de1b4fa572985d56bff0c7d2
```

### Bước 3: Giải nén vào thư mục ứng dụng
```bash
unzip -q task_v2_02a_campaign_gmv_max_release_20261003_154837.zip -d /home/addp/domains/marketing.addp.vn/public_html/
```

### Bước 4: Thực thi Database Migration 010
```bash
mysql -u $DB_USER -p $DB_NAME < database/migrations/20261003_010_create_commerce_ads_campaign_tables.sql
```

### Bước 5: Chạy kiểm thử tự động sau triển khai (Post-deployment Smoke Test)
```bash
node tools/test_v2_02a_campaign_gmv_max.cjs
node tools/test_v2_01_2_acceptance.cjs
```

### Bước 6: Kích hoạt đồng bộ hóa kỳ ban đầu (Initial Backfill / Sync)
```bash
# Có thể kích hoạt trực tiếp từ giao diện web tại tab Đồng Bộ & Đường Ống API (Domain: ads_campaigns)
# Hoặc gọi qua cURL nội bộ:
curl -X POST "https://marketing.addp.vn/api/commerce_dashboard.php?action=trigger_sync&shop_id=7495657895504611503&domain=ads_campaigns"
```

---

## 17. KNOWN LIMITATIONS & ROADMAP FOR FUTURE SPRINTS

1. **Product Breakdown within Campaign**:
   - Hiện tại: Hiển thị trạng thái `CHƯA KHẢ DỤNG`.
   - Điều kiện nâng cấp: Cần tài liệu chính thức từ TikTok xác thực tham số dimension `product_id` cho endpoint GMV Max Report.
2. **Video & Creative Intelligence**:
   - Hiện tại: Hiển thị trạng thái `CHƯA KHẢ DỤNG`.
   - Điều kiện nâng cấp: Cần bổ sung bảng fact `commerce_ads_video_daily` và xác nhận TikTok Ads API dimension `material_id`/`video_id`.
3. **Live Session Ads Cost Allocation**:
   - Hiện tại: Đã tách bạch cấp độ chiến dịch `LIVE GMV Max`, nhưng chưa bóc tách xuống từng `room_id`/`session_id` cụ thể vì API chưa cung cấp mapping trực tiếp.

---

## 18. ACCEPTANCE CRITERIA VERIFICATION CHECKLIST

- [x] Không deploy production qua SSH/SCP trong suốt phiên làm việc.
- [x] Không thay đổi Production Database; tạo Migration 010 và Rollback có phiên bản rõ ràng.
- [x] Không tạo số liệu giả mạo (tuân thủ tuyệt đối quy tắc `null != 0`, không giả lập clicks/impressions).
- [x] Chuẩn hóa thuật ngữ sang `Ads Cost`, `GMV Max Gross Revenue`, `GMV Max ROI`.
- [x] Không đồng nhất `GMV Max Gross Revenue` với `Shop Gross` hay `Paid-only GMV`.
- [x] Cài đặt `CommerceAdsIngestionService` với cơ chế upsert lũy tích an toàn.
- [x] Triển khai bóc tách vĩ mô Product GMV Max vs LIVE GMV Max với động cơ đối soát bất biến `Total ≈ Product + LIVE`.
- [x] Xử lý an toàn số học khi chi phí = 0 hoặc đơn hàng = 0.
- [x] Đánh giá độ chênh lệch Target ROI và tỷ lệ giải ngân ngân sách ngày.
- [x] Đặt hộp cảnh báo ranh giới minh bạch cho các chiều dữ liệu chưa có API.
- [x] Rà soát và loại bỏ các câu chữ cảm tính (`"Tỷ lệ hủy đơn cao"`, `"Hiệu suất quảng cáo vượt trội"`).
- [x] Toàn bộ 73 kịch bản `test_v2_02a_campaign_gmv_max.cjs` PASS (100%).
- [x] Toàn bộ 61 kịch bản hồi quy `test_v2_01_2_acceptance.cjs` PASS (100%).
- [x] Biên dịch Vite production build sạch (`dist/` mới nhất).
- [x] Đóng gói phát hành ZIP với cấu trúc POSIX chuẩn và mã băm SHA-256.

---

## 19. DECLARATION OF COMPLETION

> Tôi xác nhận rằng **Sprint V2-02A (Campaign GMV Max Intelligence)** đã hoàn thành 100% các yêu cầu kỹ thuật và nghiệp vụ trên môi trường phát triển cục bộ (`c:\AdsTiktok`). Toàn bộ 134 kịch bản kiểm thử tự động đã vượt qua thành công. Không có bất kỳ can thiệp trái phép nào vào máy chủ hay cơ sở dữ liệu production. Gói phát hành `task_v2_02a_campaign_gmv_max_release_20261003_154837.zip` đã sẵn sàng cho Product Owner triển khai theo quy trình vận hành an toàn.

**Engineer Sign-off:** Senior Full-stack Engineer + Data Engineer (Antigravity AI)  
**Timestamp:** 2026-10-03T15:50:00+07:00  
**Status:** **READY FOR PRODUCTION ACCEPTANCE**
