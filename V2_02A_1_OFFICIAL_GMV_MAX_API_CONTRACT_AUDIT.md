# ADDP COMMERCE INTELLIGENCE V2
# SPRINT V2-02A.1 — OFFICIAL GMV MAX API CONTRACT AUDIT REPORT

**Author:** Senior Solution Architect + Data Engineer + TikTok Ads Integration Engineer  
**Date:** 2026-10-03  
**Status:** AUDIT COMPLETED & VERIFIED (LOCAL ENVIRONMENT ONLY)  
**Target Endpoint:** `GET /open_api/v1.3/gmv_max/report/get/`  
**Base URL:** `https://business-api.tiktok.com/open_api/v1.3/`  

---

## MỤC LỤC
- [A. Executive Summary & Verification Outcome](#a-executive-summary--verification-outcome)
- [B. Lineage & Provenance Truth (Ground Truth Analysis of Current Data)](#b-lineage--provenance-truth-ground-truth-analysis-of-current-data)
- [C. Official GMV Max API Contract Specification (Full Spec Mapping)](#c-official-gmv-max-api-contract-specification-full-spec-mapping)
- [D. Granularity & Fact Table Architecture (Grain & Unique Constraints)](#d-granularity--fact-table-architecture-grain--unique-constraints)
- [E. Source Precedence & Dual-Write / Backfill Strategy](#e-source-precedence--dual-write--backfill-strategy)
- [F. Product Breakdown Evaluation (SPU / item_group_id vs SKU)](#f-product-breakdown-evaluation-spu--item_group_id-vs-sku)
- [G. Video Breakdown Evaluation (item_id / Post ID & Creative Delivery Lifecycle)](#g-video-breakdown-evaluation-item_id--post-id--creative-delivery-lifecycle)
- [H. LIVE GMV Max Evaluation (room_id vs session matching)](#h-live-gmv-max-evaluation-room_id-vs-session-matching)
- [I. Metric Semantics & Reconciliation Integrity](#i-metric-semantics--reconciliation-integrity)
- [J. Implementation Readiness & Gap Analysis](#j-implementation-readiness--gap-analysis)
- [K. Changes Made to Code & UI in V2-02A.1](#k-changes-made-to-code--ui-in-v2-02a1)
- [L. Roadmap to Sprint V2-02B (Recommended Phase Plan)](#l-roadmap-to-sprint-v2-02b-recommended-phase-plan)

---

## A. EXECUTIVE SUMMARY & VERIFICATION OUTCOME

Trong Sprint V2-02A, ADDP Commerce Intelligence đã triển khai thành công tầng **Campaign GMV Max Intelligence**, đạt 75/75 scenarios kiểm thử chấp nhận (acceptance tests) và bảo toàn 100% (61/61 scenarios) các tính năng của V2-01.2.

Product Owner đã cung cấp tài liệu chính thức từ TikTok Marketing API cho endpoint:
`GET /open_api/v1.3/gmv_max/report/get/` (Base: `https://business-api.tiktok.com/open_api/v1.3/`).

### Kết Quả Đánh Giá Trọng Yếu:
1. **Minh bạch hóa Nguồn Gốc Dữ Liệu (Data Lineage Reality):**
   Toàn bộ số liệu chiến dịch đang hiển thị trên môi trường hiện tại (Giai đoạn benchmark `2026-09-01` → `2026-09-20`, bao gồm Product GMV Max `14,415,406 ₫` / `174,098,150 ₫` và LIVE GMV Max `6,057,339 ₫` / `70,927,539 ₫`) **được nạp từ bảng legacy `tiktok_campaign_daily_reports` thông qua cơ chế backfill/normalization**, chưa phải là kết quả gọi trực tiếp live endpoint `/open_api/v1.3/gmv_max/report/get/` trên môi trường runtime.
2. **Đối Soát Nội Bộ vs Đối Soát Độc Lập:**
   Việc đối soát giữa `commerce_ads_campaign_daily` và `tiktok_campaign_daily_reports` trong V2-02A là **Single-Source ETL Invariant Reconciliation** (kiểm tra tính toàn vẹn không mất mát khi chuyển đổi mô hình dữ liệu), **chưa phải là Multi-Source Independent API Reconciliation**.
3. **Xác Thực Chính Thức Các Dimensions Bị Khuyết Trước Đây:**
   - Phân rã Sản phẩm: Official dimension là `item_group_id` (= **Product SPU ID**), không phải `product_id` SKU-level.
   - Phân rã Video/Sáng tạo: Official dimension là `item_id` (= **TikTok Post ID** / Creative Identity).
   - Phân rã LIVE: Official dimension là `room_id` (= **TikTok LIVE Room ID**), giải phóng hoàn toàn nhu cầu "fuzzy timestamp matching".
4. **Cập Nhật Trạng Thái Hệ Thống:**
   Chuyển trạng thái các drilldown từ `UNAVAILABLE` / "Chờ API xác thực" sang **`SUPPORTED_NOT_SYNCED`** (Đã xác thực API contract, pipeline hiện tại chưa kích hoạt ingest chi tiết).

---

## B. LINEAGE & PROVENANCE TRUTH (GROUND TRUTH ANALYSIS OF CURRENT DATA)

### 1. Luồng Dữ Liệu Hiện Tại Trong Hệ Thống
```
[tiktok_campaigns] + [tiktok_campaign_daily_reports] (Legacy Snapshot)
                          │
                          ▼ (CommerceAdsIngestionService::backfillFromLegacyDailyReports)
             [commerce_ads_campaign_daily] (V2 Canonical Fact Table)
                          │
                          ▼ (CommerceAdsService::getCampaignIntelligence)
              [Dashboard Subtab 4: Quảng Cáo (GMV Max)]
```

### 2. Bằng Chứng Dữ Liệu Benchmark (2026-09-01 → 2026-09-20)
| Chi Phí / Doanh Thu | Giá Trị (VND) | Nguồn Gốc Thực Tế | Campaign ID | Trạng Thái Ingestion |
| :--- | :--- | :--- | :--- | :--- |
| **Product GMV Max Cost** | 14,415,406 ₫ | `tiktok_campaign_daily_reports` | `1809001` | DAILY_REPORT_BACKFILL |
| **Product GMV Max Gross** | 174,098,150 ₫ | `tiktok_campaign_daily_reports` | `1809001` | DAILY_REPORT_BACKFILL |
| **LIVE GMV Max Cost** | 6,057,339 ₫ | `tiktok_campaign_daily_reports` | `1809002` | DAILY_REPORT_BACKFILL |
| **LIVE GMV Max Gross** | 70,927,539 ₫ | `tiktok_campaign_daily_reports` | `1809002` | DAILY_REPORT_BACKFILL |
| **Total Ads Cost** | 20,472,745 ₫ | Tổng hợp từ 2 chiến dịch trên | — | RECONCILED (Variance: 0 ₫) |
| **Total Attributed Gross** | 245,025,689 ₫ | Tổng hợp từ 2 chiến dịch trên | — | RECONCILED (Variance: 0 ₫) |

### 3. Đánh Giá Bản Chất Đối Soát
- **Thực tế:** Bảng `commerce_ads_campaign_daily` được nạp từ bảng `tiktok_campaign_daily_reports`. Khi đối soát tổng của bảng mới với bảng cũ và thấy phương sai `= 0 ₫`, điều này chứng minh:
  * Thuật toán backfill bảo toàn 100% dữ liệu gốc.
  * Phân loại chiến dịch (`PRODUCT_GMV_MAX` vs `LIVE_GMV_MAX`) là triệt để (mutually exclusive & collectively exhaustive).
- **Cảnh báo kiến trúc:** Đây là **Self-Consistency Audit**, không thể coi là đối chiếu chéo độc lập từ 2 nguồn API khác nhau. Báo cáo hệ thống phải ghi rõ `data_lineage: 'BOOTSTRAP_FROM_DAILY_REPORTS'`.

---

## C. OFFICIAL GMV MAX API CONTRACT SPECIFICATION (FULL SPEC MAPPING)

Tài liệu chính thức từ TikTok đã xác lập contract chuẩn hóa cho GMV Max Reporting API:

### 1. HTTP Endpoint & Phương Thức
- **Method:** `GET`
- **Endpoint:** `/open_api/v1.3/gmv_max/report/get/`
- **Base URL:** `https://business-api.tiktok.com/open_api/v1.3/`
- **Header:** `Access-Token: <ads_access_token>`, `Content-Type: application/json`

### 2. Danh Sách Dimensions Được Xác Nhận
| Dimension | Data Type | Ý Nghĩa Nghiệp Vụ | Mapping ADDP |
| :--- | :--- | :--- | :--- |
| `advertiser_id` | string | TikTok Ads Account ID | `tiktok_config.advertiser_id` |
| `campaign_id` | string | Định danh chiến dịch GMV Max | `commerce_ads_campaign_daily.campaign_id` |
| `stat_time_day` | string | Ngày thống kê (`YYYY-MM-DD 00:00:00`) | `stat_date` (cắt 10 ký tự đầu) |
| `stat_time_hour` | string | Giờ thống kê | Phục vụ phân tích real-time / intraday |
| `item_group_id` | string | **Product SPU ID** (Mã nhóm sản phẩm) | `product_id` trong shop orders/catalog |
| `item_id` | string | **TikTok Post ID** (Creative identity) | Video Post ID của video quảng cáo/organic |
| `room_id` | string | **TikTok LIVE Room ID** | `room_id` trong `commerce_live_sessions` |
| `duration` | string | Khoảng thời gian tổng hợp | Khoảng lọc thống kê |

### 3. Promotion Types
- `PRODUCT`: Chiến dịch GMV Max dành cho Sản phẩm (Product GMV Max).
- `LIVE`: Chiến dịch GMV Max dành cho Livestream (LIVE GMV Max).

### 4. Creative Delivery Statuses (Finite State Machine)
TikTok Ads quản lý trạng thái phân phối sáng tạo theo 9 trạng thái hữu hạn:
1. `IN_QUEUE`: Đang xếp hàng chờ duyệt/phân phối.
2. `LEARNING`: Đang trong giai đoạn máy học (learning phase).
3. `DELIVERING`: Đang cắn tiền và phân phối bình thường.
4. `NOT_DELIVERING`: Tạm dừng hoặc không phân phối.
5. `AUTHORIZATION_NEEDED`: Cần cấp quyền liên kết bài đăng / tài khoản.
6. `EXCLUDED`: Đã bị loại trừ khỏi nhóm phân phối.
7. `UNAVAILABLE`: Không khả dụng do vi phạm hoặc bài đăng bị xóa.
8. `REJECTED`: Bị từ chối duyệt quảng cáo.
9. `NOT_ACTIVE`: Trạng thái không hoạt động.

### 5. Danh Mục Metrics Chính Thức
#### A. Product GMV Max Metrics:
- Chi phí & Doanh thu: `cost`, `net_cost`, `gross_revenue`, `orders`, `roi`, `cost_per_order`.
- Phễu Hiển thị & Chuyển đổi: `product_impressions`, `product_clicks`, `product_click_rate`, `ad_click_rate`, `ad_conversion_rate`.
- Phễu Giữ chân Video: `ad_video_view_rate_2s`, `ad_video_view_rate_6s`, `ad_video_view_rate_p25`, `ad_video_view_rate_p50`, `ad_video_view_rate_p75`, `ad_video_view_rate_p100`.

#### B. LIVE GMV Max Metrics:
- Chi phí & Doanh thu: `cost`, `net_cost`, `gross_revenue`, `orders`, `roi`, `cost_per_order`.
- Tương tác Phiên LIVE: `live_views`, `cost_per_live_view`, `10_second_live_views`, `cost_per_10_second_live_view`, `live_follows`.

### 6. Cảnh Báo Deprecation Quan Trọng
- Trường `creative_types` (`ADS_AND_ORGANIC`, `ORGANIC`, `REMOVED`) **được TikTok chính thức đánh dấu là sắp bị loại bỏ (to-be-deprecated)**.
- **Quyết định kiến trúc:** Tuyệt đối không thiết kế khóa quan hệ hoặc logic phân nhánh nghiệp vụ phụ thuộc cứng vào `creative_types`.

---

## D. GRANULARITY & FACT TABLE ARCHITECTURE (GRAIN & UNIQUE CONSTRAINTS)

### 1. Đánh Giá Khóa Duy Nhất Migration 010 Hiện Tại
Bảng `commerce_ads_campaign_daily` được định nghĩa với:
```sql
UNIQUE KEY `uk_platform_shop_campaign_date` (`platform`, `shop_id`, `campaign_id`, `stat_date`)
```
- **Kết luận:** **HOÀN TOÀN AN TOÀN CHO TẦNG CHIẾN DỊCH (CAMPAIGN LEVEL)**.
- **Lý do:** Một `campaign_id` trong TikTok Ads chỉ thuộc về một advertiser/shop duy nhất và có loại chiến dịch cố định (`PRODUCT` hoặc `LIVE`). Không có trường hợp một `campaign_id` vừa là PRODUCT vừa là LIVE trong cùng một ngày. Vì vậy, khóa 4 thành phần trên đảm bảo tính duy nhất 1:1, không bao giờ bị trùng lặp hay va chạm bản ghi.

### 2. Giới Hạn Của Khóa Hiện Tại Khi Drilldown
Khóa của bảng `commerce_ads_campaign_daily` **KHÔNG THỂ DÙNG để lưu trữ dữ liệu phân rã Product, Video, hoặc LIVE**, bởi vì một chiến dịch có thể chứa hàng chục sản phẩm, hàng trăm video và nhiều phiên LIVE trong cùng một ngày.

### 3. Kiến Trúc Fact Tables Phân Tầng Chuẩn Hóa Cho V2-02B
Để hỗ trợ toàn diện các chiều phân tích mà không phá vỡ mô hình hiện tại, kiến trúc dữ liệu cần 4 bảng fact phân cấp:

```
                                  [TIKTOK GMV MAX REPORT API]
                                               │
               ┌───────────────────────────────┼───────────────────────────────┐
               ▼                               ▼                               ▼
 [commerce_ads_campaign_daily]    [commerce_ads_product_daily]     [commerce_ads_video_daily]
  Grain: (camp, date)              Grain: (camp, item_group, date)  Grain: (camp, item, date)
  Level: Campaign Macro            Level: Product SPU Drilldown     Level: Video Post Funnel
```

| Fact Table | Grain (Unique Constraint) | Dimension Khóa | Mô Tả & Nghiệp Vụ |
| :--- | :--- | :--- | :--- |
| `commerce_ads_campaign_daily` *(Đã tạo - 010)* | `(platform, shop_id, campaign_id, stat_date)` | `campaign_id` | Hiệu suất chiến dịch vĩ mô hàng ngày |
| `commerce_ads_product_daily` *(V2-02B)* | `(platform, shop_id, campaign_id, item_group_id, stat_date)` | `item_group_id` (SPU) | Bóc tách chi phí & GMV theo từng sản phẩm |
| `commerce_ads_video_daily` *(V2-02B)* | `(platform, shop_id, campaign_id, item_id, stat_date)` | `item_id` (Post ID) | Bóc tách chi phí & phễu xem video sáng tạo |
| `commerce_ads_live_daily` *(V2-02B)* | `(platform, shop_id, campaign_id, room_id, stat_date)` | `room_id` (Room ID) | Bóc tách chi phí & mắt xem theo phiên LIVE |

---

## E. SOURCE PRECEDENCE & DUAL-WRITE / BACKFILL STRATEGY

Khi kích hoạt luồng kết nối API thực tế, hệ thống phải tuân thủ nghiêm ngặt **Thứ tự Ưu tiên Nguồn Dữ Liệu (Source Precedence Matrix)** để ngăn chặn ghi đè mù quáng (blind overwrite):

### 1. Ma Trận Ưu Tiên Nguồn (Precedence Hierarchy)
1. **Tier 1 — Authoritative Primary Source:** `TIKTOK_GMV_MAX_API`  
   Endpoint `/open_api/v1.3/gmv_max/report/get/`. Đây là nguồn có thẩm quyền cao nhất, chứa đầy đủ các chỉ số chuẩn (`net_cost`, `cost`, `product_clicks`, `video_view_rates`).
2. **Tier 2 — Historical Bootstrap / Shadow Audit:** `DAILY_REPORT_BACKFILL`  
   Bảng `tiktok_campaign_daily_reports`. Dùng để đối soát lịch sử hoặc dự phòng khi API TikTok bị giới hạn tần suất (rate limit) hoặc bảo trì.

### 2. Quy Tắc Ghi Đè & Idempotency
- **Cột Đánh Dấu Nguồn:** Mỗi bản ghi trong các bảng fact luôn có cột `source` và `source_endpoint`.
- **Nguyên Tắc Cập Nhật:**
  * Nếu bản ghi hiện tại có `source = 'DAILY_REPORT_BACKFILL'` và nhận được dữ liệu từ `TIKTOK_GMV_MAX_API`, hệ thống **được phép cập nhật nâng cấp** lên `source = 'TIKTOK_GMV_MAX_API'`.
  * Nếu bản ghi hiện tại đã là `source = 'TIKTOK_GMV_MAX_API'`, luồng backfill từ bảng legacy **tuyệt đối không được ghi đè**.
- **Data Hashing:** Sử dụng `raw_data_hash = SHA256(json_payload)` để phát hiện thay đổi dữ liệu từ API và bỏ qua việc cập nhật thừa thãi nếu dữ liệu không đổi.

---

## F. PRODUCT BREAKDOWN EVALUATION (SPU / ITEM_GROUP_ID VS SKU)

### 1. Bản Chất Kỹ Thuật Của `item_group_id`
- Trong TikTok Shop và TikTok Ads:
  * `item_group_id` đại diện cho **SPU (Standard Product Unit)** — mã sản phẩm cha trên sàn (Ví dụ: Sản phẩm "Sâm Nhung Bổ Thận Hộp 30 Viên").
  * `sku_id` đại diện cho từng biến thể cụ thể (Màu sắc, kích thước, combo).
- **Phát hiện quan trọng:** TikTok GMV Max tối ưu hóa ngân sách và báo cáo hiệu suất ở cấp độ **SPU (`item_group_id`)**, **KHÔNG bóc tách đến từng SKU**.

### 2. Mô Hình Đối Chiếu Với Shop Orders
```
[TikTok Ads GMV Max Report]                     [ADDP Commerce Orders]
  item_group_id: 1729584738291029384              product_id: 1729584738291029384
  (SPU Level)                                     ├── sku_id_1: Combo 1
                                                  └── sku_id_2: Combo 2
        │                                                │
        └────────────────── EXACT JOIN ──────────────────┘
                 ON item_group_id == product_id
```
- **Quy tắc tính toán:** Khi so sánh Doanh thu gộp GMV Max của một sản phẩm với Doanh thu đơn hàng thực tế của Shop (`order_derived_gross`), ADDP phải **rollup toàn bộ line items của sản phẩm đó theo `product_id`**.
- Không được suy diễn tỷ lệ chia chi phí quảng cáo cho từng `sku_id` nếu API không cung cấp.

---

## G. VIDEO BREAKDOWN EVALUATION (ITEM_ID / POST ID & CREATIVE LIFECYCLE)

### 1. Bản Chất Dimension `item_id`
- `item_id` trong GMV Max Report API là **TikTok Post ID** (Mã định danh duy nhất của video đăng tải trên kênh TikTok, bao gồm cả video tự sản xuất và video do creator/affiliate ủy quyền).

### 2. Vòng Đời Phân Phối Sáng Tạo (Creative Lifecycle)
- Không chỉ cung cấp chi phí và doanh thu, API còn trả về `delivery_status` với 9 trạng thái chuẩn hóa.
- Điều này cho phép ADDP xây dựng bảng chẩn đoán sáng tạo:
  * Nhận biết video nào đang trong giai đoạn máy học (`LEARNING`).
  * Cảnh báo video nào bị dừng do hết quyền ủy quyền (`AUTHORIZATION_NEEDED`).
  * Phát hiện video bị từ chối duyệt (`REJECTED`) hoặc kém hiệu quả bị loại trừ (`EXCLUDED`).

### 3. Phễu Xem Video (Video Retention Rates)
- API cung cấp đầy đủ các mốc xem video: `2s`, `6s`, `25%`, `50%`, `75%`, `100%`.
- Khi triển khai V2-02B, ADDP có thể tính toán chính xác điểm rơi người xem (Drop-off Rate) của từng video quảng cáo mà không cần phụ thuộc vào bất kỳ công cụ đo lường bên thứ ba nào.

---

## H. LIVE GMV MAX EVALUATION (ROOM_ID VS SESSION MATCHING)

### 1. Loại Bỏ Hoàn Toàn Nhu Cầu Fuzzy Matching
- Trong Phase 0, một rủi ro lớn được đặt ra: *Làm sao để biết chi phí quảng cáo LIVE GMV Max thuộc về phiên phát sóng nào trong bảng `commerce_live_sessions`? Liệu có phải so khớp khoảng thời gian phát sóng không?*
- **Lời giải từ Official Contract:** Endpoint trả về trực tiếp **`room_id`** (Định danh phòng live của TikTok).
- Trong ADDP, bảng `commerce_live_sessions` (tạo từ Migration 008) đã lưu trữ `room_id` từ TikTok Shop Live API.
- Do đó, việc liên kết giữa Chi phí quảng cáo LIVE và Phiên Livestream thực tế được thực hiện bằng **phép nối chính xác (EXACT JOIN) trên `room_id`**:
  ```sql
  SELECT ads.cost, ads.gross_revenue, s.title, s.start_time, s.end_time
  FROM commerce_ads_live_daily ads
  INNER JOIN commerce_live_sessions s ON ads.room_id = s.room_id
  ```

---

## I. METRIC SEMANTICS & RECONCILIATION INTEGRITY

### 1. Chuẩn Hóa Ý Nghĩa Ngữ Nghĩa (Canonical Semantic Rules)
1. **`gross_revenue`:** Là **GMV Max Gross Revenue** (Doanh thu gộp được thuật toán TikTok phân bổ cho quảng cáo GMV Max).
   - **Tuyệt đối không đồng nhất với:** Doanh thu gộp toàn Shop (`shop_gross_revenue`), Doanh thu đơn hàng đã tạo (`order_derived_gross`), hay Tiền đối soát thực nhận (`statement_settlement`).
2. **`cost` vs `net_cost`:**
   - `cost`: Chi phí thực tế đã chi tiêu trước thuế/khuyến mãi.
   - `net_cost`: Chi phí ròng sau khi trừ các khoản tín dụng hoặc chiết khấu quảng cáo từ TikTok.
   - Hệ thống lưu trữ cả hai trường, ưu tiên hiển thị `cost` đồng bộ với giao diện TikTok Ads Manager.
3. **`roi` và `cost_per_order`:**
   - Lưu trữ trực tiếp giá trị do TikTok API trả về (`roi`, `cost_per_order`).
   - Đồng thời tính toán giá trị dẫn xuất (Derived metrics) trong tầng xử lý:
     $$\text{Derived ROI} = \frac{\text{gross\_revenue}}{\text{cost}}$$
     $$\text{Derived CPA} = \frac{\text{cost}}{\text{orders}}$$
   - Nếu phát hiện độ lệch giữa API ROI và Derived ROI vượt quá $0.05$, hệ thống phát cờ cảnh báo Discrepancy.

---

## J. IMPLEMENTATION READINESS & GAP ANALYSIS

### 1. Bảng Đánh Giá Tính Sẵn Sàng (Readiness Matrix)
| Tầng Phân Tích | Dimension Chính Thức | Trạng Thái API Contract | Trạng Thái Pipeline Thực Tế | Mức Độ Sẵn Sàng |
| :--- | :--- | :--- | :--- | :--- |
| **Campaign GMV Max** | `campaign_id` | VERIFIED | ACTIVE (Backfill & Service Sẵn Sàng) | **READY (100%)** |
| **Product Breakdown** | `item_group_id` | VERIFIED | CONTRACT_PROVEN_INGESTION_PENDING | **SUPPORTED_NOT_SYNCED** |
| **Video Breakdown** | `item_id` | VERIFIED | CONTRACT_PROVEN_INGESTION_PENDING | **SUPPORTED_NOT_SYNCED** |
| **LIVE Breakdown** | `room_id` | VERIFIED | CONTRACT_PROVEN_INGESTION_PENDING | **SUPPORTED_NOT_SYNCED** |

### 2. Trạng Thái Thực Thi Runtime Ingestion
- **Đánh giá khách quan:** Mặc dù `CommerceAdsIngestionService` đã có hàm khung `ingestFromTikTokAdsApi()` gọi endpoint `/gmv_max/report/get/`, nhưng **chưa từng chạy thành công với Live Production Token trong môi trường thực tế** do thiếu runtime credentials trong phiên làm việc local.
- **Trạng thái chính thức:** **`OFFICIAL_GMV_MAX_API_INGESTION = NOT_IMPLEMENTED (RUNTIME)`**. Không ngộ nhận việc hợp đồng API đã rõ là đường ống dữ liệu đã chạy xong.

---

## K. CHANGES MADE TO CODE & UI IN V2-02A.1

Dựa trên kết quả kiểm toán, các thành phần mã nguồn đã được cập nhật chuẩn xác:

### 1. Backend Service (`public/api/commerce_ads_service.php`)
- Cập nhật cấu trúc `guardrail_disclosures` và chi tiết chiến dịch:
  * Thay thế nhãn `UNAVAILABLE` bằng `SUPPORTED_NOT_SYNCED`.
  * Bổ sung dimension chính thức: `item_group_id` (Product SPU ID), `item_id` (TikTok Post ID), `room_id` (LIVE Room ID).
  * Thêm cảnh báo deprecation cho `creative_types`.
  * Cập nhật thông điệp minh bạch: *"Hỗ trợ bởi official GMV Max API contract. Pipeline hiện tại chưa kích hoạt ingest cấp chi tiết."*

### 2. Frontend View (`src/CommerceDashboardView.jsx`)
- Cập nhật Campaign Detail Modal:
  * Hiển thị badge phong cách công nghệ `HỖ TRỢ - CHƯA NẠP (item_group_id)` hoặc `HỖ TRỢ - CHƯA NẠP (room_id)` tùy theo loại chiến dịch (`PRODUCT_GMV_MAX` vs `LIVE_GMV_MAX`).
  * Hiển thị badge `HỖ TRỢ - CHƯA NẠP (item_id)` cho phân rã Video/Sáng tạo.
  * Diễn giải rõ ràng hợp đồng API đã được xác thực, không còn thông báo "Chờ xác thực dimension từ API".

### 3. Acceptance Test Suite (`tools/test_v2_02a_campaign_gmv_max.cjs`)
- Mở rộng kịch bản kiểm thử Scenarios 55–60:
  * Kiểm tra chặt chẽ trạng thái `SUPPORTED_NOT_SYNCED`.
  * Xác minh sự hiện diện của các dimensions `item_group_id`, `item_id`, `room_id`.
  * Kết quả: **75 / 75 scenarios PASS CLEANLY (100%)**.

---

## L. ROADMAP TO SPRINT V2-02B (RECOMMENDED PHASE PLAN)

Khi bước vào Sprint V2-02B (Product & Video & LIVE Intelligence), lộ trình triển khai đề xuất gồm 4 bước an toàn:

```
[BƯỚC 1: MIGRATION FACT TABLES]
  - Tạo Migration 011: commerce_ads_product_daily (item_group_id)
  - Tạo Migration 012: commerce_ads_video_daily (item_id)
  - Tạo Migration 013: commerce_ads_live_daily (room_id)
                         │
                         ▼
[BƯỚC 2: RUNTIME CREDENTIAL & LIVE INGESTION PROBE]
  - Xác thực Access Token v1.3 với Scope quảng cáo
  - Chạy thử nghiệm phân trang (pagination) trên 1 ngày mẫu
                         │
                         ▼
[BƯỚC 3: DATA PIPELINE & ETL SCHEDULING]
  - Hoàn thiện CommerceAdsIngestionService ingest chi tiết theo đợt
  - Tích hợp cơ chế Deduplication & SHA-256 Payload Hash
                         │
                         ▼
[BƯỚC 4: UI DRILLDOWN WORKBENCH & ACCEPTANCE]
  - Bảng xếp hạng hiệu suất Sản phẩm (SPU Ranking & Clicks)
  - Bảng phễu Video Sáng tạo (Retention 2s..100% & Creative Status)
  - Đối soát chi phí LIVE GMV Max với Doanh thu Phiên LIVE
```

---

## KẾT LUẬN

Kiểm toán Sprint V2-02A.1 đã thành công trong việc:
1. Xác lập sự thật về nguồn dữ liệu và tính chất đối soát nội bộ.
2. Chuẩn hóa toàn bộ thuật ngữ, dimensions và taxonomy theo đúng Official TikTok GMV Max API Specification.
3. Cập nhật hệ thống mã nguồn và giao diện người dùng đồng bộ, loại bỏ hoàn toàn các giả định suy đoán.
4. Bảo toàn tính toàn vẹn của hệ thống với 100% tests vượt qua và build frontend sạch sẽ.
5. Sẵn sàng đầy đủ tài liệu và kiến trúc nền tảng để tiến hành Sprint V2-02B khi có yêu cầu.
